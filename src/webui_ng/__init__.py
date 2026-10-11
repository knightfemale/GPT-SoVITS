"""webui_ng — GPT-SoVITS 新版单进程 FastAPI 后端入口。

本包为**新增**后端（增量 fork），遵循 `.slim/deepwork/gpt-sovits-webui-ng/api-contract.md`
的冻结契约：

- 不 ``import gradio``；只使用 fastapi 0.112.0 / starlette 0.37.2 的 API。
- 单进程 ``uvicorn workers=1``；单端口；同源。
- GPU 推理 lane：一个专用 worker 线程独占 ``TTS`` 单例 + 有界 FIFO 队列（见 ``inference``）。
- 子进程 lane：``JobManager`` 受管子进程 + SSE（见 ``jobs``）。

包内模块对导入成本敏感：``app`` 的顶层导入**不**加载 torch/TTS，重活延迟到
``FastAPI`` 的 lifespan 启动阶段（构造 ``Engine``/``JobManager``）。
"""

from __future__ import annotations

__all__ = ["__version__"]

__version__ = "0.1.0"
