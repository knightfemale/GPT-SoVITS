"""``/api/models`` 与 ``/api/models/switch``。"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request

from webui_ng.inference import ModelsNotLoadedError
from webui_ng.models import SwitchRequest

router = APIRouter(tags=["models"])
log = logging.getLogger("webui_ng.routers.models")

_WEIGHT_EXTS = (".pth", ".ckpt")
# 版本识别顺序：长的优先，避免 "v2Pro" 命中 "v2"。
_VERSION_TOKENS = (
    "v2ProPlus",
    "v2Pro",
    "v5turbo",
    "v5dev",
    "v5",
    "v4",
    "v3",
    "v2",
    "v1",
)


def _version_of(root: str, filename: str) -> str | None:
    haystack = f"{os.path.basename(root)} {filename}"
    lowered = haystack.lower()
    for token in _VERSION_TOKENS:
        if token.lower() in lowered:
            return token
    return None


def _safe_mtime(path: str) -> float:
    try:
        return os.path.getmtime(path)
    except OSError:
        return 0.0


def _scan(roots: List[str]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    seen = set()
    for root in roots or []:
        if not root or not os.path.isdir(root):
            continue
        for filename in sorted(os.listdir(root)):
            if not filename.lower().endswith(_WEIGHT_EXTS):
                continue
            path = os.path.join(root, filename)
            abspath = os.path.abspath(path)
            if abspath in seen:
                continue
            seen.add(abspath)
            out.append(
                {
                    "path": path,
                    "name": filename,
                    "version": _version_of(root, filename),
                    "mtime": _safe_mtime(path),
                }
            )
    return out


def _base_entries(mapping: Any) -> List[Dict[str, Any]]:
    """``pretrained`` 底模条目（对齐上游 ``config.name2sovits_path`` / ``name2gpt_path``）。

    上游 ``get_weights_names()`` 会把可用的底模也列进下拉；webui-ng 原先只扫
    ``*_weights*``（微调权重），导致只装了底模时列表为空、无法选择/切换。这里仅
    在底模文件确实存在时列出，``name`` 沿用上游标签，``path`` 是可直接交给
    ``/api/models/switch`` 的真实路径。
    """
    out: List[Dict[str, Any]] = []
    if not isinstance(mapping, dict):
        return out
    for label, path in mapping.items():
        if not path or not os.path.isfile(path):
            continue
        out.append(
            {
                "path": path,
                "name": label,
                "version": _version_of(os.path.dirname(path), os.path.basename(path)),
                "mtime": _safe_mtime(path),
            }
        )
    return out


def _merge(
    base: List[Dict[str, Any]], scanned: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """底模在前、微调权重在后，按绝对路径去重（底模优先）。"""
    out: List[Dict[str, Any]] = []
    seen = set()
    for entry in base + scanned:
        abspath = os.path.abspath(entry["path"])
        if abspath in seen:
            continue
        seen.add(abspath)
        out.append(entry)
    return out


@router.get("/models")
async def list_models() -> Dict[str, Any]:
    sovits_roots: List[str] = []
    gpt_roots: List[str] = []
    sovits_base: List[Dict[str, Any]] = []
    gpt_base: List[Dict[str, Any]] = []
    try:
        import config as gsv_config  # noqa: WPS433

        sovits_roots = list(getattr(gsv_config, "SoVITS_weight_root", []) or [])
        gpt_roots = list(getattr(gsv_config, "GPT_weight_root", []) or [])
        sovits_base = _base_entries(getattr(gsv_config, "name2sovits_path", None))
        gpt_base = _base_entries(getattr(gsv_config, "name2gpt_path", None))
    except Exception:
        log.exception("failed to read weight roots from config.py")
    return {
        "sovits": _merge(sovits_base, _scan(sovits_roots)),
        "gpt": _merge(gpt_base, _scan(gpt_roots)),
    }


@router.post("/models/switch")
async def switch_models(payload: SwitchRequest, request: Request) -> Dict[str, Any]:
    engine = request.app.state.engine
    if not payload.sovits_path and not payload.gpt_path:
        raise HTTPException(status_code=400, detail="sovits_path or gpt_path is required")
    if payload.sovits_path and not os.path.isfile(payload.sovits_path):
        raise HTTPException(
            status_code=400, detail=f"sovits_path not found: {payload.sovits_path}"
        )
    if payload.gpt_path and not os.path.isfile(payload.gpt_path):
        raise HTTPException(
            status_code=400, detail=f"gpt_path not found: {payload.gpt_path}"
        )
    try:
        return await engine.switch_models(payload.sovits_path, payload.gpt_path)
    except HTTPException:
        raise
    except ModelsNotLoadedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"switch failed: {exc}") from exc
