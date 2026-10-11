"""``/api/system`` 与 ``/api/settings``（最小实现）。"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

from fastapi import APIRouter, Request

from webui_ng.models import SettingsModel

router = APIRouter(tags=["system"])
log = logging.getLogger("webui_ng.routers.system")


def _data_root() -> str:
    try:
        from config import data_root  # type: ignore

        return data_root
    except Exception:  # pragma: no cover
        return os.environ.get("GPT_SOVITS_WORKDIR") or os.getcwd()


def _settings_path() -> str:
    return os.path.join(_data_root(), "webui_ng_settings.json")


def _load_settings() -> Dict[str, Any]:
    try:
        with open(_settings_path(), encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {}


def _save_settings(data: Dict[str, Any]) -> None:
    with open(_settings_path(), "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


def _detect_gpu() -> Dict[str, Any] | None:
    try:
        import torch  # noqa: WPS433

        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            return {
                "name": torch.cuda.get_device_name(0),
                "totalMemory": int(props.total_memory),
            }
    except Exception:
        pass
    return None


def prewarm() -> Dict[str, Any]:
    """启动阶段预热：导入 ``config``（触发 torch 加载）并探测 GPU。

    这样首个 ``/api/system`` 请求无需在事件循环里同步 import torch / 枚举 CUDA。
    """
    info: Dict[str, Any] = {"versions": [], "gpu": None}
    try:
        import config as gsv_config  # noqa: WPS433

        names = getattr(gsv_config, "pretrained_sovits_name", None)
        if isinstance(names, dict):
            info["versions"] = list(names.keys())
    except Exception:
        log.exception("prewarm: failed to read config.py")
    try:
        info["gpu"] = _detect_gpu()
    except Exception:
        log.exception("prewarm: failed to detect GPU")
    return info


@router.get("/system")
async def system(request: Request) -> Dict[str, Any]:
    engine = getattr(request.app.state, "engine", None)
    cache = getattr(request.app.state, "system_cache", None)
    device = None
    is_half = None
    versions = list(cache.get("versions") or []) if isinstance(cache, dict) else []

    try:
        import config as gsv_config  # noqa: WPS433

        conf = gsv_config.Config()
        device = getattr(conf, "infer_device", None)
        is_half = getattr(conf, "is_half", None)
        if not versions:
            names = getattr(gsv_config, "pretrained_sovits_name", None)
            if isinstance(names, dict):
                versions = list(names.keys())
    except Exception:
        log.exception("failed to read config.py")

    cfg = getattr(engine, "configs", None) if engine is not None else None
    if cfg is not None:
        device = device or getattr(cfg, "device", None)
        if is_half is None:
            is_half = getattr(cfg, "is_half", None)

    gpu = cache.get("gpu") if isinstance(cache, dict) else _detect_gpu()

    # config.py 的 infer_device 是 torch.device，必须转为字符串才能 JSON 序列化。
    if device is not None:
        device = str(device)

    return {
        "device": device,
        "is_half": is_half,
        "versions": versions,
        "gpu": gpu,
        # 懒加载状态：无模型时服务仍可用，此处报告未加载/失败原因。
        "modelLoaded": bool(getattr(engine, "is_loaded", False)) if engine else False,
        "loadError": getattr(engine, "load_error", None) if engine else None,
    }


@router.get("/settings")
async def get_settings() -> Dict[str, Any]:
    return _load_settings()


@router.put("/settings")
async def put_settings(payload: SettingsModel) -> Dict[str, Any]:
    current = _load_settings()
    update = (
        payload.model_dump(exclude_none=True)
        if hasattr(payload, "model_dump")
        else payload.dict(exclude_none=True)
    )
    for key, value in update.items():
        if key == "paths" and isinstance(value, dict):
            merged = dict(current.get("paths") or {})
            merged.update(value)
            current["paths"] = merged
        else:
            current[key] = value
    _save_settings(current)
    return current
