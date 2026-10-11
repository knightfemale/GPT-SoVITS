import os
import re
import sys

import torch

from tools.i18n.i18n import I18nAuto

i18n = I18nAuto(language=os.environ.get("language", "Auto"))

# --- 运行期数据根 ---------------------------------------------------------
# 设 GPT_SOVITS_DATA_DIR 时启用「内聚布局」：代码从只读 store 运行，cwd 只放
# 可写目录（models/ train/ output/ tmp/ configs/ references/）；未设时保持上游
# 原有的 cwd 相对布局，不影响非 nix 用法。
_DATA_ROOT = os.environ.get("GPT_SOVITS_DATA_DIR")
if _DATA_ROOT:
    _D = os.path.abspath(_DATA_ROOT).rstrip("/")
    _MODELS = os.path.join(_D, "models")
    _PRET = os.path.join(_MODELS, "pretrained_models")
    _TRAIN = os.path.join(_D, "train")
    _EXP = os.path.join(_TRAIN, "logs")
    _DATASET = os.path.join(_TRAIN, "dataset")
    _OUTPUT = os.path.join(_D, "output")
    _TMP = os.path.join(_D, "tmp")
    _CONFIGS = os.path.join(_D, "configs")
    _REFS = os.path.join(_D, "references")
else:
    _MODELS = None
    _PRET = "GPT_SoVITS/pretrained_models"
    _EXP = "logs"
    _DATASET = "dataset"
    _OUTPUT = "output"
    _TMP = "TEMP"
    _CONFIGS = "GPT_SoVITS/configs"
    _REFS = "references"


def _pret(*parts):
    """Path below the pretrained-models root (absolute in consolidated mode)."""
    return os.path.join(_PRET, *parts)


def _weight_root(kind, version):
    """`SoVITS_weights`/`GPT_weights` (+ `_<version>`) below the models root."""
    base = "SoVITS_weights" if kind == "sovits" else "GPT_weights"
    name = base if version == "v1" else f"{base}_{version}"
    return os.path.join(_MODELS, name) if _MODELS else name


# 公开别名：webui_ng / tools 可直接引用这些根，避免各自拼 cwd 相对路径。
project_root = os.path.dirname(os.path.abspath(__file__))
data_root = _D if _DATA_ROOT else os.getcwd()
pretrained_models_root = _PRET
dataset_root = _DATASET
output_root = _OUTPUT
tmp_root = _TMP
configs_root = _CONFIGS
references_root = _REFS


pretrained_sovits_name = {
    "v1": _pret("s2G488k.pth"),
    "v2": _pret("gsv-v2final-pretrained/s2G2333k.pth"),
    "v3": _pret("s2Gv3.pth"),  ###v3v4还要检查vocoder，算了。。。
    "v4": _pret("gsv-v4-pretrained/s2Gv4.pth"),
    "v5dev": _pret("gsv-v5-pretrained/s2Gv5dev.pth"),
    "v5turbo": _pret("gsv-v5-pretrained/s2Gv5turbo.pth"),
    "v2Pro": _pret("v2Pro/s2Gv2Pro.pth"),
    "v2ProPlus": _pret("v2Pro/s2Gv2ProPlus.pth"),
}

pretrained_gpt_name = {
    "v1": _pret("s1bert25hz-2kh-longer-epoch=68e-step=50232.ckpt"),
    "v2": _pret("gsv-v2final-pretrained/s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt"),
    "v3": _pret("s1v3.ckpt"),
    "v4": _pret("s1v3.ckpt"),
    "v5dev": _pret("s1v3.ckpt"),
    "v5turbo": _pret("s1v3.ckpt"),
    "v2Pro": _pret("s1v3.ckpt"),
    "v2ProPlus": _pret("s1v3.ckpt"),
}
name2sovits_path = {
    i18n("不训练直接推v5dev底模！"): pretrained_sovits_name["v5dev"],
    i18n("不训练直接推v5turbo底模！"): pretrained_sovits_name["v5turbo"],
    # i18n("不训练直接推v1底模！"): pretrained_sovits_name["v1"],
    i18n("不训练直接推v2底模！"): pretrained_sovits_name["v2"],
    # i18n("不训练直接推v3底模！"): pretrained_sovits_name["v3"],
    # i18n("不训练直接推v4底模！"): pretrained_sovits_name["v4"],
    i18n("不训练直接推v2Pro底模！"): pretrained_sovits_name["v2Pro"],
    i18n("不训练直接推v2ProPlus底模！"): pretrained_sovits_name["v2ProPlus"],
}
name2gpt_path = {
    # i18n("不训练直接推v1底模！"): pretrained_gpt_name["v1"],
    i18n("不训练直接推v2底模！"): pretrained_gpt_name["v2"],
    i18n("不训练直接推v3底模！"): pretrained_gpt_name["v3"],
}
_WEIGHT_VERSIONS = [
    "v1",
    "v2",
    "v3",
    "v4",
    "v5dev",
    "v5turbo",
    "v2Pro",
    "v2ProPlus",
]
SoVITS_weight_root = [_weight_root("sovits", v) for v in _WEIGHT_VERSIONS]
GPT_weight_root = [_weight_root("gpt", v) for v in _WEIGHT_VERSIONS]
SoVITS_weight_version2root = {v: _weight_root("sovits", v) for v in _WEIGHT_VERSIONS}
GPT_weight_version2root = {v: _weight_root("gpt", v) for v in _WEIGHT_VERSIONS}


def custom_sort_key(s):
    # 使用正则表达式提取字符串中的数字部分和非数字部分
    parts = re.split("(\d+)", s)
    # 将数字部分转换为整数，非数字部分保持不变
    parts = [int(part) if part.isdigit() else part for part in parts]
    return parts


def get_weights_names():
    SoVITS_names = []
    for key in name2sovits_path:
        if os.path.exists(name2sovits_path[key]):
            SoVITS_names.append(key)
    for path in SoVITS_weight_root:
        if not os.path.exists(path):
            continue
        for name in os.listdir(path):
            if name.endswith(".pth"):
                SoVITS_names.append("%s/%s" % (path, name))
    if not SoVITS_names:
        SoVITS_names = [""]
    GPT_names = []
    for key in name2gpt_path:
        if os.path.exists(name2gpt_path[key]):
            GPT_names.append(key)
    for path in GPT_weight_root:
        if not os.path.exists(path):
            continue
        for name in os.listdir(path):
            if name.endswith(".ckpt"):
                GPT_names.append("%s/%s" % (path, name))
    SoVITS_names = sorted(SoVITS_names, key=custom_sort_key)
    GPT_names = sorted(GPT_names, key=custom_sort_key)
    if not GPT_names:
        GPT_names = [""]
    return SoVITS_names, GPT_names


def change_choices():
    SoVITS_names, GPT_names = get_weights_names()
    return {"choices": SoVITS_names, "__type__": "update"}, {
        "choices": GPT_names,
        "__type__": "update",
    }


# 推理用的指定模型
sovits_path = ""
gpt_path = ""
is_half_str = os.environ.get("is_half", "True")
is_half = True if is_half_str.lower() == "true" else False
is_share_str = os.environ.get("is_share", "False")
is_share = True if is_share_str.lower() == "true" else False

cnhubert_path = _pret("chinese-hubert-base")
bert_path = _pret("chinese-roberta-wwm-ext-large")
pretrained_sovits_path = _pret("s2G488k.pth")
pretrained_gpt_path = _pret("s1bert25hz-2kh-longer-epoch=68e-step=50232.ckpt")

exp_root = _EXP
python_exec = sys.executable or "python"

webui_port_main = 9874
webui_port_uvr5 = 9873
webui_port_infer_tts = 9872
webui_port_subfix = 9871

api_port = 9880


# Thanks to the contribution of @Karasukaigan and @XXXXRT666
def get_device_dtype_sm(idx: int) -> tuple[torch.device, torch.dtype, float, float]:
    cpu = torch.device("cpu")
    cuda = torch.device(f"cuda:{idx}")
    if not torch.cuda.is_available():
        return cpu, torch.float32, 0.0, 0.0
    device_idx = idx
    capability = torch.cuda.get_device_capability(device_idx)
    name = torch.cuda.get_device_name(device_idx)
    mem_bytes = torch.cuda.get_device_properties(device_idx).total_memory
    mem_gb = mem_bytes / (1024**3) + 0.4
    major, minor = capability
    sm_version = major + minor / 10.0
    is_16_series = bool(re.search(r"16\d{2}", name)) and sm_version == 7.5
    if mem_gb < 4 or sm_version < 5.3:
        return cpu, torch.float32, 0.0, 0.0
    if sm_version == 6.1 or is_16_series == True:
        return cuda, torch.float32, sm_version, mem_gb
    if sm_version > 6.1:
        return cuda, torch.float16, sm_version, mem_gb
    return cpu, torch.float32, 0.0, 0.0


IS_GPU = True
GPU_INFOS: list[str] = []
GPU_INDEX: set[int] = set()
GPU_COUNT = torch.cuda.device_count()
CPU_INFO: str = "0\tCPU " + i18n("CPU训练,较慢")
tmp: list[tuple[torch.device, torch.dtype, float, float]] = []
memset: set[float] = set()

for i in range(max(GPU_COUNT, 1)):
    tmp.append(get_device_dtype_sm(i))

for j in tmp:
    device = j[0]
    memset.add(j[3])
    if device.type != "cpu":
        GPU_INFOS.append(f"{device.index}\t{torch.cuda.get_device_name(device.index)}")
        GPU_INDEX.add(device.index)

if not GPU_INFOS:
    IS_GPU = False
    GPU_INFOS.append(CPU_INFO)
    GPU_INDEX.add(0)

infer_device = max(tmp, key=lambda x: (x[2], x[3]))[0]
is_half = any(dtype == torch.float16 for _, dtype, _, _ in tmp)


class Config:
    def __init__(self):
        self.sovits_path = sovits_path
        self.gpt_path = gpt_path
        self.is_half = is_half

        self.cnhubert_path = cnhubert_path
        self.bert_path = bert_path
        self.pretrained_sovits_path = pretrained_sovits_path
        self.pretrained_gpt_path = pretrained_gpt_path

        self.exp_root = exp_root
        self.python_exec = python_exec
        self.infer_device = infer_device

        self.webui_port_main = webui_port_main
        self.webui_port_uvr5 = webui_port_uvr5
        self.webui_port_infer_tts = webui_port_infer_tts
        self.webui_port_subfix = webui_port_subfix

        self.api_port = api_port
