"""``/api/label/*``：原生 label ``.list`` 编辑器（REST，替代经典 gradio）。

**背景**：经典 ``tools/subfix_webui.py`` 是一个常驻 gradio 服务（``launch`` 绑定额外
端口、永不退出），违反 webui-ng 单端口契约；这里以纯 REST 暴露同一份 ``.list`` 的
读/写/试听能力，**不 import gradio**（``label`` 仍是 ``KNOWN_JOB_TYPES`` 中的 job
占位，不作为 job 子进程）。

``.list`` 每行 4 个 ``|`` 分隔字段，顺序与 ``tools/subfix_webui.py`` 完全一致：

    <wav_path>|<speaker_name>|<language>|<text>

- 解析（``subfix_webui.py:250-256``）：``line.split("|")``，**必须恰好 4 段**，``text``
  ``.strip()``，非法行报错。
- 写回（``subfix_webui.py:228-235``）：``f"{wav_path}|{speaker_name}|{language}|{text}"``
  再 ``.strip()``，行尾 ``\\n``；``text`` 可为空（行尾仍保留 ``|``）。

**路径安全**：所有 ``path`` 查询参数必须落在 ``GPT_SOVITS_WORKDIR`` 之内
（``os.path.realpath`` 双向解析 + 前缀校验，同时防 ``../`` 与 symlink 越界），
越界 400；文件不存在 404；格式非法 422。
"""

from __future__ import annotations

import logging
import mimetypes
import os
import tempfile
from typing import List

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from webui_ng.models import (
    LabelListInfo,
    LabelListResponse,
    LabelListUpdate,
    LabelRow,
    LabelUpdateResponse,
)

router = APIRouter(tags=["label"])
log = logging.getLogger("webui_ng.routers.label")

# .list 字段顺序（与 subfix_webui.py 对齐）。
_FIELD_COUNT = 4
# 扫描列表时的递归深度兜底，避免误入巨树。
_SCAN_MAX = 5000


def _workdir() -> str:
    try:
        from config import data_root  # type: ignore

        return data_root
    except Exception:  # pragma: no cover
        return os.environ.get("GPT_SOVITS_WORKDIR") or os.getcwd()


def _safe_path(raw: str | None, *, must_exist: bool = False) -> str:
    """把 ``raw`` 规范化并限定在 ``GPT_SOVITS_WORKDIR`` 内（越界 400）。

    两侧都用 ``os.path.realpath`` 解析：既防止 ``../`` 越界，也防止 workdir 内
    已存在的 symlink 把访问导出到外部路径（如指向 ``/etc`` 的链接）。
    """
    if not raw:
        raise HTTPException(status_code=400, detail="path is required")
    workdir = os.path.realpath(_workdir())
    candidate = os.path.realpath(raw)
    if candidate != workdir and not candidate.startswith(workdir + os.sep):
        raise HTTPException(
            status_code=400,
            detail="path escapes GPT_SOVITS_WORKDIR",
        )
    if must_exist and not os.path.isfile(candidate):
        raise HTTPException(status_code=404, detail=f"file not found: {raw}")
    return candidate


def _parse_lines(text: str) -> List[LabelRow]:
    """解析 ``.list`` 内容为行列表；非空且字段数不为 4 的行 → ValueError。"""
    rows: List[LabelRow] = []
    for lineno, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line:
            continue
        fields = line.split("|")
        if len(fields) != _FIELD_COUNT:
            raise ValueError(
                f"line {lineno}: expected {_FIELD_COUNT} fields, got {len(fields)}"
            )
        wav_path, speaker, lang, content = fields
        rows.append(
            LabelRow(
                idx=len(rows),
                audio_path=wav_path,
                speaker=speaker,
                lang=lang,
                text=content.strip(),
            )
        )
    return rows


def _count_rows(path: str) -> int:
    """宽容计数：解析失败时退回"非空 4 字段行"的计数，不抛错。"""
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return 0
    count = 0
    for raw in text.splitlines():
        line = raw.strip()
        if line and line.count("|") == _FIELD_COUNT - 1:
            count += 1
    return count


@router.get("/label/lists", response_model=List[LabelListInfo])
async def list_label_lists() -> List[LabelListInfo]:
    """递归扫描 ``GPT_SOVITS_WORKDIR`` 下的所有 ``*.list``。"""
    workdir = os.path.abspath(_workdir())
    out: List[LabelListInfo] = []
    if not os.path.isdir(workdir):
        return out
    for root, dirs, files in os.walk(workdir):
        # 跳过隐藏目录（.git / .venv 等），减少噪声。
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in files:
            if not name.lower().endswith(".list"):
                continue
            full = os.path.abspath(os.path.join(root, name))
            out.append(
                LabelListInfo(path=full, name=name, count=_count_rows(full))
            )
            if len(out) >= _SCAN_MAX:
                break
        if len(out) >= _SCAN_MAX:
            break
    out.sort(key=lambda item: item.path)
    return out


@router.get("/label/list", response_model=LabelListResponse)
async def get_label_list(path: str = Query(...)) -> LabelListResponse:
    target = _safe_path(path, must_exist=True)
    try:
        with open(target, encoding="utf-8") as fh:
            text = fh.read()
    except OSError as exc:  # pragma: no cover - 竞态兜底
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    try:
        rows = _parse_lines(text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return LabelListResponse(path=target, rows=rows)


@router.put("/label/list", response_model=LabelUpdateResponse)
async def put_label_list(payload: LabelListUpdate) -> LabelUpdateResponse:
    target = _safe_path(payload.path, must_exist=True)

    lines: List[str] = []
    for i, row in enumerate(payload.rows):
        for field in (row.audio_path, row.speaker, row.lang, row.text):
            if "|" in field:
                raise HTTPException(
                    status_code=422,
                    detail=f"row {i}: field contains '|' (not allowed in .list)",
                )
        # 对齐 subfix_webui.py:235：拼成 4 段后整行 strip，text 可空。
        line = f"{row.audio_path}|{row.speaker}|{row.lang}|{row.text}".strip()
        lines.append(line + "\n")
    content = "".join(lines)

    _atomic_write(target, content)
    return LabelUpdateResponse(ok=True, path=target, count=len(lines))


def _atomic_write(target: str, content: str) -> None:
    """同目录临时文件 + ``os.replace`` 原子替换，避免半写损坏。"""
    directory = os.path.dirname(target) or "."
    if not os.path.isdir(directory):
        raise HTTPException(status_code=400, detail=f"directory not found: {directory}")
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".label-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as fh:
            fh.write(content)
        os.replace(tmp, target)
    except HTTPException:
        raise
    except OSError as exc:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise HTTPException(status_code=400, detail=f"write failed: {exc}") from exc


@router.get("/label/audio")
async def get_label_audio(path: str = Query(...)) -> FileResponse:
    """试听：返回 ``.list`` 中引用的音频文件（同样受 workdir 边界约束）。"""
    target = _safe_path(path, must_exist=True)
    media_type = mimetypes.guess_type(target)[0] or "application/octet-stream"
    return FileResponse(target, media_type=media_type)
