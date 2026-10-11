#!/usr/bin/env python
"""原生 uvr5 人声/伴奏分离**批处理**（无 gradio）。

复用 ``tools/uvr5/`` 下的模型类（``mdxnet`` / ``vr`` / ``bsroformer``），编排逻辑
对齐 ``tools/uvr5/webui.py:45`` 的 ``uvr()``，但**去掉 gradio**（单端口契约、无
GUI）：直接加载模型 → 逐文件分离 → 输出 vocal/ins。

模型权重目录固定为 ``<repo>/tools/uvr5/uvr5_weights``；**离线**：模型文件缺失时
明确 ``raise``，绝不联网下载。

进度：逐文件打印 ``[uvr5] i/n NN% name -> ok``，并以
``@@stage:uvr5:<i>/<n>@@`` 上报每个文件的阶段（映射为 ``job.stage`` 事件）。

用法::

    python -s src/webui_ng/tools/uvr5_batch.py \\
        --input <dir|file> --output-vocal <dir> --output-ins <dir> \\
        --model <model_name> [--agg 10] [--format flac] \\
        [--device cuda] [--is-half]
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import traceback
from typing import List, Optional, Tuple

# 脚本位于 ``<repo>/src/webui_ng/tools/uvr5_batch.py``：向上 4 层即仓库根。
REPO_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
WEIGHT_ROOT = os.path.join(REPO_ROOT, "tools", "uvr5", "uvr5_weights")

# 运行期根（内聚布局见 config.py）：设 GPT_SOVITS_DATA_DIR 时 uvr5 权重与输出走数据根，
# 否则保持上游「仓库内」行为。
try:
    from config import output_root as _OUT_ROOT  # type: ignore
except Exception:  # pragma: no cover
    _OUT_ROOT = os.path.join(REPO_ROOT, "output")
_DATA_ROOT = os.environ.get("GPT_SOVITS_DATA_DIR")
if _DATA_ROOT:
    WEIGHT_ROOT = os.path.join(_DATA_ROOT, "models", "uvr5_weights")

# ``vr.py`` 用 ``from lib.lib_v5 import ...``、``mdxnet.py`` 用
# ``from tools.portable_runtime import ...``：需把仓库根与 ``tools/uvr5`` 加入
# ``sys.path``（经典 webui.py 靠"脚本所在目录"隐式提供，这里显式补上）。
for _p in (REPO_ROOT, os.path.join(REPO_ROOT, "tools", "uvr5")):
    if _p not in sys.path:
        sys.path.insert(0, _p)


def _ffmpeg_exe() -> str:
    try:
        from tools.portable_runtime import FFMPEG_EXE

        if FFMPEG_EXE and os.path.exists(FFMPEG_EXE):
            return FFMPEG_EXE
    except Exception:  # noqa: BLE001
        pass
    return shutil.which("ffmpeg") or "ffmpeg"


def _resolve_model_file(model_name: str) -> Optional[str]:
    for ext in (".pth", ".ckpt", ".onnx"):
        candidate = os.path.join(WEIGHT_ROOT, model_name + ext)
        if os.path.exists(candidate):
            return candidate
    direct = os.path.join(WEIGHT_ROOT, model_name)
    if os.path.exists(direct):
        return direct
    return None


def _build_loader(model_name: str, device: str, is_half: bool, agg: int):
    """按模型名构造分离器实例（对齐 ``webui.py:51-74``）。"""
    model_lower = model_name.lower()
    if model_name == "onnx_dereverb_By_FoxJoy":
        from mdxnet import MDXNetDereverb

        return MDXNetDereverb(15)
    if "roformer" in model_lower:
        from bsroformer import Roformer_Loader

        return Roformer_Loader(
            model_path=os.path.join(WEIGHT_ROOT, model_name + ".ckpt"),
            config_path=os.path.join(WEIGHT_ROOT, model_name + ".yaml"),
            device=device,
            is_half=is_half,
        )
    from vr import AudioPre, AudioPreDeEcho

    func = AudioPreDeEcho if "DeEcho" in model_name else AudioPre
    return func(
        agg=int(agg),
        model_path=os.path.join(WEIGHT_ROOT, model_name + ".pth"),
        device=device,
        is_half=is_half,
    )


def _list_inputs(input_path: str) -> List[str]:
    if os.path.isdir(input_path):
        return [
            os.path.join(input_path, name)
            for name in sorted(os.listdir(input_path))
            if os.path.isfile(os.path.join(input_path, name))
        ]
    if os.path.isfile(input_path):
        return [input_path]
    return []


def _reformat(path: str, ffmpeg: str) -> Tuple[str, Optional[str]]:
    """用 ffmpeg 统一重采样为 44100 立体声（对齐 webui.py:99）。

    返回 ``(可加载路径, 临时目录)``；ffmpeg 不可用或失败时回退原路径。
    """
    tmp_dir = tempfile.mkdtemp(prefix="webui_ng_uvr5_")
    tmp_path = os.path.join(tmp_dir, os.path.basename(path) + ".reformatted.wav")
    cmd = [
        ffmpeg,
        "-i",
        path,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ac",
        "2",
        "-ar",
        "44100",
        tmp_path,
        "-y",
    ]
    try:
        subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        if os.path.exists(tmp_path):
            return tmp_path, tmp_dir
    except Exception:  # noqa: BLE001 - 重采样失败则直接用原文件
        pass
    shutil.rmtree(tmp_dir, ignore_errors=True)
    return path, None


def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="webui_ng 原生 uvr5 批处理")
    parser.add_argument("--input", required=True, help="输入音频文件或目录")
    parser.add_argument("--output-vocal", default=None, help="人声输出目录")
    parser.add_argument("--output-ins", default=None, help="伴奏输出目录")
    parser.add_argument("--model", required=True, help="uvr5 模型名（不含扩展名）")
    parser.add_argument("--agg", type=int, default=10, help="人声提取激进程度")
    parser.add_argument(
        "--format", default="flac", choices=["wav", "flac", "mp3", "m4a"]
    )
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--is-half", action="store_true")
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = _parse_args(argv)

    model_file = _resolve_model_file(args.model)
    if model_file is None:
        # 离线：绝不下载；明确报错并列出权重目录。
        raise SystemExit(
            f"[uvr5] 找不到模型 '{args.model}'（已查找 {WEIGHT_ROOT}）；"
            "请先离线放置模型权重，本工具不会联网下载。"
        )

    inputs = _list_inputs(args.input)
    if not inputs:
        raise SystemExit(f"[uvr5] 输入路径无可用音频文件：{args.input}")

    vocal_root = args.output_vocal or os.path.join(_OUT_ROOT, "uvr5_opt", "vocal")
    ins_root = args.output_ins or os.path.join(_OUT_ROOT, "uvr5_opt", "ins")
    os.makedirs(vocal_root, exist_ok=True)
    os.makedirs(ins_root, exist_ok=True)

    print(
        f"[uvr5] 模型={args.model} 设备={args.device} is_half={args.is_half} "
        f"文件数={len(inputs)}",
        flush=True,
    )

    is_hp3 = "HP3" in args.model
    pre_fun = _build_loader(args.model, args.device, args.is_half, args.agg)
    ffmpeg = _ffmpeg_exe()

    total = len(inputs)
    try:
        for index, inp_path in enumerate(inputs):
            print(f"@@stage:uvr5:{index}/{total}@@", flush=True)
            tmp_dir = None
            try:
                load_path, tmp_dir = _reformat(inp_path, ffmpeg)
                pre_fun._path_audio_(
                    load_path, ins_root, vocal_root, args.format, is_hp3
                )
                pct = int((index + 1) / total * 100)
                print(
                    f"[uvr5] {index + 1}/{total} {pct}% "
                    f"{os.path.basename(inp_path)} -> ok",
                    flush=True,
                )
            finally:
                if tmp_dir:
                    shutil.rmtree(tmp_dir, ignore_errors=True)
    finally:
        # 对齐 webui.py:112-124 的清理。
        try:
            if args.model == "onnx_dereverb_By_FoxJoy":
                del pre_fun.pred.model
                del pre_fun.pred.model_
            else:
                del pre_fun.model
                del pre_fun
        except Exception:  # noqa: BLE001
            traceback.print_exc()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:  # noqa: BLE001
            pass

    print(f"[uvr5] 完成：vocal={vocal_root} ins={ins_root}", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        sys.exit(1)
