"""``/api/references``：参考音频上传与列举。

上传用 ``python-multipart`` 接收文件，落盘到 ``GPT_SOVITS_WORKDIR``（dataDir），
用 ffmpeg 统一转 wav，peaks 优先用 ``soundfile`` 生成，否则用 ``numpy`` 降采样。
"""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import subprocess
import uuid
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(tags=["references"])
log = logging.getLogger("webui_ng.routers.references")


def _data_root() -> str:
    try:
        from config import data_root  # type: ignore

        return data_root
    except Exception:  # pragma: no cover
        return os.environ.get("GPT_SOVITS_WORKDIR") or os.getcwd()


def _ref_dir() -> str:
    try:
        from config import references_root  # type: ignore

        path = references_root
    except Exception:  # pragma: no cover
        path = os.path.join(_data_root(), "references")
    os.makedirs(path, exist_ok=True)
    return path


def _store_path() -> str:
    return os.path.join(_data_root(), "webui_ng_references.json")


def _bound_ref_path(raw: Optional[str]) -> str:
    """把参考音频路径限定在 ``references`` 目录内（越界/缺失 404）。"""
    ref_dir = os.path.realpath(_ref_dir())
    candidate = os.path.realpath(raw) if raw else ""
    if not candidate or (candidate != ref_dir and not candidate.startswith(ref_dir + os.sep)):
        raise HTTPException(status_code=404, detail="reference audio unavailable")
    if not os.path.isfile(candidate):
        raise HTTPException(status_code=404, detail="reference audio file missing")
    return candidate


def _load_store() -> List[Dict[str, Any]]:
    try:
        with open(_store_path(), encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, list):
                return data
    except Exception:
        pass
    return []


def _save_store(items: List[Dict[str, Any]]) -> None:
    with open(_store_path(), "w", encoding="utf-8") as fh:
        json.dump(items, fh, ensure_ascii=False, indent=2)


def _to_wav(src: str, dst: str) -> bool:
    from webui_ng.inference import ffmpeg_exe  # noqa: WPS433

    cmd = [
        ffmpeg_exe(),
        "-y",
        "-i", src,
        "-ac", "1",
        "-ar", "32000",
        "-c:a", "pcm_s16le",
        dst,
    ]
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    except Exception:
        log.exception("ffmpeg invocation failed")
        return False
    return result.returncode == 0 and os.path.isfile(dst)


def _read_mono(path: str) -> Tuple[np.ndarray, int]:
    """读为单声道 float32；优先 soundfile，回退标准库 wave。"""
    try:
        import soundfile as sf  # noqa: WPS433

        data, sr = sf.read(path, dtype="float32", always_2d=True)
        return data.mean(axis=1), int(sr)
    except Exception:
        pass

    import wave  # noqa: WPS433

    with wave.open(path, "rb") as wf:
        n_frames = wf.getnframes()
        channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        rate = wf.getframerate()
        raw = wf.readframes(n_frames)
    if sampwidth == 2:
        arr = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    elif sampwidth == 1:
        arr = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    elif sampwidth == 4:
        arr = np.frombuffer(raw, dtype="<i4").astype(np.float32) / 2147483648.0
    else:
        arr = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        arr = arr.reshape(-1, channels).mean(axis=1)
    return arr, int(rate)


def _compute_peaks(path: str, buckets: int = 200) -> Tuple[List[float], float]:
    mono, sr = _read_mono(path)
    if mono.size == 0:
        return [], 0.0
    duration = float(mono.size) / float(sr) if sr else 0.0
    if mono.size <= buckets:
        peaks = np.abs(mono).astype(float).tolist()
    else:
        idx = np.linspace(0, mono.size, buckets + 1).astype(int)
        peaks = [
            float(np.max(np.abs(mono[idx[i]:idx[i + 1]]))) if idx[i + 1] > idx[i] else 0.0
            for i in range(buckets)
        ]
    maximum = max(peaks) if peaks else 1.0
    if maximum <= 0:
        maximum = 1.0
    return [round(p / maximum, 4) for p in peaks], duration


@router.get("/references")
async def list_references() -> List[Dict[str, Any]]:
    return _load_store()


@router.post("/references")
async def upload_reference(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    lang: Optional[str] = Form(None),
) -> Dict[str, Any]:
    ref_id = uuid.uuid4().hex[:12]
    original_name = file.filename or f"{ref_id}.bin"
    ext = os.path.splitext(original_name)[1] or ".bin"
    src_path = os.path.join(_ref_dir(), f"{ref_id}{ext}")

    with open(src_path, "wb") as out:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)

    wav_path = os.path.join(_ref_dir(), f"{ref_id}.wav")
    final_path = src_path
    if _to_wav(src_path, wav_path):
        final_path = wav_path

    try:
        peaks, duration = _compute_peaks(final_path)
    except Exception:
        log.exception("failed to compute peaks for %s", final_path)
        peaks, duration = [], 0.0

    item: Dict[str, Any] = {
        "id": ref_id,
        "name": name or original_name,
        "path": final_path,
        "peaks": peaks,
        "duration": duration,
        "lang": lang or None,
        "text": text or None,
    }
    items = _load_store()
    items.append(item)
    _save_store(items)
    return item


class ReferencePatch(BaseModel):
    name: Optional[str] = None
    text: Optional[str] = None
    lang: Optional[str] = None


@router.patch("/references/{ref_id}")
async def update_reference(ref_id: str, patch: ReferencePatch) -> Dict[str, Any]:
    """更新参考音频的名称 / 转写文本 / 语言（V3/v5 的 prompt_text 依赖它）。"""
    items = _load_store()
    for item in items:
        if item.get("id") == ref_id:
            if patch.name is not None:
                item["name"] = patch.name
            if patch.text is not None:
                item["text"] = patch.text
            if patch.lang is not None:
                item["lang"] = patch.lang
            _save_store(items)
            return item
    raise HTTPException(status_code=404, detail=f"reference not found: {ref_id}")


@router.get("/references/{ref_id}/audio")
async def get_reference_audio(ref_id: str) -> FileResponse:
    """试听：返回参考音频文件（限定在 references 目录内）。"""
    items = _load_store()
    item = next((x for x in items if x.get("id") == ref_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail=f"reference not found: {ref_id}")
    target = _bound_ref_path(item.get("path"))
    media_type = mimetypes.guess_type(target)[0] or "application/octet-stream"
    return FileResponse(target, media_type=media_type)


@router.delete("/references/{ref_id}")
async def delete_reference(ref_id: str) -> Dict[str, Any]:
    """删除参考音频（store 记录 + 尽力删除文件）。"""
    items = _load_store()
    kept = [x for x in items if x.get("id") != ref_id]
    if len(kept) == len(items):
        raise HTTPException(status_code=404, detail=f"reference not found: {ref_id}")
    _save_store(kept)
    for item in items:
        if item.get("id") == ref_id:
            path = item.get("path")
            try:
                if path and os.path.isfile(path):
                    os.unlink(path)
            except OSError:
                log.warning("failed to unlink reference file: %s", path)
    return {"ok": True}
