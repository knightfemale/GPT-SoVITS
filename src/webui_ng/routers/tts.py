"""``POST /api/tts``：非流式与流式推理。

参数校验与 ``streaming_mode`` 映射**逐行对齐** ``api_v2.py``（作为规格复用，
不 import 它）。请求统一入 Engine 的 FIFO lane。
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

from webui_ng.inference import ModelsNotLoadedError
from webui_ng.models import TTSRequest

router = APIRouter(tags=["tts"])
log = logging.getLogger("webui_ng.routers.tts")

_SUPPORTED_MEDIA = ("wav", "raw", "ogg", "aac")


def _cut_methods() -> Optional[set]:
    try:
        from GPT_SoVITS.TTS_infer_pack.text_segmentation_method import (  # noqa: WPS433
            get_method_names,
        )

        return set(get_method_names())
    except Exception:
        log.exception("failed to load cut method names")
        return None


def _check(req: TTSRequest, engine) -> None:
    cfg = getattr(engine, "configs", None)
    languages = list(getattr(cfg, "languages", []) or []) if cfg is not None else []
    version = getattr(cfg, "version", "?") if cfg is not None else "?"

    if not req.ref_audio_path:
        raise HTTPException(status_code=400, detail="ref_audio_path is required")
    if not req.text:
        raise HTTPException(status_code=400, detail="text is required")
    if not req.text_lang:
        raise HTTPException(status_code=400, detail="text_lang is required")
    if req.text_lang.lower() not in languages:
        raise HTTPException(
            status_code=400,
            detail=f"text_lang: {req.text_lang} is not supported in version {version}",
        )
    if not req.prompt_lang:
        raise HTTPException(status_code=400, detail="prompt_lang is required")
    if req.prompt_lang.lower() not in languages:
        raise HTTPException(
            status_code=400,
            detail=f"prompt_lang: {req.prompt_lang} is not supported in version {version}",
        )
    if req.media_type not in _SUPPORTED_MEDIA:
        raise HTTPException(
            status_code=400,
            detail=f"media_type: {req.media_type} is not supported",
        )
    methods = _cut_methods()
    if methods is not None and req.text_split_method not in methods:
        raise HTTPException(
            status_code=400,
            detail=f"text_split_method:{req.text_split_method} is not supported",
        )


def _map_streaming(streaming_mode) -> Optional[Tuple[bool, bool, bool]]:
    """返回 (streaming_mode, return_fragment, fixed_length_chunk)，与 api_v2 一致。"""
    if streaming_mode == 0:
        return False, False, False
    if streaming_mode == 1:
        return False, True, False
    if streaming_mode == 2:
        return True, False, False
    if streaming_mode == 3:
        return True, False, True
    return None


def _dump(req: TTSRequest) -> Dict[str, Any]:
    return req.model_dump() if hasattr(req, "model_dump") else req.dict()


@router.post("/tts")
async def tts(req: TTSRequest, request: Request):
    engine = request.app.state.engine

    # 懒加载：首次请求时在 GPU 门内按需构造 TTS 内核。失败（模型缺失等）返回
    # 明确的 503，且不缓存坏实例——后续请求可重试，其它路由不受影响。
    try:
        await engine.ensure_loaded()
    except ModelsNotLoadedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    _check(req, engine)

    mapped = _map_streaming(req.streaming_mode)
    if mapped is None:
        raise HTTPException(
            status_code=400,
            detail="the value of streaming_mode must be 0, 1, 2, 3(int) or true/false(bool)",
        )
    streaming_mode, return_fragment, fixed_length_chunk = mapped

    payload = _dump(req)
    payload["streaming_mode"] = streaming_mode
    payload["return_fragment"] = return_fragment
    payload["fixed_length_chunk"] = fixed_length_chunk

    content_type = f"audio/{req.media_type}"
    if streaming_mode or return_fragment:
        generator = engine.synthesize_stream(payload)
        return StreamingResponse(generator, media_type=content_type)

    try:
        audio = await engine.synthesize(payload)
    except ModelsNotLoadedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"tts failed: {exc}") from exc
    return Response(content=audio, media_type=content_type)
