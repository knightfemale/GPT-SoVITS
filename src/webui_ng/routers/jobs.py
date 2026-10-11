"""``/api/jobs*``：任务查询、创建、取消与 SSE 事件流。"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from webui_ng.jobs import KNOWN_JOB_TYPES, sse_format
from webui_ng.models import JOB_PARAM_MODELS, JobCreate

router = APIRouter(tags=["jobs"])
log = logging.getLogger("webui_ng.routers.jobs")

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _last_event_id(request: Request) -> int:
    raw = (
        request.headers.get("last-event-id")
        or request.query_params.get("last_event_id")
        or request.query_params.get("lastEventId")
        or "0"
    )
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


@router.get("/jobs")
async def list_jobs(request: Request) -> list:
    return request.app.state.jobs.list_jobs()


@router.post("/jobs")
async def create_job(payload: JobCreate, request: Request) -> Dict[str, Any]:
    if payload.type not in KNOWN_JOB_TYPES:
        raise HTTPException(status_code=400, detail=f"unknown job type: {payload.type}")
    params = dict(payload.params or {})
    model = JOB_PARAM_MODELS.get(payload.type)
    if model is not None:
        try:
            validated = model.model_validate(params)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=exc.errors()) from exc
        params = validated.model_dump(exclude_none=True)
    return await request.app.state.jobs.create(payload.type, params)


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, request: Request) -> Dict[str, Any]:
    manager = request.app.state.jobs
    if manager.get(job_id) is None:
        raise HTTPException(status_code=404, detail="job not found")
    ok = await manager.cancel(job_id)
    return {"ok": ok}


async def _event_generator(request: Request, manager, job_id):
    queue = manager.subscribe(job_id)
    try:
        for event in manager.replay(job_id, _last_event_id(request)):
            yield sse_format(event)
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15)
            except asyncio.TimeoutError:
                # 心跳，保持连接并检测断开。
                yield ": keepalive\n\n"
                continue
            yield sse_format(event)
    finally:
        manager.unsubscribe(queue, job_id)


@router.get("/jobs/events")
async def global_events(request: Request) -> StreamingResponse:
    manager = request.app.state.jobs
    return StreamingResponse(
        _event_generator(request, manager, None),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.get("/jobs/{job_id}/events")
async def job_events(job_id: str, request: Request) -> StreamingResponse:
    manager = request.app.state.jobs
    if manager.get(job_id) is None:
        raise HTTPException(status_code=404, detail="job not found")
    return StreamingResponse(
        _event_generator(request, manager, job_id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
