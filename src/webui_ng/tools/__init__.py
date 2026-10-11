"""webui_ng 的**批处理编排脚本**（作为受管 job 子进程运行，非 import 用包）。

- ``format_batch.py``：训练集格式化一键三连（1A → 合并 → 1B → 1C）。
- ``uvr5_batch.py``：原生 uvr5 人声/伴奏分离批处理（无 gradio）。

两者都以 ``python -s src/webui_ng/tools/<script>.py`` 方式启动（``cwd`` 为
``GPT_SOVITS_WORKDIR``），参数经命令行或环境变量传入，与经典 ``webui.py`` 的
调用语义保持一致。
"""
