"""JobManager：受管子进程 + 进度解析 + 事件环形缓冲 + SSE 广播。

对齐冻结契约（P1）：

- 子进程用 ``asyncio.create_subprocess_exec(..., start_new_session=True)`` 启动，
  使训练脚本（``s2_train.py`` 里的 ``mp.spawn``）拥有独立进程组。
- 读 ``stdout``/``stderr`` → 进度正则 → 事件（``job.log`` / ``job.progress``）。
- 每个 job 维护内存环形缓冲（有界 ``deque``）；事件带**单调递增** ``id``；
  支持 ``Last-Event-ID`` 重放。
- 取消 = ``os.killpg(os.getpgid(pid), SIGTERM)``，超时后 ``SIGKILL``。
- spawn 前**净化** env：移除 ``CUDA_VISIBLE_DEVICES`` / ``MASTER_ADDR`` / ``MASTER_PORT`` /
  ``_CUDA_VISIBLE_DEVICES`` / ``PYTHONPATH`` / ``HF_TOKEN`` / ``HF_ENDPOINT``，并**保留**
  ``*_OFFLINE`` 离线开关（``HF_HUB_OFFLINE`` / ``HF_DATASETS_OFFLINE`` /
  ``TRANSFORMERS_OFFLINE`` / ``MODELSCOPE_OFFLINE``）与 ``HF_HOME``（离线缓存路径），
  再按需注入。

P2 落地数据集流水线的 runner（argv 构造对齐 ``webui.py`` 的 subprocess 调用）：

- ``format`` → ``src/webui_ng/tools/format_batch.py``（编排 1A+1B+1C+合并；各阶段
  脚本经环境变量传参，见 ``webui.py:1074-1205``）
- ``slice``  → ``tools/slice_audio.py``（位置参数）
- ``uvr5``   → ``src/webui_ng/tools/uvr5_batch.py``（原生批处理，复用 ``tools/uvr5``
  模型类，无 gradio）
- ``asr``    → ``tools/asr/{fasterwhisper,funasr}_asr.py``（``-i/-o/-s/-l/-p``）
- ``denoise``→ ``tools/cmd-denoise.py``（``-i/-o/-p``）

P3 落地训练 runner（复刻经典 webui 的"表单→配置→脚本"流程）：

- ``train_s2``      → ``GPT_SoVITS/s2_train.py --config <tmp_s2.json>``（按版本自动选脚本）
- ``train_s2_lora`` → ``GPT_SoVITS/s2_train_v3_lora.py --config <tmp_s2_lora.json>``
- ``train_s1``      → ``GPT_SoVITS/s1_train.py --config_file <tmp_s1.yaml>``

``label``（``tools/subfix_webui.py``）是**常驻 gradio 服务**（``launch(server_port=...)``
永不退出、绑定额外端口、重引 gradio），违反单端口契约，故**不作为 job 子进程**，
在 ``KNOWN_JOB_TYPES`` 登记后以明确的 ``job.failed`` 说明"未实现"占位。

阶段上报：编排脚本在 stdout 打印 ``@@stage:<name>:<index>/<count>@@``，``_handle_line``
解析为 ``job.stage`` 事件（不进入日志），用于表达多步流程（format 的 1A/1B/1C、
uvr5 的逐文件）。
"""

from __future__ import annotations

import asyncio
import codecs
import json
import logging
import os
import re
import signal
import sys
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable, Deque, Dict, List, Optional, Set

log = logging.getLogger("webui_ng.jobs")

# 运行期数据根（内聚布局见 config.py；未设 GPT_SOVITS_DATA_DIR 时保持上游 cwd 相对）。
# 注意：代码/脚本仍按**相对路径**执行（子进程 cwd = 代码根），只有**数据**走这些根。
try:
    from config import (  # type: ignore
        exp_root as _EXP_ROOT,
        output_root as _OUT_ROOT,
        tmp_root as _TMP_ROOT,
        pretrained_models_root as _PRET_ROOT,
    )
except Exception:  # pragma: no cover - 独立运行兜底
    _EXP_ROOT = "logs"
    _OUT_ROOT = "output"
    _TMP_ROOT = "TEMP"
    _PRET_ROOT = "GPT_SoVITS/pretrained_models"

# 通用百分比进度（slice / uvr5 / asr / denoise 的 tqdm 或显式输出均含 `NN%`）。
PROGRESS_RE = re.compile(r"(\d{1,3})\s*%")
# asr 的 tqdm 也可能只给 `X/Y`（当宽度不足时），作为百分比缺失时的回退。
RATIO_RE = re.compile(r"\b(\d+)\s*/\s*(\d+)\b")
# tqdm 进度条特征（`50%|████ | 5/10 [...]`）：只发 job.progress，避免 job.log 刷屏。
PROGRESS_BAR_MARK = "%|"

# 编排脚本上报阶段的标记：`@@stage:<name>:<index>/<count>@@`（见模块 docstring）。
STAGE_RE = re.compile(r"@@stage:([^:@]+):(\d+)/(\d+)@@")

# 每个 SSE 订阅者队列的上界：满时丢最旧事件，慢消费者不拖垮生产者。
SUBSCRIBER_QUEUE_MAXSIZE = 256

# 契约登记的全部 job 类型。
KNOWN_JOB_TYPES = (
    "train_s1",
    "train_s2",
    "train_s2_lora",
    "format",
    "slice",
    "uvr5",
    "asr",
    "denoise",
    "label",
)

# 占 GPU / 模型资源的**批处理**类 job：共享同一个 GPU 门，保证"占卡串行"。
# ``slice`` 是纯 CPU 批处理，不占门（P2 取舍，见返回说明）。
# ``format``/``uvr5``/``asr``/``denoise`` 会加载模型（占卡）并自然结束，占门。
# ``train_*``（P3）长时间占卡，必须与推理/数据流水线共门串行。
_GATED_TYPES = frozenset(
    {"format", "uvr5", "asr", "denoise", "train_s1", "train_s2", "train_s2_lora"}
)

# 允许在 ``_sanitized_env`` 净化**之后** merge 回子进程环境的键白名单。
# 仅由 runner 内部注入（如 format 的 env 传参、按分片的 ``_CUDA_VISIBLE_DEVICES``），
# 不接受用户任意 env，保持"净化后 merge 且仅白名单键"的既有约束。
# 训练侧：``s1_train.py`` 经 ``AR/data/dataset.py`` 读 ``hz``，且经 ``s1_train.py:4-5``
# 读 ``_CUDA_VISIBLE_DEVICES``；AR 训练还依赖模块级 ``version``（``dataset.py:14``，
# 经典 ``webui.py:4`` 在 import 期注入 ``os.environ["version"]``）；其余
# ``pretrained_s2D``/``if_save_latest`` 等由 runner 写入**配置文件**（经典 webui 亦如此），
# 这里一并登记以向前兼容。
_INJECTABLE_ENV = frozenset(
    {
        "inp_text",
        "inp_wav_dir",
        "exp_name",
        "opt_dir",
        "bert_pretrained_dir",
        "cnhubert_base_dir",
        "pretrained_s2G",
        "s2config_path",
        "sv_path",
        "i_part",
        "all_parts",
        "is_half",
        "version",
        "cuda_visible_devices",
        "_CUDA_VISIBLE_DEVICES",
        "hz",
        "pretrained_s1",
        "pretrained_s2D",
        "if_save_latest",
    }
)


def _config_default(name: str, default: Any) -> Any:
    """读取已导入的 ``config`` 模块属性作为默认值（不触发 torch 重导入）。"""
    mod = sys.modules.get("config")
    if mod is not None and hasattr(mod, name):
        return getattr(mod, name)
    return default


def _progress_fraction(job_type: str, text: str) -> Optional[float]:
    """从一行输出解析进度比例（0..1）；解析不到返回 ``None``。"""
    match = PROGRESS_RE.search(text)
    if match:
        return max(0.0, min(1.0, int(match.group(1)) / 100.0))
    # asr / 训练的 tqdm 也可能只给 ``X/Y``（当宽度不足时），作为百分比缺失时的回退。
    if (job_type == "asr" or job_type.startswith("train")) and "|" in text:
        ratio = RATIO_RE.search(text)
        if ratio:
            total = int(ratio.group(2))
            if total > 0:
                return max(0.0, min(1.0, int(ratio.group(1)) / total))
    # 训练日志中的显式 ``step X/Y``（如 lightning 的 ``Epoch x: 42%|`` 之外的行）。
    if job_type.startswith("train") and "step" in text.lower():
        ratio = RATIO_RE.search(text)
        if ratio:
            total = int(ratio.group(2))
            if total > 0:
                return max(0.0, min(1.0, int(ratio.group(1)) / total))
    return None


def sse_format(event: Dict[str, Any]) -> str:
    """把内部事件字典序列化为 SSE 帧（含单调 ``id:``）。"""
    payload = {k: v for k, v in event.items() if k != "id"}
    data = json.dumps(payload, ensure_ascii=False)
    return f"id: {event['id']}\ndata: {data}\n\n"


def _sanitized_env(workdir: str) -> Dict[str, str]:
    """净化并重建子进程环境。

    离线场景依赖 ``*_OFFLINE`` 开关与 ``HF_HOME`` 缓存路径，故采用白名单保留；
    其余 ``HF_*``（``HF_TOKEN`` / ``HF_ENDPOINT`` 等）以及 CUDA/MASTER/PYTHONPATH
    一律剔除后重建。
    """
    env: Dict[str, str] = {}
    for key, value in os.environ.items():
        if key.endswith("_OFFLINE") or key == "HF_HOME":
            env[key] = value
        elif key.startswith("HF_"):
            continue  # HF_TOKEN / HF_ENDPOINT 等
        else:
            env[key] = value
    for key in (
        "CUDA_VISIBLE_DEVICES",
        "MASTER_ADDR",
        "MASTER_PORT",
        "_CUDA_VISIBLE_DEVICES",
        "PYTHONPATH",
    ):
        env.pop(key, None)
    env["PYTHONPATH"] = os.pathsep.join(
        [
            workdir,
            os.path.join(workdir, "GPT_SoVITS", "BigVGAN"),
            os.path.join(workdir, "tools"),
            os.path.join(workdir, "tools", "asr"),
            os.path.join(workdir, "GPT_SoVITS"),
            os.path.join(workdir, "tools", "uvr5"),
        ]
    )
    env.setdefault("G2PW", "0")
    return env


@dataclass
class Job:
    id: str
    type: str
    params: Dict[str, Any] = field(default_factory=dict)
    status: str = "pending"  # pending | running | done | failed | canceled
    stage: Optional[str] = None
    stageIndex: Optional[int] = None
    stageCount: Optional[int] = None
    createdAt: float = field(default_factory=time.time)
    startedAt: Optional[float] = None
    finishedAt: Optional[float] = None
    exitCode: Optional[int] = None
    error: Optional[str] = None
    events: Deque[Dict[str, Any]] = field(default_factory=deque)
    # runner 额外注入子进程的 env（如 format 的 1-get-text.py 全部经环境变量传参）；
    # 在 ``_sanitized_env`` 之后再 merge，但**仅限 ``_INJECTABLE_ENV`` 白名单键**，
    # 可覆盖被净化的键（如按分片的 ``_CUDA_VISIBLE_DEVICES``），不开放任意 env。
    env: Dict[str, str] = field(default_factory=dict)
    # 终态事件（done/failed/canceled）是否已发；用于消除 cancel 与 _spawn 的竞态重复。
    terminal_emitted: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "status": self.status,
            "stage": self.stage,
            "stageIndex": self.stageIndex,
            "stageCount": self.stageCount,
            "params": self.params,
            "createdAt": self.createdAt,
            "startedAt": self.startedAt,
            "finishedAt": self.finishedAt,
            "exitCode": self.exitCode,
            "error": self.error,
        }


# --- job argv 构造器 -------------------------------------------------------- #
def _slice_argv(job: Job, workdir: str, python: str) -> List[str]:
    p = job.params
    inp = p.get("inp") or p.get("input") or p.get("audio") or p.get("path")
    if not inp:
        raise ValueError("slice job requires an 'inp' param (input audio path)")
    opt_root = p.get("opt_root") or p.get("out") or os.path.join(
        _OUT_ROOT, "slicer_opt"
    )
    os.makedirs(opt_root, exist_ok=True)
    job.stage = "slice"
    job.stageIndex = 0
    job.stageCount = 1
    return [
        python,
        "-s",
        "tools/slice_audio.py",
        str(inp),
        str(opt_root),
        str(p.get("threshold", -34)),
        str(p.get("min_length", 4000)),
        str(p.get("min_interval", 300)),
        str(p.get("hop_size", 10)),
        str(p.get("max_sil_kept", 500)),
        str(p.get("_max") or p.get("max_amplitude") or p.get("max") or 0.9),
        str(p.get("alpha", 0.25)),
        str(p.get("i_part", 0)),
        str(p.get("all_part", 1)),
    ]


def _format_argv(job: Job, workdir: str, python: str) -> List[str]:
    """训练集格式化一键三连：编排脚本 ``format_batch.py``，参数经环境变量传入。

    对齐 ``webui.py:1074-1205``：1A/1B/1C 三阶段各自读取的 env 键不同，这里一次性
    把全部键注入，由编排脚本按阶段分派（并负责分片合并与逐分片 ``_CUDA_VISIBLE_DEVICES``）。
    """
    p = job.params
    inp_text = p.get("inp_text") or p.get("text_list") or p.get("list_path")
    inp_wav_dir = p.get("inp_wav_dir") or p.get("wav_dir") or p.get("audio_dir")
    if not inp_text:
        raise ValueError("format job requires an 'inp_text' param (path to a .list file)")
    if not inp_wav_dir:
        raise ValueError("format job requires an 'inp_wav_dir' param (input wav dir)")
    exp_name = str(p.get("exp_name") or "exp").rstrip()
    opt_dir = p.get("opt_dir") or os.path.join(_EXP_ROOT, exp_name)
    bert = p.get("bert_pretrained_dir") or os.path.join(
        _PRET_ROOT, "chinese-roberta-wwm-ext-large"
    )
    cnhubert = p.get("cnhubert_base_dir") or os.path.join(
        _PRET_ROOT, "chinese-hubert-base"
    )
    version = p.get("version")
    version_str = str(version) if version else ""
    s2config = p.get("s2config_path") or (
        "GPT_SoVITS/configs/s2.json"
        if version_str not in {"v2Pro", "v2ProPlus"}
        else f"GPT_SoVITS/configs/s2{version_str}.json"
    )
    s2g = p.get("pretrained_s2G") or p.get("pretrained_s2G_path") or p.get("s2G") or os.path.join(
        _PRET_ROOT, "s2G488k.pth"
    )
    # Pro 版 SV 权重（webui.py:866 的 sv_path 默认值）；非 Pro 阶段不会读取，但一并注入无害。
    sv = p.get("sv_path") or os.path.join(
        _PRET_ROOT,
        "sv",
        "pretrained_eres2netv2w24s4ep4.ckpt",
    )
    is_half = p.get("is_half")
    if is_half is None:
        is_half = bool(_config_default("is_half", True))
    all_parts = int(p.get("all_parts", 1))
    # 对齐 webui.py:800-806：编排脚本按 i_part 注入 ``_CUDA_VISIBLE_DEVICES``。
    # 这里把多卡列表原样透传（编排脚本负责拆分），缺省则按 i_part 取 ``str(i_part)``。
    gpu_numbers = p.get("cuda_visible_devices") or p.get("gpu_numbers") or p.get("gpu")
    job.stage = "format"
    job.stageIndex = 0
    # 首帧 stageCount 与 format_batch.py 的阶段数一致（Pro 多一个 SV 阶段），
    # 消除首帧抖动（后续 stage 标记会再校正）。
    job.stageCount = 4 if version_str in {"v2Pro", "v2ProPlus"} else 3
    job.env.update(
        {
            "inp_text": str(inp_text),
            "inp_wav_dir": str(inp_wav_dir),
            "exp_name": exp_name,
            "opt_dir": str(opt_dir),
            "bert_pretrained_dir": str(bert),
            "cnhubert_base_dir": str(cnhubert),
            "pretrained_s2G": str(s2g),
            "s2config_path": str(s2config),
            "sv_path": str(sv),
            "all_parts": str(all_parts),
            "is_half": "True" if is_half else "False",
        }
    )
    if version:
        job.env["version"] = version_str
    if gpu_numbers:
        job.env["cuda_visible_devices"] = str(gpu_numbers)
    return [python, "-s", "src/webui_ng/tools/format_batch.py"]


def _uvr5_argv(job: Job, workdir: str, python: str) -> List[str]:
    """原生 uvr5 批处理：``src/webui_ng/tools/uvr5_batch.py``（无 gradio）。"""
    p = job.params
    inp = (
        p.get("input_dir")
        or p.get("inp_dir")
        or p.get("input")
        or p.get("inp")
        or p.get("input_folder")
    )
    if not inp:
        raise ValueError("uvr5 job requires an 'input_dir' param (input audio dir/file)")
    model = p.get("model_name") or p.get("model")
    if not model:
        raise ValueError("uvr5 job requires a 'model_name' param")
    vocal = p.get("output_vocal") or p.get("vocal_dir") or os.path.join(
        _OUT_ROOT, "uvr5_opt", "vocal"
    )
    ins = p.get("output_ins") or p.get("ins_dir") or os.path.join(
        _OUT_ROOT, "uvr5_opt", "ins"
    )
    os.makedirs(vocal, exist_ok=True)
    os.makedirs(ins, exist_ok=True)
    device = p.get("device") or _config_default("infer_device", "cpu")
    is_half = p.get("is_half")
    if is_half is None:
        is_half = bool(_config_default("is_half", False))
    job.stage = "uvr5"
    job.stageIndex = 0
    job.stageCount = 1
    argv = [
        python,
        "-s",
        "src/webui_ng/tools/uvr5_batch.py",
        "--input",
        str(inp),
        "--output-vocal",
        str(vocal),
        "--output-ins",
        str(ins),
        "--model",
        str(model),
        "--agg",
        str(p.get("agg", 10)),
        "--format",
        str(p.get("format", "flac")),
        "--device",
        str(device),
    ]
    if is_half:
        argv.append("--is-half")
    return argv


def _resolve_asr_script(p: Dict[str, Any]) -> str:
    """解析 ASR 脚本路径：显式 ``model_path`` > ``asr_dict[model]['path']`` > 默认。"""
    explicit = p.get("model_path") or p.get("script")
    if explicit:
        text = str(explicit)
        return text if text.startswith("tools/") else f"tools/asr/{text}"
    model = p.get("model")
    if model:
        try:
            from tools.asr.config import asr_dict

            entry = asr_dict.get(model)
            if entry:
                return f"tools/asr/{entry['path']}"
        except Exception:  # noqa: BLE001 - 解析失败则回退默认脚本
            pass
    return "tools/asr/fasterwhisper_asr.py"


def _asr_argv(job: Job, workdir: str, python: str) -> List[str]:
    """``tools/asr/{fasterwhisper,funasr}_asr.py``：``-i -o -s -l -p``。"""
    p = job.params
    inp = p.get("inp_dir") or p.get("input_folder") or p.get("inp") or p.get("input")
    if not inp:
        raise ValueError("asr job requires an 'inp_dir' param (input folder)")
    opt = p.get("opt_dir") or p.get("output_folder") or os.path.join(
        _OUT_ROOT, "asr_opt"
    )
    os.makedirs(opt, exist_ok=True)
    job.stage = "asr"
    job.stageIndex = 0
    job.stageCount = 1
    return [
        python,
        "-s",
        _resolve_asr_script(p),
        "-i",
        str(inp),
        "-o",
        str(opt),
        "-s",
        str(p.get("model_size", "large-v3")),
        "-l",
        str(p.get("language", "auto")),
        "-p",
        str(p.get("precision", "float32")),
    ]


def _denoise_argv(job: Job, workdir: str, python: str) -> List[str]:
    """``tools/cmd-denoise.py``：``-i -o -p``。"""
    p = job.params
    inp = p.get("inp_dir") or p.get("input_folder") or p.get("inp") or p.get("input")
    if not inp:
        raise ValueError("denoise job requires an 'inp_dir' param (input folder)")
    opt = p.get("opt_dir") or p.get("output_folder") or os.path.join(
        _OUT_ROOT, "denoise_opt"
    )
    os.makedirs(opt, exist_ok=True)
    job.stage = "denoise"
    job.stageIndex = 0
    job.stageCount = 1
    return [
        python,
        "-s",
        "tools/cmd-denoise.py",
        "-i",
        str(inp),
        "-o",
        str(opt),
        "-p",
        str(p.get("precision", "float16")),
    ]


# --- P3：训练 runner -------------------------------------------------------- #
#
# 经典 webui（``webui.py:490-545`` 的 ``open1Ba`` / ``:591-637`` 的 ``open1Bb``）是
# **从表单生成 yaml/json 配置**再跑训练脚本；这里复刻同样的配置生成（读取
# ``GPT_SoVITS/configs/`` 模板 → 打补丁 → 写入 ``<workdir>/tmp/``），再以
# ``--config`` / ``--config_file`` 传入脚本。这样 argv 与经典完全一致。
#
# 训练脚本自设分布式环境：``s2_train.py:62-65`` 自设 ``MASTER_ADDR=localhost`` +
# 随机 ``MASTER_PORT`` 并 ``mp.spawn``；``_sanitized_env`` 已剔除 ``MASTER_*``，
# 保持其自设行为正确。``s2_train.py:9`` / ``s2_train_v3_lora.py:10`` 用配置里的
# ``train.gpu_numbers`` 覆盖 ``CUDA_VISIBLE_DEVICES``，故无需注入。``s1_train.py:4-5``
# 读 ``_CUDA_VISIBLE_DEVICES``，需由 runner 注入。
_V3V4SET = {"v3", "v4", "v5dev", "v5turbo"}
_PRO_SET = {"v2Pro", "v2ProPlus"}


def _weight_root_for(version: str, kind: str) -> str:
    """版本 → 权重保存目录（对齐 ``config.py`` 的 ``*_weight_version2root``）。"""
    key = "SoVITS_weight_version2root" if kind == "sovits" else "GPT_weight_version2root"
    mapping = _config_default(key, {})
    fallback = "SoVITS_weights" if kind == "sovits" else "GPT_weights"
    return str(mapping.get(version, fallback))


def _pretrained_default(version: str, kind: str) -> str:
    """版本 → 底模权重路径（对齐 ``config.py`` 的 ``pretrained_{sovits,gpt}_name``）。"""
    key = "pretrained_sovits_name" if kind == "sovits" else "pretrained_gpt_name"
    mapping = _config_default(key, {})
    return str(mapping.get(version, ""))


def _write_config(workdir: str, name: str, data: Any, fmt: str) -> str:
    """把生成的训练配置写入 ``<tmp_root>/<name>``（对齐经典 ``tmp/tmp_s*.{json,yaml}``）。"""
    tmp_dir = os.path.join(_TMP_ROOT)
    os.makedirs(tmp_dir, exist_ok=True)
    path = os.path.join(tmp_dir, name)
    with open(path, "w", encoding="utf-8") as f:
        if fmt == "json":
            import json

            json.dump(data, f, ensure_ascii=False)
        else:
            import yaml

            yaml.safe_dump(data, f, default_flow_style=False, allow_unicode=True)
    return path


def _resolve_half(p: Dict[str, Any]) -> bool:
    is_half = p.get("is_half")
    if is_half is None:
        return bool(_config_default("is_half", True))
    return bool(is_half)


def _require_version(p: Dict[str, Any], job_type: str) -> str:
    version = p.get("version")
    if not version:
        raise ValueError(f"{job_type} job requires a 'version' param (e.g. v2, v2Pro, v3)")
    return str(version)


def _train_s2_common(job: Job, workdir: str, python: str, force_lora: bool) -> List[str]:
    """生成 s2 / s2_lora 配置并返回 argv（对齐 ``webui.py:508-545``）。"""
    p = job.params
    version = _require_version(p, job.type)
    exp_name = str(p.get("exp_name") or "exp").rstrip()
    s2_dir = os.path.join(_EXP_ROOT, exp_name)
    os.makedirs(os.path.join(s2_dir, f"logs_s2_{version}"), exist_ok=True)

    template = os.path.join(
        workdir,
        "GPT_SoVITS",
        "configs",
        "s2.json" if version not in _PRO_SET else f"s2{version}.json",
    )
    import json

    with open(template, encoding="utf-8") as f:
        data = json.loads(f.read())

    is_half = _resolve_half(p)
    batch_size = int(p.get("batch_size", 1))
    if not is_half:
        # 对齐 webui.py:520-522：fp16 关闭时 batch_size 减半（至少 1）。
        data["train"]["fp16_run"] = False
        batch_size = max(1, batch_size // 2)

    s2g = p.get("pretrained_s2G") or _pretrained_default(version, "sovits")
    s2d = p.get("pretrained_s2D")
    if not s2d:
        # 对齐 webui.py:1523：非 v3/v4 时 s2D 由 s2G 路径替换 s2G→s2D 得到。
        s2d = s2g.replace("s2G", "s2D") if (s2g and version not in _V3V4SET) else ""

    data["train"]["batch_size"] = batch_size
    data["train"]["epochs"] = int(p.get("total_epoch", 8))
    data["train"]["text_low_lr_rate"] = float(p.get("text_low_lr_rate", 0.4))
    data["train"]["pretrained_s2G"] = s2g
    data["train"]["pretrained_s2D"] = s2d
    data["train"]["if_save_latest"] = bool(p.get("if_save_latest", True))
    data["train"]["if_save_every_weights"] = bool(p.get("if_save_every_weights", True))
    data["train"]["save_every_epoch"] = int(p.get("save_every_epoch", 1))
    data["train"]["gpu_numbers"] = str(p.get("gpu_numbers") or "0")
    data["train"]["grad_ckpt"] = bool(p.get("if_grad_ckpt", False))
    data["train"]["lora_rank"] = str(p.get("lora_rank", "32"))
    if p.get("learning_rate") is not None:
        data["train"]["learning_rate"] = float(p["learning_rate"])
    data["model"]["version"] = version
    data["data"]["exp_dir"] = s2_dir
    data["s2_ckpt_dir"] = s2_dir
    data["save_weight_dir"] = _weight_root_for(version, "sovits")
    data["name"] = exp_name
    data["version"] = version

    lora = force_lora or version in _V3V4SET
    config_name = "tmp_s2_lora.json" if lora else "tmp_s2.json"
    config_path = _write_config(workdir, config_name, data, "json")
    # 对齐 webui.py:542-545：v1/v2/v2Pro/v2ProPlus → s2_train.py；其余 → v3 LoRA 脚本。
    script = "GPT_SoVITS/s2_train_v3_lora.py" if lora else "GPT_SoVITS/s2_train.py"
    job.stage = "s2_lora" if lora else "s2"
    job.stageIndex = 0
    job.stageCount = 1
    return [python, "-s", script, "--config", config_path]


def _train_s2_argv(job: Job, workdir: str, python: str) -> List[str]:
    """SoVITS 微调：按版本自动选脚本（经典 ``open1Ba`` 行为）。"""
    return _train_s2_common(job, workdir, python, force_lora=False)


def _train_s2_lora_argv(job: Job, workdir: str, python: str) -> List[str]:
    """SoVITS v3/v4/v5 LoRA 微调：强制 ``s2_train_v3_lora.py``。"""
    return _train_s2_common(job, workdir, python, force_lora=True)


def _train_s1_argv(job: Job, workdir: str, python: str) -> List[str]:
    """GPT（s1）微调：生成 yaml 配置并返回 argv（对齐 ``webui.py:605-637``）。"""
    p = job.params
    version = _require_version(p, job.type)
    exp_name = str(p.get("exp_name") or "exp").rstrip()
    s1_dir = os.path.join(_EXP_ROOT, exp_name)
    os.makedirs(os.path.join(s1_dir, "logs_s1"), exist_ok=True)

    template = os.path.join(
        workdir,
        "GPT_SoVITS",
        "configs",
        "s1longer.yaml" if version == "v1" else "s1longer-v2.yaml",
    )
    import yaml

    with open(template, encoding="utf-8") as f:
        data = yaml.safe_load(f.read())

    is_half = _resolve_half(p)
    batch_size = int(p.get("batch_size", 1))
    if not is_half:
        # 对齐 webui.py:614-616：半精度关闭时 precision=32、batch_size 减半。
        data["train"]["precision"] = "32"
        batch_size = max(1, batch_size // 2)

    data["train"]["batch_size"] = batch_size
    data["train"]["epochs"] = int(p.get("total_epoch", 15))
    data["train"]["save_every_n_epoch"] = int(p.get("save_every_epoch", 5))
    data["train"]["if_save_every_weights"] = bool(p.get("if_save_every_weights", True))
    data["train"]["if_save_latest"] = bool(p.get("if_save_latest", True))
    data["train"]["if_dpo"] = bool(p.get("if_dpo", False))
    data["train"]["half_weights_save_dir"] = _weight_root_for(version, "gpt")
    data["train"]["exp_name"] = exp_name
    if p.get("learning_rate") is not None:
        data.setdefault("optimizer", {})["lr"] = float(p["learning_rate"])
    data["pretrained_s1"] = p.get("pretrained_s1") or _pretrained_default(version, "gpt")
    data["train_semantic_path"] = os.path.join(s1_dir, "6-name2semantic.tsv")
    data["train_phoneme_path"] = os.path.join(s1_dir, "2-name2text.txt")
    data["output_dir"] = os.path.join(s1_dir, f"logs_s1_{version}")

    config_path = _write_config(workdir, "tmp_s1.yaml", data, "yaml")
    # s1_train.py:4-5 读 ``_CUDA_VISIBLE_DEVICES``；AR 数据集读 ``hz``（dataset.py:91）。
    # AR 训练经 ``AR/data/dataset.py:14`` 读模块级 ``version`` 并据此选音素符号表
    # （``GPT_SoVITS/text/__init__.py:21-23``）；经典 ``webui.py:4`` 在 import 期设
    # ``os.environ["version"]`` 由子进程继承，webui_ng 以 job 子进程运行故须显式注入。
    # s2 脚本自解 ``hps.model.version``，唯 s1 依赖 env 注入。
    gpu_numbers = str(p.get("gpu_numbers") or "0").replace("-", ",")
    job.env["_CUDA_VISIBLE_DEVICES"] = gpu_numbers
    job.env["hz"] = "25hz"
    job.env["version"] = version
    job.stage = "s1"
    job.stageIndex = 0
    job.stageCount = 1
    return [python, "-s", "GPT_SoVITS/s1_train.py", "--config_file", config_path]


Runners = Dict[str, Callable[[Job, str, str], List[str]]]
_RUNNERS: "Runners" = {
    "format": _format_argv,
    "slice": _slice_argv,
    "uvr5": _uvr5_argv,
    "asr": _asr_argv,
    "denoise": _denoise_argv,
    "train_s1": _train_s1_argv,
    "train_s2": _train_s2_argv,
    "train_s2_lora": _train_s2_lora_argv,
}

# 未实现（占位）类型的明确失败文案。``label`` 是常驻 gradio 服务
# （``launch(server_port=...)`` 永不退出，且会重引 gradio、绑定额外端口），
# 违反单端口契约，故**不作为 job 子进程**。
_NOT_IMPLEMENTED: Dict[str, str] = {
    "label": "label 在 webui-ng 尚未实现（not implemented；请暂用经典 webui.py）",
}
_DEFAULT_NOT_IMPLEMENTED = "job type '{t}' is registered but not implemented"


class JobManager:
    """子进程任务管理器（单事件循环内使用）。"""

    def __init__(
        self,
        workdir: str,
        python_executable: Optional[str] = None,
        max_events: int = 1000,
        gpu_gate: Optional["asyncio.Semaphore"] = None,
        sigkill_delay: float = 5.0,
    ):
        self.workdir = workdir
        self.python = (
            python_executable
            or os.environ.get("GPT_SOVITS_PYTHON")
            or sys.executable
        )
        self.max_events = max(1, int(max_events))
        self._jobs: Dict[str, Job] = {}
        self._procs: Dict[str, "asyncio.subprocess.Process"] = {}
        self._subscribers: Dict[str, Set["asyncio.Queue[Any]"]] = {}
        self._global_subscribers: Set["asyncio.Queue[Any]"] = set()
        self._global_events: Deque[Dict[str, Any]] = deque(maxlen=self.max_events)
        self._seq = 0
        # 与 Engine 共享的 GPU 门（由 app.py lifespan 注入），保证"占卡串行"。
        self._gpu = gpu_gate if gpu_gate is not None else asyncio.Semaphore(1)
        # SIGTERM 后升级 SIGKILL 的等待秒数（可注入以便测试）。
        self._sigkill_delay = max(0.0, float(sigkill_delay))
        # 持有 fire-and-forget 任务引用，避免被 GC 提前回收。
        self._tasks: Set["asyncio.Task[Any]"] = set()

    def _spawn_task(self, coro) -> "asyncio.Task[Any]":
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task

    # -- 查询 --------------------------------------------------------------- #
    def list_jobs(self) -> List[Dict[str, Any]]:
        return [j.to_dict() for j in self._jobs.values()]

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        job = self._jobs.get(job_id)
        return job.to_dict() if job is not None else None

    def replay(self, job_id: Optional[str], last_event_id: int = 0) -> List[Dict[str, Any]]:
        if job_id is None:
            src = list(self._global_events)
        else:
            job = self._jobs.get(job_id)
            src = list(job.events) if job is not None else []
        return [e for e in src if e["id"] > last_event_id]

    # -- 订阅 --------------------------------------------------------------- #
    def subscribe(self, job_id: Optional[str]) -> "asyncio.Queue[Any]":
        q: "asyncio.Queue[Any]" = asyncio.Queue(maxsize=SUBSCRIBER_QUEUE_MAXSIZE)
        if job_id is None:
            self._global_subscribers.add(q)
        else:
            self._subscribers.setdefault(job_id, set()).add(q)
        return q

    def unsubscribe(self, q: "asyncio.Queue[Any]", job_id: Optional[str]) -> None:
        if job_id is None:
            self._global_subscribers.discard(q)
        else:
            subs = self._subscribers.get(job_id)
            if subs is not None:
                subs.discard(q)
                if not subs:
                    self._subscribers.pop(job_id, None)

    # -- 创建 / 取消 -------------------------------------------------------- #
    async def create(self, job_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        job = Job(
            id=uuid.uuid4().hex[:12],
            type=job_type,
            params=dict(params or {}),
            events=deque(maxlen=self.max_events),
        )
        self._jobs[job.id] = job
        self._emit(job, {"type": "job.created"})
        self._spawn_task(self._run(job))
        return job.to_dict()

    async def cancel(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if job is None:
            return False
        if job.status in ("done", "failed", "canceled"):
            return False
        job.status = "canceled"
        proc = self._procs.get(job_id)
        if proc is not None and proc.returncode is None:
            self._kill_group(proc)
        else:
            # 尚未 spawn：_run 会观察到 canceled 状态而不再启动。
            job.finishedAt = time.time()
            self._emit_terminal(job, {"type": "job.canceled"})
        return True

    # -- 内部 --------------------------------------------------------------- #
    def _emit(self, job: Job, event: Dict[str, Any]) -> None:
        self._seq += 1
        ev = dict(event)
        ev["jobId"] = job.id
        ev["ts"] = time.time()
        ev["id"] = self._seq
        if job.stage is not None:
            ev.setdefault("stage", job.stage)
        if job.stageIndex is not None:
            ev.setdefault("stageIndex", job.stageIndex)
        if job.stageCount is not None:
            ev.setdefault("stageCount", job.stageCount)
        job.events.append(ev)
        self._global_events.append(ev)
        for q in list(self._subscribers.get(job.id, ())):
            self._deliver(q, ev)
        for q in list(self._global_subscribers):
            self._deliver(q, ev)

    @staticmethod
    def _deliver(queue: "asyncio.Queue[Any]", event: Dict[str, Any]) -> None:
        """有界投递：满时丢最旧事件，避免慢消费者阻塞生产者。"""
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:  # pragma: no cover - 竞态兜底
                pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:  # pragma: no cover - 竞态兜底
                pass

    def _emit_terminal(self, job: Job, event: Dict[str, Any]) -> None:
        """终态事件（done/failed/canceled）只发一次。

        消除 ``cancel()``（proc 尚未注册时立即 emit）与 ``_spawn``（末尾 emit）
        的竞态导致的重复 ``job.canceled``。
        """
        if job.terminal_emitted:
            return
        job.terminal_emitted = True
        self._emit(job, event)

    def _kill_group(self, proc: "asyncio.subprocess.Process") -> None:
        pid = proc.pid
        try:
            pgid = os.getpgid(pid)
        except ProcessLookupError:
            return
        try:
            os.killpg(pgid, signal.SIGTERM)
        except ProcessLookupError:
            return

        async def _sigkill_later() -> None:
            await asyncio.sleep(self._sigkill_delay)
            # NB3：进程已退出时其 pgid 可能被复用，绝不 killpg。
            if proc.returncode is not None:
                return
            try:
                if os.getpgid(pid) != pgid:
                    return
            except ProcessLookupError:
                return
            try:
                os.killpg(pgid, signal.SIGKILL)
            except ProcessLookupError:
                pass

        self._spawn_task(_sigkill_later())

    async def _run(self, job: Job) -> None:
        runner = _RUNNERS.get(job.type)
        if runner is None:
            if job.status == "canceled":
                return
            job.status = "failed"
            job.error = _NOT_IMPLEMENTED.get(
                job.type, _DEFAULT_NOT_IMPLEMENTED.format(t=job.type)
            )
            job.finishedAt = time.time()
            self._emit_terminal(job, {"type": "job.failed", "error": job.error})
            return

        if job.type in _GATED_TYPES:
            async with self._gpu:
                await self._execute(job, runner)
        else:
            await self._execute(job, runner)

    async def _execute(self, job: Job, runner) -> None:
        if job.status == "canceled":
            return
        try:
            argv = runner(job, self.workdir, self.python)
        except Exception as exc:  # noqa: BLE001
            job.status = "failed"
            job.error = str(exc)
            job.finishedAt = time.time()
            self._emit_terminal(job, {"type": "job.failed", "error": job.error})
            return
        await self._spawn(job, argv)

    async def _spawn(self, job: Job, argv: List[str]) -> None:
        env = _sanitized_env(self.workdir)
        # runner 注入的 env 在净化之后 merge；仅允许白名单键（如 format 的
        # 1-get-text.py 传参、按分片的 ``_CUDA_VISIBLE_DEVICES``），不开放任意 env。
        if job.env:
            for key, value in job.env.items():
                if str(key) in _INJECTABLE_ENV:
                    env[str(key)] = str(value)
        job.status = "running"
        job.startedAt = time.time()
        self._emit(
            job,
            {
                "type": "job.stage",
                "stage": job.stage,
                "stageIndex": job.stageIndex,
                "stageCount": job.stageCount,
            },
        )
        try:
            proc = await asyncio.create_subprocess_exec(
                *argv,
                cwd=self.workdir,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=True,
            )
        except Exception as exc:  # noqa: BLE001
            job.status = "failed"
            job.error = str(exc)
            job.finishedAt = time.time()
            self._emit_terminal(job, {"type": "job.failed", "error": job.error})
            return

        self._procs[job.id] = proc
        if job.status == "canceled":
            # NB2：cancel() 可能在 create 期间命中（彼时 proc 尚未注册），此处补杀，
            # 且终态事件由 _emit_terminal 去重，不会重复 emit。
            self._kill_group(proc)
        pumps = [
            self._spawn_task(self._pump(job, proc.stdout, "stdout")),
            self._spawn_task(self._pump(job, proc.stderr, "stderr")),
        ]
        rc = await proc.wait()
        await asyncio.gather(*pumps, return_exceptions=True)
        self._procs.pop(job.id, None)

        job.exitCode = rc
        job.finishedAt = time.time()
        if job.status == "canceled":
            self._emit_terminal(job, {"type": "job.canceled", "exitCode": rc})
        elif rc == 0:
            job.status = "done"
            self._emit_terminal(job, {"type": "job.done", "exitCode": rc})
        else:
            job.status = "failed"
            job.error = f"process exited with code {rc}"
            self._emit_terminal(
                job, {"type": "job.failed", "error": job.error, "exitCode": rc}
            )

    async def _pump(self, job: Job, stream, name: str) -> None:
        """按块读取 stdout/stderr，同时以 ``\\n`` 与 ``\\r`` 断行。

        tqdm 等进度条用 ``\\r`` 原地刷新且不换行，``readline()`` 无法及时返回；
        按块读 + 双分隔符可在流式场景下实时拿到 ``NN%`` 进度。

        使用**增量 UTF-8 解码器**：多字节字符可能跨 4096 字节块边界，逐块
        ``decode`` 会截断出 U+FFFD；增量解码器会缓存不完整序列到下一块。
        """
        if stream is None:
            return
        decoder = codecs.getincrementaldecoder("utf-8")("replace")
        buf = ""
        while True:
            chunk = await stream.read(4096)
            if not chunk:
                break
            buf += decoder.decode(chunk)
            while True:
                nl = buf.find("\n")
                cr = buf.find("\r")
                if nl == -1 and cr == -1:
                    break
                if nl != -1 and (cr == -1 or nl < cr):
                    idx, skip = nl, 1
                else:
                    idx, skip = cr, 1
                    if buf[idx + 1 : idx + 2] == "\n":
                        skip = 2  # CRLF 视作单个分隔符
                line, buf = buf[:idx], buf[idx + skip :]
                self._handle_line(job, name, line)
            if len(buf) > 1_000_000:  # 超长无换行输出兜底，避免无界增长
                self._handle_line(job, name, buf)
                buf = ""
        buf += decoder.decode(b"", final=True)  # 冲刷残留的不完整序列
        if buf:
            self._handle_line(job, name, buf)

    def _handle_line(self, job: Job, name: str, text: str) -> None:
        text = text.rstrip("\r\n")
        if not text.strip():
            return
        stage = STAGE_RE.search(text)
        if stage:
            # 编排脚本上报的多步阶段（如 format 的 1A/1B/1C、uvr5 的逐文件）。
            job.stage = stage.group(1)
            job.stageIndex = int(stage.group(2))
            job.stageCount = int(stage.group(3))
            self._emit(
                job,
                {
                    "type": "job.stage",
                    "stage": job.stage,
                    "stageIndex": job.stageIndex,
                    "stageCount": job.stageCount,
                },
            )
            return
        is_progress_bar = PROGRESS_BAR_MARK in text
        if not is_progress_bar:
            self._emit(
                job,
                {
                    "type": "job.log",
                    "log": {"stream": name, "text": text, "ansi": True},
                },
            )
        progress = _progress_fraction(job.type, text)
        if progress is not None:
            self._emit(job, {"type": "job.progress", "progress": progress})
