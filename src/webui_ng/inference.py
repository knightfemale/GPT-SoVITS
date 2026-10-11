"""Engine：GPT-SoVITS 推理内核的单进程并发封装。

并发模型（对齐冻结契约 P1）
-----------------------------
- 一个**有界 FIFO** ``asyncio.Queue``。``/api/tts``（非流式与流式）与
  ``/api/models/switch`` 都作为任务入队，从而保证 GPU 上对 ``TTS`` 单例的
  **串行**访问（``run()`` 共享 ``prompt_cache`` 等状态，不能并发）。
- **一个专用 worker 线程**独占 ``TTS`` 实例。事件循环**绝不**直接执行
  ``TTS.run()``（否则会阻塞所有请求）。
- 非流式：worker 产出完整音频字节，经 ``loop.call_soon_threadsafe`` 回填
  该请求的 future；请求协程 ``await`` 结果。
- 流式：worker 把每个分片推入该请求专属的 ``asyncio.Queue``，由路由层
  ``StreamingResponse`` 消费（``audio/wav``）。
- 取消：调用 ``TTS.stop()``（置位 ``stop_flag``），并标记任务 cancelled；
  下一次 ``run()`` 会自行复位 ``stop_flag``。

音频打包函数（``pack_audio`` / ``wave_header_chunk``）与 ``api_v2.py`` 行为一致，
此处按契约**重新实现**而非 import 旧文件。WAV 使用标准库 ``wave``（无 soundfile
依赖）；OGG 需要 soundfile；AAC 需要 ffmpeg；RAW 为裸 PCM。
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import io
import logging
import os
import struct
import subprocess
import threading
import wave
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, Optional

import numpy as np

log = logging.getLogger("webui_ng.inference")

# 默认 TTS 配置（相对 repo 根；activate(change_cwd=True) 后 cwd 即 repo 根）。
DEFAULT_TTS_CONFIG = os.path.join("GPT_SoVITS", "configs", "tts_infer.yaml")

_SUPPORTED_MEDIA = ("wav", "raw", "ogg", "aac")

# 每请求流式队列的上界：满时丢最旧分片（worker 线程绝不阻塞事件循环）。
STREAM_QUEUE_MAXSIZE = 256


class _StreamEnd:
    """流式队列的结束哨兵。"""

    __slots__ = ()


STREAM_END = _StreamEnd()


class _StreamAbort:
    """流式队列的中止哨兵：有容器媒体溢出时投递，令响应以错误终止。"""

    __slots__ = ()


STREAM_ABORT = _StreamAbort()

# 带容器（需头部/封装）的媒体类型：溢出时绝不静默丢帧（尤其头分片）。
_CONTAINER_MEDIA = ("wav", "ogg", "aac")

# 流式响应的空闲上限（秒）：客户端长时间不消费即中止并尽快释放 GPU 门。
STREAM_IDLE_TIMEOUT = float(os.environ.get("GPT_SOVITS_STREAM_IDLE_TIMEOUT", "120"))


class StreamOverflowError(RuntimeError):
    """流式响应因有界队列溢出或空闲超时而中止（避免客户端收到损坏的容器）。"""


class ModelsNotLoadedError(RuntimeError):
    """TTS 内核懒加载失败（模型缺失/配置无效等）。

    路由层据此返回 **503**，且**不影响**其它路由与后续请求（可重试）。
    """


# --------------------------------------------------------------------------- #
# 音频打包（行为等价于 api_v2.py，但独立实现）
# --------------------------------------------------------------------------- #
def ffmpeg_exe() -> str:
    """返回可用的 ffmpeg 可执行文件路径。

    ``tools.portable_runtime.FFMPEG_EXE`` 指向 Windows 运行时目录；在 Linux
    上通常不存在，此时退回 PATH 中的 ``ffmpeg``。
    """
    try:
        from tools.portable_runtime import FFMPEG_EXE as _ff  # noqa: WPS433

        if _ff and os.path.exists(str(_ff)):
            return str(_ff)
    except Exception:  # pragma: no cover - 运行环境相关
        pass
    return os.environ.get("FFMPEG_EXE", "ffmpeg")


def _as_int16(data: np.ndarray) -> np.ndarray:
    arr = np.asarray(data)
    if arr.dtype == np.int16:
        return arr
    return np.clip(arr, -32768, 32767).astype(np.int16)


def wave_header_chunk(frame_input: bytes = b"", channels: int = 1,
                      sample_width: int = 2, sample_rate: int = 32000) -> bytes:
    """生成（可选带首帧的）WAV 头字节，用于流式响应的第一个分片。"""
    byte_rate = sample_rate * channels * sample_width
    block_align = channels * sample_width
    data_size = len(frame_input)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,  # PCM
        channels,
        sample_rate,
        byte_rate,
        block_align,
        sample_width * 8,
        b"data",
        data_size,
    )
    return header + frame_input


def pack_wav(data: np.ndarray, rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(_as_int16(data).tobytes())
    return buf.getvalue()


def pack_raw(data: np.ndarray, rate: int) -> bytes:  # noqa: ARG001
    return _as_int16(data).tobytes()


def pack_ogg(data: np.ndarray, rate: int) -> bytes:
    try:
        import soundfile as sf  # noqa: WPS433
    except Exception as exc:  # pragma: no cover - 运行环境相关
        raise RuntimeError("ogg media_type requires the 'soundfile' package") from exc

    buf = io.BytesIO()

    def _run() -> None:
        with sf.SoundFile(buf, mode="w", samplerate=rate, channels=1, format="ogg") as f:
            f.write(data)

    # 大音频写 ogg 时 libsndfile 可能栈溢出，使用更大线程栈（同 api_v2）。
    try:
        threading.stack_size(4096 * 4096)
    except (RuntimeError, ValueError):
        pass
    th = threading.Thread(target=_run)
    th.start()
    th.join()
    return buf.getvalue()


def pack_aac(data: np.ndarray, rate: int) -> bytes:
    process = subprocess.Popen(
        [
            ffmpeg_exe(),
            "-f", "s16le",
            "-ar", str(rate),
            "-ac", "1",
            "-i", "pipe:0",
            "-c:a", "aac",
            "-b:a", "192k",
            "-vn",
            "-f", "adts",
            "pipe:1",
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    out, _ = process.communicate(input=_as_int16(data).tobytes())
    return out or b""


def pack_audio(data: np.ndarray, rate: int, media_type: str) -> bytes:
    if media_type == "wav":
        return pack_wav(data, rate)
    if media_type == "aac":
        return pack_aac(data, rate)
    if media_type == "ogg":
        return pack_ogg(data, rate)
    return pack_raw(data, rate)


# --------------------------------------------------------------------------- #
# Engine
# --------------------------------------------------------------------------- #
@dataclass
class _Task:
    kind: str  # "tts" | "switch"
    req: Optional[Dict[str, Any]] = None
    is_stream: bool = False
    media_type: str = "wav"
    out_queue: Optional["asyncio.Queue[Any]"] = None
    future: Optional["asyncio.Future[Any]"] = None
    sovits_path: Optional[str] = None
    gpt_path: Optional[str] = None
    cancelled: threading.Event = field(default_factory=threading.Event)
    overflow: threading.Event = field(default_factory=threading.Event)


def _load_tts_classes():
    """延迟导入重型内核（torch 等），避免 import 本模块即加载模型。"""
    from GPT_SoVITS.TTS_infer_pack.TTS import TTS, TTS_Config  # noqa: WPS433

    return TTS, TTS_Config


class Engine:
    """GPU 推理 lane：TTS 单例 + 有界 FIFO + 专用 worker 线程。"""

    def __init__(
        self,
        tts_config_path: Optional[str] = None,
        queue_size: int = 32,
        gpu_gate: Optional["asyncio.Semaphore"] = None,
    ):
        self._tts_config_path = (
            tts_config_path
            or os.environ.get("GPT_SOVITS_TTS_CONFIG")
            or DEFAULT_TTS_CONFIG
        )
        self._queue_size = max(1, int(queue_size))
        # 推理与子进程任务共享同一把 GPU 门（由 app.py lifespan 注入），
        # 保证"占卡串行"。未注入时退化为独立信号量（仅供单测）。
        self._gpu_gate = gpu_gate if gpu_gate is not None else asyncio.Semaphore(1)
        self._stream_idle_timeout = STREAM_IDLE_TIMEOUT
        self._tts = None
        self._load_error: Optional[str] = None
        self._queue: Optional["asyncio.Queue[Optional[_Task]]"] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._current: Optional[_Task] = None
        self._stopping = threading.Event()
        self.started = False

    # -- 生命周期 ----------------------------------------------------------- #
    def start(self) -> None:
        """启动 worker 线程（必须在事件循环内调用）。

        **懒加载**：此处**不**构造 TTS / TTS_Config，也不 ``torch.load`` 任何权重，
        因此无模型时服务也能正常启动（SPA / health / 其它路由可用）。重型内核在
        首次 ``synthesize*`` / ``switch_models`` 时于 GPU 门内、由 worker 线程按需
        构造并缓存。
        """
        if self.started:
            return
        self._loop = asyncio.get_running_loop()
        self._queue = asyncio.Queue(maxsize=self._queue_size)
        self._stopping.clear()
        self._thread = threading.Thread(
            target=self._worker, name="webui-ng-tts-worker", daemon=True
        )
        self._thread.start()
        self.started = True
        log.info("Engine worker started (TTS lazy-load on first request)")

    def stop(self) -> None:
        self._stopping.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        self.started = False

    # -- 只读属性 ----------------------------------------------------------- #
    @property
    def tts(self):
        return self._tts

    @property
    def configs(self):
        return getattr(self._tts, "configs", None)

    @property
    def version(self) -> Optional[str]:
        cfg = self.configs
        return getattr(cfg, "version", None) if cfg is not None else None

    @property
    def is_loaded(self) -> bool:
        """TTS 内核是否已成功懒加载。"""
        return self._tts is not None

    @property
    def load_error(self) -> Optional[str]:
        """最近一次懒加载失败的原因（成功或从未加载时为 ``None``）。"""
        return self._load_error

    @property
    def queue_size(self) -> int:
        return self._queue.maxsize if self._queue is not None else self._queue_size

    def queued(self) -> int:
        return self._queue.qsize() if self._queue is not None else 0

    # -- 公共 API（在事件循环中调用） -------------------------------------- #
    async def ensure_loaded(self) -> None:
        """确保 TTS 内核已加载（首次请求时在 GPU 门内按需构造）。

        已加载时**立即返回**（无队列往返）。构造失败抛 ``ModelsNotLoadedError``；
        失败**不缓存**坏实例，后续请求会重试。
        """
        if self._tts is not None:
            return
        loop = asyncio.get_running_loop()
        fut: "asyncio.Future[Any]" = loop.create_future()
        task = _Task(kind="load", future=fut)
        async with self._gpu_gate:
            await self._queue.put(task)
            await fut

    async def synthesize(self, req: Dict[str, Any]) -> bytes:
        """非流式合成，返回完整音频字节。"""
        loop = asyncio.get_running_loop()
        fut: "asyncio.Future[Any]" = loop.create_future()
        task = _Task(
            kind="tts",
            req=req,
            is_stream=False,
            media_type=req.get("media_type", "wav"),
            future=fut,
        )
        async with self._gpu_gate:
            await self._queue.put(task)
            try:
                return await fut
            except asyncio.CancelledError:
                task.cancelled.set()
                # 仅当该任务正是当前在跑的任务时才 stop，避免误杀其它请求
                # （TTS.stop() 置位的是实例共享 stop_flag）。
                if self._current is task:
                    self._stop_tts()
                raise

    async def synthesize_stream(self, req: Dict[str, Any]) -> AsyncIterator[bytes]:
        """流式合成，逐分片 yield 音频字节（首片为 WAV 头）。"""
        loop = asyncio.get_running_loop()
        out: "asyncio.Queue[Any]" = asyncio.Queue(maxsize=STREAM_QUEUE_MAXSIZE)
        task = _Task(
            kind="tts",
            req=req,
            is_stream=True,
            media_type=req.get("media_type", "wav"),
            out_queue=out,
        )
        async with self._gpu_gate:
            await self._queue.put(task)
            finished = False
            try:
                while True:
                    try:
                        item = await asyncio.wait_for(
                            out.get(), timeout=self._stream_idle_timeout
                        )
                    except asyncio.TimeoutError:
                        # 客户端长时间不消费：中止并释放 GPU 门（NB1）。
                        raise StreamOverflowError("tts stream idle timeout") from None
                    if item is STREAM_END:
                        finished = True
                        break
                    if item is STREAM_ABORT:
                        # 有容器媒体溢出：以错误终止响应，绝不吐损坏文件（BLOCK-5）。
                        raise StreamOverflowError("tts stream overflow")
                    if isinstance(item, BaseException):
                        finished = True
                        raise item
                    yield item
            finally:
                if not finished:
                    # 客户端断开 / 生成器提前关闭 / 溢出中止：取消当前推理。
                    task.cancelled.set()
                    # 仅当该任务正是当前在跑的任务时才 stop，避免跨请求误杀。
                    if self._current is task:
                        self._stop_tts()

    async def switch_models(
        self,
        sovits_path: Optional[str] = None,
        gpt_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """热切换权重；与 ``synthesize*`` 共用同一条 lane。"""
        loop = asyncio.get_running_loop()
        fut: "asyncio.Future[Any]" = loop.create_future()
        task = _Task(
            kind="switch",
            future=fut,
            sovits_path=sovits_path,
            gpt_path=gpt_path,
        )
        async with self._gpu_gate:
            await self._queue.put(task)
            return await fut

    def cancel_current(self) -> bool:
        """尽力取消当前正在推理的任务（置位 ``tts.stop_flag``）。"""
        task = self._current
        if task is None:
            return False
        task.cancelled.set()
        self._stop_tts()
        return True

    # -- 内部：线程侧 ------------------------------------------------------- #
    def _stop_tts(self) -> None:
        tts = self._tts
        if tts is not None and hasattr(tts, "stop"):
            try:
                tts.stop()
            except Exception:  # pragma: no cover - 运行环境相关
                log.exception("tts.stop() failed")

    def _worker(self) -> None:
        while not self._stopping.is_set():
            task = self._next_task()
            if task is None:
                break
            self._current = task
            try:
                if task.kind == "load":
                    self._do_load(task)
                elif task.kind == "switch":
                    self._do_switch(task)
                elif task.kind == "tts":
                    self._do_tts(task)
            except BaseException as exc:  # noqa: BLE001 - 回传给请求方
                self._fail(task, exc)
            finally:
                self._current = None

    def _next_task(self) -> Optional[_Task]:
        """阻塞获取下一个任务，可被 stop() 唤醒。"""
        fut = asyncio.run_coroutine_threadsafe(self._queue.get(), self._loop)
        while True:
            try:
                return fut.result(timeout=0.5)
            except concurrent.futures.TimeoutError:
                if self._stopping.is_set():
                    return None

    def _resolve(self, task: _Task, value: Any) -> None:
        fut = task.future
        if fut is None:
            return

        def _set() -> None:
            if not fut.done():
                fut.set_result(value)

        self._loop.call_soon_threadsafe(_set)

    def _reject(self, task: _Task, exc: BaseException) -> None:
        fut = task.future
        if fut is None:
            return

        def _set() -> None:
            if not fut.done():
                fut.set_exception(exc)

        self._loop.call_soon_threadsafe(_set)

    def _push(self, task: _Task, item: Any) -> None:
        if task.out_queue is None:
            return
        self._loop.call_soon_threadsafe(self._put_stream, task, item)

    @staticmethod
    def _put_stream(task: _Task, item: Any) -> None:
        """有界入队（在事件循环线程内执行）。

        - 有容器媒体（``wav``/``ogg``/``aac``）：头分片与正文都不可静默丢弃，
          队列满时置 ``overflow`` 并投递 ``STREAM_ABORT``，由
          ``synthesize_stream`` 抛错终止响应（客户端得到明确失败而非坏文件）。
        - ``raw``（无容器）：丢最旧分片，有损但可接受。
        """
        queue = task.out_queue
        if queue is None or task.overflow.is_set():
            return
        try:
            queue.put_nowait(item)
            return
        except asyncio.QueueFull:
            pass

        if task.media_type in _CONTAINER_MEDIA:
            # 绝不让"有正文但没有头"发生：清空后投递 abort 哨兵。
            task.overflow.set()
            while True:
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
            try:
                queue.put_nowait(STREAM_ABORT)
            except asyncio.QueueFull:  # pragma: no cover - 已清空，理论不可达
                pass
        else:
            # raw：无容器，丢最旧分片（有损）。
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:  # pragma: no cover - 竞态兜底
                pass
            try:
                queue.put_nowait(item)
            except asyncio.QueueFull:  # pragma: no cover - 竞态兜底
                pass

    def _fail(self, task: _Task, exc: BaseException) -> None:
        log.exception("Engine task failed: %s", task.kind)
        if task.is_stream and task.out_queue is not None:
            self._push(task, exc)
            self._push(task, STREAM_END)
        else:
            self._reject(task, exc)

    # -- 内部：内核调用 ----------------------------------------------------- #
    def _ensure_loaded(self):
        """在 worker 线程内按需构造 TTS 内核并缓存（线程安全：仅 worker 写）。

        调用方（worker）此时正持有 GPU 门（由请求协程 ``async with`` 保证），故
        构造与推理天然串行。构造失败**不缓存**坏实例并抛出 ``ModelsNotLoadedError``，
        使后续请求可重试。
        """
        if self._tts is not None:
            return self._tts
        try:
            TTS, TTS_Config = _load_tts_classes()
            tts_config = TTS_Config(self._tts_config_path)
            tts = TTS(tts_config)
        except Exception as exc:  # noqa: BLE001 - 明确原因回传
            self._load_error = str(exc)
            raise ModelsNotLoadedError(f"models not loaded: {exc}") from exc
        self._tts = tts
        self._load_error = None
        cfg = getattr(tts, "configs", None)
        log.info(
            "Engine TTS loaded lazily (device=%s, is_half=%s, version=%s)",
            getattr(cfg, "device", "?"),
            getattr(cfg, "is_half", "?"),
            getattr(cfg, "version", "?"),
        )
        return tts

    def _do_load(self, task: _Task) -> None:
        self._ensure_loaded()
        self._resolve(task, None)

    def _do_switch(self, task: _Task) -> None:
        if task.cancelled.is_set():
            self._reject(task, RuntimeError("model switch canceled"))
            return
        self._ensure_loaded()
        if task.sovits_path:
            self._tts.init_vits_weights(task.sovits_path)
        if task.gpt_path:
            self._tts.init_t2s_weights(task.gpt_path)
        cfg = self.configs
        self._resolve(
            task,
            {
                "ok": True,
                "version": getattr(cfg, "version", None) if cfg else None,
                "sovits_path": getattr(cfg, "vits_weights_path", None) if cfg else None,
                "gpt_path": getattr(cfg, "t2s_weights_path", None) if cfg else None,
            },
        )

    def _do_tts(self, task: _Task) -> None:
        if task.cancelled.is_set():
            if task.is_stream and task.out_queue is not None:
                self._push(task, STREAM_END)
            else:
                self._reject(task, RuntimeError("tts canceled"))
            return

        self._ensure_loaded()
        gen = self._tts.run(task.req)

        if task.is_stream and task.out_queue is not None:
            media_type = task.media_type or task.req.get("media_type", "wav")
            first = True
            try:
                for sr, chunk in gen:
                    if task.cancelled.is_set() or task.overflow.is_set():
                        break
                    if first and media_type == "wav":
                        self._push(task, wave_header_chunk(sample_rate=sr))
                        media_type = "raw"
                        first = False
                    self._push(task, pack_audio(chunk, sr, media_type))
            except BaseException as exc:  # noqa: BLE001
                self._push(task, exc)
            finally:
                self._push(task, STREAM_END)
            return

        try:
            sr, audio = next(gen)
        except StopIteration:
            self._reject(task, RuntimeError("tts produced no audio"))
            return
        data = pack_audio(audio, sr, task.media_type or task.req.get("media_type", "wav"))
        self._resolve(task, data)
