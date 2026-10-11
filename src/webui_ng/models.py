"""webui_ng 的 pydantic 请求/响应模型。

``TTSRequest`` 的字段与默认值**逐字段对齐** ``api_v2.py`` 的 ``TTS_Request``
（作为行为规格复用，但**不** import 它）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Type, Union

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

__all__ = [
    "TTSRequest",
    "SwitchRequest",
    "SwitchResponse",
    "ModelInfo",
    "ModelsResponse",
    "SystemResponse",
    "ReferenceInfo",
    "LabelListInfo",
    "LabelRow",
    "LabelListResponse",
    "LabelListUpdate",
    "LabelUpdateResponse",
    "JobCreate",
    "JobInfo",
    "CancelResponse",
    "SettingsModel",
    "SliceParams",
    "FormatParams",
    "Uvr5Params",
    "AsrParams",
    "DenoiseParams",
    "LabelParams",
    "TrainS1Params",
    "TrainS2Params",
    "TrainS2LoraParams",
    "JOB_PARAM_MODELS",
]


class TTSRequest(BaseModel):
    """对齐 ``api_v2.py:TTS_Request`` 的推理请求。"""

    text: Optional[str] = None
    text_lang: Optional[str] = None
    ref_audio_path: Optional[str] = None
    aux_ref_audio_paths: Optional[List[str]] = None
    prompt_lang: Optional[str] = None
    prompt_text: str = ""
    top_k: int = 15
    top_p: float = 1
    temperature: float = 1
    text_split_method: str = "cut5"
    batch_size: int = 1
    batch_threshold: float = 0.75
    split_bucket: bool = True
    speed_factor: float = 1.0
    fragment_interval: float = 0.3
    seed: int = -1
    media_type: str = "wav"
    # bool 与 int 都接受（0/False 关闭，1/True 旧流式，2/3 新流式）。
    streaming_mode: Union[int, bool] = False
    parallel_infer: bool = True
    use_cuda_graph: bool = True
    repetition_penalty: float = 1.35
    sample_steps: Optional[int] = None
    cfg_rate: Optional[float] = None
    super_sampling: bool = False
    overlap_length: int = 2
    min_chunk_length: int = 16


class SwitchRequest(BaseModel):
    sovits_path: Optional[str] = None
    gpt_path: Optional[str] = None


class SwitchResponse(BaseModel):
    ok: bool = True
    version: Optional[str] = None


class ModelInfo(BaseModel):
    path: str
    name: str
    version: Optional[str] = None
    mtime: float = 0.0


class ModelsResponse(BaseModel):
    sovits: List[ModelInfo] = Field(default_factory=list)
    gpt: List[ModelInfo] = Field(default_factory=list)


class SystemResponse(BaseModel):
    device: Optional[str] = None
    is_half: Optional[bool] = None
    versions: List[str] = Field(default_factory=list)
    gpu: Optional[Dict[str, Any]] = None
    # TTS 内核懒加载状态（无模型时服务仍可用）。
    modelLoaded: bool = False
    loadError: Optional[str] = None


class ReferenceInfo(BaseModel):
    id: str
    name: str
    path: str
    peaks: List[float] = Field(default_factory=list)
    duration: float = 0.0
    lang: Optional[str] = None
    text: Optional[str] = None


# --- label .list 编辑器（REST，替代 tools/subfix_webui.py 的 gradio） ------- #
#
# 字段顺序对齐 ``tools/subfix_webui.py``：``wav_path|speaker_name|language|text``。
class LabelListInfo(BaseModel):
    """``GET /api/label/lists`` 列表项。"""

    path: str
    name: str
    count: int = 0


class LabelRow(BaseModel):
    """``.list`` 的一行。

    ``idx`` 仅出现在 ``GET /api/label/list`` 的响应中（供前端稳定引用）；
    ``PUT`` 请求里可省略（未知字段忽略）。
    """

    model_config = ConfigDict(extra="ignore")

    idx: Optional[int] = None
    audio_path: str = ""
    speaker: str = ""
    lang: str = ""
    text: str = ""


class LabelListResponse(BaseModel):
    """``GET /api/label/list`` 响应。"""

    path: str
    rows: List[LabelRow] = Field(default_factory=list)


class LabelListUpdate(BaseModel):
    """``PUT /api/label/list`` 请求体。"""

    path: str
    rows: List[LabelRow] = Field(default_factory=list)


class LabelUpdateResponse(BaseModel):
    """``PUT /api/label/list`` 响应。"""

    ok: bool = True
    path: str
    count: int = 0


class JobCreate(BaseModel):
    type: str
    params: Dict[str, Any] = Field(default_factory=dict)


class JobInfo(BaseModel):
    id: str
    type: str
    status: str = "pending"
    stage: Optional[str] = None
    stageIndex: Optional[int] = None
    stageCount: Optional[int] = None
    params: Dict[str, Any] = Field(default_factory=dict)
    createdAt: float = 0.0
    startedAt: Optional[float] = None
    finishedAt: Optional[float] = None
    exitCode: Optional[int] = None
    error: Optional[str] = None


class CancelResponse(BaseModel):
    ok: bool = True


class SettingsModel(BaseModel):
    language: Optional[str] = None
    device: Optional[str] = None
    paths: Dict[str, Any] = Field(default_factory=dict)


# --- P2：数据集流水线各 JobType 的参数模型 --------------------------------- #
#
# 字段名对齐 ``webui.py`` 的输入（前端 ``JobsPage`` 目前只有 demo，无按类型的
# 表单，故以 ``webui.py`` 为准）。为兼容演示调用（如
# ``createJob("slice", {input: "demo.wav"})``）与既有 ``_RUNNERS`` 的宽松取值，
# 这里用 ``AliasChoices`` 接受多个别名，并 ``extra="ignore"`` 容忍未知字段。
# 所有字段都给出默认值，缺省时由 runner 回退到 ``config.py`` / workdir 约定路径。
#
# 注意：pydantic v2 不允许字段名以下划线开头，故 slice 的 ``_max`` 用
# ``max_amplitude`` 承接（别名 ``_max``）。
class _JobParams(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class SliceParams(_JobParams):
    """``tools/slice_audio.py``：``inp opt_root threshold min_length min_interval
    hop_size max_sil_kept _max alpha i_part all_part``（位置参数）。"""

    inp: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("inp", "input", "audio", "path")
    )
    opt_root: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("opt_root", "out")
    )
    threshold: float = -34
    min_length: int = 4000
    min_interval: int = 300
    hop_size: int = 10
    max_sil_kept: int = 500
    max_amplitude: float = Field(
        default=0.9, validation_alias=AliasChoices("_max", "max_amplitude", "max")
    )
    alpha: float = 0.25
    i_part: int = 0
    all_part: int = 1


class FormatParams(_JobParams):
    """训练集格式化一键三连（1A+1B+1C+合并）。

    参数经环境变量传入 ``GPT_SoVITS/prepare_datasets/{1-get-text,2-get-hubert-wav32k,
    3-get-semantic}.py``（见 ``webui.py:1074-1205``）。"""

    inp_text: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("inp_text", "text_list", "list_path"),
    )
    inp_wav_dir: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("inp_wav_dir", "wav_dir", "audio_dir")
    )
    exp_name: str = "exp"
    opt_dir: Optional[str] = None
    bert_pretrained_dir: str = (
        "GPT_SoVITS/pretrained_models/bert/chinese-roberta-wwm-ext-large"
    )
    # 1B 追加：cnhubert 底模目录（脚本读 ``cnhubert_base_dir``）。
    cnhubert_base_dir: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("cnhubert_base_dir", "ssl_pretrained_dir"),
    )
    # 1C 追加：s2G 底模权重与 s2 配置（脚本读 ``pretrained_s2G`` / ``s2config_path``）。
    pretrained_s2G: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("pretrained_s2G", "pretrained_s2G_path", "s2G"),
    )
    s2config_path: Optional[str] = None
    # Pro 版（v2Pro/v2ProPlus）1B 之后的 SV 特征提取权重（脚本读 ``sv_path``）。
    # 默认值**只保留在 runner**（``_format_argv``），此处不设默认，避免"死分支"。
    sv_path: Optional[str] = None
    all_parts: int = 1
    is_half: Optional[bool] = None
    version: Optional[str] = None
    cuda_visible_devices: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "cuda_visible_devices", "gpu_numbers", "gpu"
        ),
    )


class Uvr5Params(_JobParams):
    """原生 uvr5 批处理（``src/webui_ng/tools/uvr5_batch.py``，无 gradio）。

    字段对齐 ``tools/uvr5/webui.py:45`` 的 ``uvr()`` 语义，但以 CLI 形式暴露；
    模型权重来自 ``tools/uvr5/uvr5_weights``，离线缺失即明确报错。"""

    input_dir: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("input_dir", "inp_dir", "input", "inp", "input_folder"),
    )
    output_vocal: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("output_vocal", "vocal_dir")
    )
    output_ins: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("output_ins", "ins_dir")
    )
    model_name: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("model_name", "model")
    )
    agg: int = 10
    format: str = "flac"
    device: Optional[str] = None
    is_half: Optional[bool] = None


class AsrParams(_JobParams):
    """``tools/asr/{fasterwhisper,funasr}_asr.py``：
    ``-i inp_dir -o opt_dir -s model_size -l language -p precision``。"""

    inp_dir: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("inp_dir", "input_folder", "inp", "input"),
    )
    opt_dir: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("opt_dir", "output_folder", "out")
    )
    model: Optional[str] = None  # asr_dict 的展示名（用于解析脚本路径）
    model_path: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("model_path", "script")
    )
    model_size: str = Field(
        default="large-v3", validation_alias=AliasChoices("model_size", "size")
    )
    language: str = Field(
        default="auto", validation_alias=AliasChoices("language", "lang", "language_code")
    )
    precision: str = Field(
        default="float32", validation_alias=AliasChoices("precision", "compute_type")
    )


class DenoiseParams(_JobParams):
    """``tools/cmd-denoise.py``：``-i inp_dir -o opt_dir -p precision``。"""

    inp_dir: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("inp_dir", "input_folder", "inp", "input"),
    )
    opt_dir: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("opt_dir", "output_folder", "out")
    )
    precision: str = Field(
        default="float16", validation_alias=AliasChoices("precision",)
    )


class LabelParams(_JobParams):
    """``tools/subfix_webui.py``：``--load_list <list> --webui_port <port> --is_share <bool>``.

    **占位（前向兼容）**：该脚本是常驻 gradio 服务（永不退出、绑定额外端口），
    不作为 job 子进程运行；webui-ng 中 ``label`` job 直接 ``job.failed``。"""

    load_list: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("load_list", "list_path", "inp")
    )
    webui_port: int = Field(
        default=9871, validation_alias=AliasChoices("webui_port", "port")
    )
    is_share: bool = False


# --- P3：训练 JobType 的参数模型 ------------------------------------------- #
#
# 字段对齐 ``webui.py`` 的训练表单（s2：``:490-545`` 的 ``open1Ba``；s1：
# ``:591-637`` 的 ``open1Bb``）。经典 webui 从表单**生成 yaml/json 配置**再跑
# ``s1_train.py`` / ``s2_train.py`` / ``s2_train_v3_lora.py``；webui-ng 的 runner
# 复刻该配置生成（见 ``jobs/__init__.py`` 的 ``_train_*_argv``），故这里只暴露
# 表单层参数，配置模板与默认值在 runner 内对齐 ``GPT_SoVITS/configs/``。
class TrainS2Params(_JobParams):
    """SoVITS（s2）微调：``GPT_SoVITS/s2_train.py --config <tmp.json>``。

    ``version`` 决定配置模板（``s2.json`` / Pro 的 ``s2{version}.json``）与权重目录；
    脚本按版本自动选择（v1/v2/v2Pro/v2ProPlus → ``s2_train.py``，v3/v4/v5 → LoRA）。"""

    exp_name: str = Field(
        default="exp", validation_alias=AliasChoices("exp_name", "name")
    )
    version: Optional[str] = None
    batch_size: int = 1
    total_epoch: int = Field(
        default=8, validation_alias=AliasChoices("total_epoch", "epochs")
    )
    text_low_lr_rate: float = 0.4
    lora_rank: str = "32"
    if_grad_ckpt: bool = False
    if_save_latest: bool = True
    if_save_every_weights: bool = True
    save_every_epoch: int = 1
    gpu_numbers: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("gpu_numbers", "gpu")
    )
    pretrained_s2G: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("pretrained_s2G", "pretrained_s2G_path", "s2G"),
    )
    pretrained_s2D: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("pretrained_s2D", "pretrained_s2D_path", "s2D"),
    )
    # 表单之外的透传项：若给定则覆盖模板中的同名配置字段。
    learning_rate: Optional[float] = None
    is_half: Optional[bool] = None


class TrainS2LoraParams(TrainS2Params):
    """s2 LoRA（v3/v4/v5）微调：强制 ``GPT_SoVITS/s2_train_v3_lora.py``。"""


class TrainS1Params(_JobParams):
    """GPT（s1）微调：``GPT_SoVITS/s1_train.py --config_file <tmp.yaml>``。

    ``version`` 决定配置模板（v1 → ``s1longer.yaml``，否则 ``s1longer-v2.yaml``）与
    权重目录；训练数据路径由 ``logs/<exp_name>/{2-name2text.txt,6-name2semantic.tsv}`` 推导。
    """

    exp_name: str = Field(
        default="exp", validation_alias=AliasChoices("exp_name", "name")
    )
    version: Optional[str] = None
    batch_size: int = 1
    total_epoch: int = Field(
        default=15, validation_alias=AliasChoices("total_epoch", "epochs")
    )
    save_every_epoch: int = 5
    if_dpo: bool = False
    if_save_latest: bool = True
    if_save_every_weights: bool = True
    gpu_numbers: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("gpu_numbers", "gpu")
    )
    pretrained_s1: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("pretrained_s1", "pretrained_s1_path"),
    )
    # 表单之外的透传项：若给定则覆盖模板中的同名配置字段。
    learning_rate: Optional[float] = None
    is_half: Optional[bool] = None


JOB_PARAM_MODELS: Dict[str, Type[BaseModel]] = {
    "slice": SliceParams,
    "format": FormatParams,
    "uvr5": Uvr5Params,
    "asr": AsrParams,
    "denoise": DenoiseParams,
    "label": LabelParams,
    "train_s1": TrainS1Params,
    "train_s2": TrainS2Params,
    "train_s2_lora": TrainS2LoraParams,
}
