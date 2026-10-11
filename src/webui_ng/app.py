"""webui_ng FastAPI 入口（单进程）。

启动序列（对齐冻结契约 P1）：

1. ``activate_portable_runtime(change_cwd=True)``，**先于** import ``config``/``TTS``；
2. lifespan 中构造 ``Engine``（TTS 单例 + worker 线程）与 ``JobManager``；
3. 挂载 ``/api/*`` 路由 → ``/assets`` ``StaticFiles`` → SPA fallback（末尾 catch-all）；
4. ``uvicorn.run(app, host, port, workers=1)``。

顶层导入刻意保持轻量：torch/TTS 只在 lifespan 启动时才加载，因此
``python -c "import webui_ng.app"`` 无需模型即可通过结构检查。
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

# 1) 运行期激活必须先于 config/TTS 的导入。
from tools.portable_runtime import activate as activate_portable_runtime

activate_portable_runtime(change_cwd=True)

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from webui_ng.inference import Engine  # noqa: E402
from webui_ng.jobs import JobManager  # noqa: E402
from webui_ng.routers import (  # noqa: E402
    health,
    jobs,
    label,
    models,
    references,
    system,
    tts,
)

logging.basicConfig(
    level=os.environ.get("GPT_SOVITS_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("webui_ng.app")

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 9880


def _workdir() -> str:
    return os.environ.get("GPT_SOVITS_WORKDIR") or os.getcwd()


def _web_dist() -> str | None:
    """返回前端构建产物目录；不存在则返回 None（SPA fallback 退化为 404）。"""
    candidate = os.environ.get("GPT_SOVITS_WEB_DIST") or os.path.join(
        os.getcwd(), "web", "dist"
    )
    return candidate if os.path.isdir(candidate) else None


def _build_lifespan(workdir: str):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # 单一共享 GPU 门：推理（Engine）与子进程任务（JobManager）互斥占卡，
        # 满足契约"训练与推理靠占卡串行互斥"。
        gpu_gate = asyncio.Semaphore(1)
        engine = Engine(gpu_gate=gpu_gate)
        engine.start()
        job_manager = JobManager(workdir=workdir, gpu_gate=gpu_gate)
        app.state.engine = engine
        app.state.jobs = job_manager
        # 预热：在启动阶段导入 config（触发 torch 加载）并缓存 GPU 探测，
        # 避免首个 /api/system 请求在事件循环里同步阻塞。
        try:
            app.state.system_cache = system.prewarm()
        except Exception:  # noqa: BLE001
            log.exception("system prewarm failed")
            app.state.system_cache = None
        log.info("webui_ng ready (workdir=%s)", workdir)
        try:
            yield
        finally:
            engine.stop()
            log.info("webui_ng engine stopped")

    return lifespan


def create_app() -> FastAPI:
    workdir = _workdir()
    app = FastAPI(
        title="GPT-SoVITS webui-ng",
        version="0.1.0",
        lifespan=_build_lifespan(workdir),
    )

    # 3a) /api/* 路由。
    for module in (health, system, models, references, tts, jobs, label):
        app.include_router(module.router, prefix="/api")

    # 3b) 静态资源：只挂 /assets，禁止 mount("/", StaticFiles)。
    dist = _web_dist()
    if dist is not None:
        assets = os.path.join(dist, "assets")
        if os.path.isdir(assets):
            app.mount("/assets", StaticFiles(directory=assets), name="assets")
            log.info("serving /assets from %s", assets)

    # 3c) SPA fallback：末尾 catch-all，仅非 /api 的 GET/HEAD。
    dist_root = os.path.abspath(dist) if dist is not None else None

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str, request: Request):
        if full_path == "api" or full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        if dist_root is not None and request.method in ("GET", "HEAD"):
            # 先尝试命中 dist 下的真实文件（favicon / robots.txt / manifest 等），
            # 命中才返回；否则按 Accept: text/html 回退到 index.html。
            candidate = os.path.abspath(os.path.join(dist_root, full_path))
            inside = candidate == dist_root or candidate.startswith(dist_root + os.sep)
            if inside and os.path.isfile(candidate):
                return FileResponse(candidate)
            accept = request.headers.get("accept", "")
            if "text/html" in accept:
                index = os.path.join(dist_root, "index.html")
                if os.path.isfile(index):
                    return FileResponse(index, media_type="text/html")
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    return app


app = create_app()


def main() -> None:
    import uvicorn  # noqa: WPS433

    host = os.environ.get("GPT_SOVITS_WEBUI_HOST", DEFAULT_HOST)
    port = int(os.environ.get("GPT_SOVITS_WEBUI_PORT", str(DEFAULT_PORT)))
    uvicorn.run(app, host=host, port=port, workers=1)


if __name__ == "__main__":
    main()
