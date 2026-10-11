#!/usr/bin/env python
"""训练集格式化一键三连（format）编排脚本。

对齐经典 ``webui.py`` 的 ``open1abc``（``webui.py:1047-1235``）：

- **1A** ``GPT_SoVITS/prepare_datasets/1-get-text.py``：逐分片 ``i_part``，
  输出 ``2-name2text-{i}.txt``；随后**合并**所有分片为 ``2-name2text.txt``
  并删除分片临时文件。
- **1B** ``GPT_SoVITS/prepare_datasets/2-get-hubert-wav32k.py``：逐分片，
  输出 ``4-cnhubert/*.pt`` 与 ``5-wav32k/*``。
- **SV**（仅 ``"Pro" in version``，对齐 ``webui.py:1152-1168``）
  ``GPT_SoVITS/prepare_datasets/2-get-sv.py``：逐分片，输出 ``7-sv_cn/*.pt``
  （``v2Pro/v2ProPlus`` 训练必需，``module/data_utils.py:32-35`` 会断言该目录）。
- **1C** ``GPT_SoVITS/prepare_datasets/3-get-semantic.py``：逐分片，输出
  ``6-name2semantic-{i}.tsv``；随后**合并**（首行表头
  ``item_name\\tsemantic_audio``）为 ``6-name2semantic.tsv`` 并删除分片。

三个阶段脚本的参数**全部经环境变量**传入（脚本内 ``os.environ.get``，见
``webui.py:1074-1205``）。本脚本自身作为**单个**受 GPU 门管控的 job 子进程运行，
阶段通过 stdout 标记 ``@@stage:<name>:<index>/<count>@@`` 上报给 ``JobManager``
（映射为 ``job.stage`` 事件），并按阶段打印 ``NN%`` 进度行。

用法（env 传参）::

    inp_text / inp_wav_dir / exp_name / opt_dir / bert_pretrained_dir /
    cnhubert_base_dir / pretrained_s2G / s2config_path / sv_path / all_parts /
    is_half / version / cuda_visible_devices
"""

from __future__ import annotations

import os
import subprocess
import sys
import traceback

# 运行期根（内聚布局见 config.py）；未设 GPT_SOVITS_DATA_DIR 时保持上游 cwd 相对。
try:
    from config import exp_root as _EXP_ROOT, pretrained_models_root as _PRET_ROOT  # type: ignore
except Exception:  # pragma: no cover
    _EXP_ROOT = "logs"
    _PRET_ROOT = os.path.join("GPT_SoVITS", "pretrained_models")

STAGE_1A = "GPT_SoVITS/prepare_datasets/1-get-text.py"
STAGE_1B = "GPT_SoVITS/prepare_datasets/2-get-hubert-wav32k.py"
# Pro 版（v2Pro/v2ProPlus）在 1B 之后、1C 之前追加的 SV 特征提取（webui.py:1152-1168）。
STAGE_SV = "GPT_SoVITS/prepare_datasets/2-get-sv.py"
STAGE_1C = "GPT_SoVITS/prepare_datasets/3-get-semantic.py"


def _env(name: str, default: str = None, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and (value is None or value == ""):
        raise SystemExit(f"[format] 缺少必需的环境变量 '{name}'")
    return value


def _stage_marker(name: str, index: int, count: int) -> None:
    print(f"@@stage:{name}:{index}/{count}@@", flush=True)


def _progress(pct: int, note: str = "") -> None:
    print(f"[format] {note} {pct}%", flush=True)


def _run_stage(script: str, env: dict) -> None:
    cmd = [sys.executable, "-s", script]
    print(f"[format] exec: {' '.join(cmd)}", flush=True)
    proc = subprocess.run(cmd, cwd=os.getcwd(), env=env)
    if proc.returncode != 0:
        raise SystemExit(f"[format] 阶段失败 ({script}) rc={proc.returncode}")


def main() -> int:
    inp_text = _env("inp_text", required=True)
    inp_wav_dir = _env("inp_wav_dir", required=True)
    exp_name = (_env("exp_name", "exp") or "exp").rstrip()
    opt_dir = _env("opt_dir") or os.path.join(_EXP_ROOT, exp_name)
    bert = _env("bert_pretrained_dir") or os.path.join(
        _PRET_ROOT, "chinese-roberta-wwm-ext-large"
    )
    cnhubert = _env("cnhubert_base_dir") or os.path.join(
        _PRET_ROOT, "chinese-hubert-base"
    )
    s2g = _env("pretrained_s2G") or os.path.join(_PRET_ROOT, "s2G488k.pth")
    # Pro 版 SV 权重（webui.py:866 的 sv_path 默认值）。
    sv_path = _env("sv_path") or os.path.join(
        _PRET_ROOT, "sv", "pretrained_eres2netv2w24s4ep4.ckpt"
    )
    version = _env("version", "") or ""
    is_pro = "Pro" in version
    s2config = _env("s2config_path") or (
        "GPT_SoVITS/configs/s2.json"
        if version not in {"v2Pro", "v2ProPlus"}
        else f"GPT_SoVITS/configs/s2{version}.json"
    )
    all_parts = int(_env("all_parts", "1"))
    is_half = _env("is_half", "True")
    gpu_raw = _env("cuda_visible_devices", "") or ""
    gpu_names = gpu_raw.split("-") if gpu_raw else []

    def gpu_for(i: int) -> str:
        # 对齐 webui.py:804（fix_gpu_number）：多分片时按 i_part 绑定；缺省即 i。
        if gpu_names:
            return gpu_names[i] if 0 <= i < len(gpu_names) else gpu_names[0]
        return str(i)

    os.makedirs(opt_dir, exist_ok=True)

    base_env = dict(os.environ)
    base_env.update(
        {
            "inp_text": inp_text,
            "inp_wav_dir": inp_wav_dir,
            "exp_name": exp_name,
            "opt_dir": opt_dir,
            "bert_pretrained_dir": bert,
            "cnhubert_base_dir": cnhubert,
            "pretrained_s2G": s2g,
            "s2config_path": s2config,
            "sv_path": sv_path,
            "is_half": is_half,
        }
    )
    if version:
        base_env["version"] = version

    def part_env(i: int) -> dict:
        env = dict(base_env)
        env.update(
            {
                "i_part": str(i),
                "all_parts": str(all_parts),
                "_CUDA_VISIBLE_DEVICES": gpu_for(i),
            }
        )
        return env

    # Pro 版有 4 个阶段（1A→1B→SV→1C），否则 3 个（1A→1B→1C）。
    stage_count = 4 if is_pro else 3
    idx_1a, idx_1b, idx_sv = 0, 1, 2
    idx_1c = 3 if is_pro else 2

    def pct(index: int) -> int:
        return int((index + 1) / stage_count * 100)

    print(
        f"[format] 开始：exp={exp_name} all_parts={all_parts} version={version or '<none>'} "
        f"opt_dir={opt_dir}",
        flush=True,
    )

    # ---- 1A：文本分词与特征提取 ------------------------------------------ #
    _stage_marker("1A", idx_1a, stage_count)
    for i in range(all_parts):
        _run_stage(STAGE_1A, part_env(i))
    opt = []
    for i in range(all_parts):
        txt_path = os.path.join(opt_dir, f"2-name2text-{i}.txt")
        with open(txt_path, "r", encoding="utf8") as f:
            opt += f.read().strip("\n").split("\n")
        os.remove(txt_path)
    path_text = os.path.join(opt_dir, "2-name2text.txt")
    with open(path_text, "w", encoding="utf8") as f:
        f.write("\n".join(opt) + "\n")
    if len("".join(opt)) == 0:
        raise SystemExit("[format] 1A 产出为空（2-name2text.txt）")
    _progress(pct(idx_1a), "1A-Done")

    # ---- 1B：语音自监督特征提取 ------------------------------------------ #
    _stage_marker("1B", idx_1b, stage_count)
    for i in range(all_parts):
        _run_stage(STAGE_1B, part_env(i))
    _progress(pct(idx_1b), "1B-Done")

    # ---- SV：Pro 版音色特征（7-sv_cn）----------------------------------- #
    # 对齐 webui.py:1152-1168：仅 ``"Pro" in version`` 时在 1B 之后、1C 之前运行。
    if is_pro:
        _stage_marker("SV", idx_sv, stage_count)
        for i in range(all_parts):
            _run_stage(STAGE_SV, part_env(i))
        _progress(pct(idx_sv), "SV-Done")

    # ---- 1C：语义 Token 提取 --------------------------------------------- #
    _stage_marker("1C", idx_1c, stage_count)
    for i in range(all_parts):
        _run_stage(STAGE_1C, part_env(i))
    opt = ["item_name\tsemantic_audio"]
    for i in range(all_parts):
        semantic_path = os.path.join(opt_dir, f"6-name2semantic-{i}.tsv")
        with open(semantic_path, "r", encoding="utf8") as f:
            opt += f.read().strip("\n").split("\n")
        os.remove(semantic_path)
    with open(os.path.join(opt_dir, "6-name2semantic.tsv"), "w", encoding="utf8") as f:
        f.write("\n".join(opt) + "\n")
    _progress(pct(idx_1c), "1C-Done")

    print(f"[format] 完成：{opt_dir}", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        sys.exit(1)
