# 可运行的 GPT-SoVITS app 派生。
#
# 把仓库源码（本文件相对路径的 ../../..）打包进 store，再基于 pythonEnv 用
# makeWrapper 生成唯一的 $out/bin/gpt-sovits-webui-ng（单进程 FastAPI + React SPA）。
# wrapper：
#   - 解释器固定为 ${pythonEnv}/bin/python；
#   - 把 pythonEnv/bin 前缀进 PATH（子进程再次调用 `python` 时命中同一环境）；
#   - 运行前 cd 到源码目录（只读 store 代码根，相对 import/资源路径依赖 cwd），
#     运行期数据目录经 GPT_SOVITS_DATA_DIR 暴露，并设置 PYTHONPATH；
#   - "$@" 透传由 makeWrapper 自动追加在 --add-flags 之后。
{
  lib,
  pkgs,
  pythonEnv,
  acceleration ? "cpu",
  # G2PWModel 归档 URL（内建进打包源码树）。默认 HF；调用方（NixOS 模块）按
  # `modelSource` 传入 hf-mirror / modelscope 镜像。
  g2pwUrl ? null,
  ...
}:

let
  # 仓库根：nix/packages/gpt-sovits -> nix/packages -> nix -> 仓库根。
  # 过滤规则（全部走 lib.cleanSourceWith 的 filter，目录被排除时不会递归）：
  #   * 任意深度：VCS/缓存/构建目录（.git/.direnv/.venv/__pycache__/nix 等）；
  #   * 仅仓库顶层：运行期数据目录/文件 —— 源码里可能存在同名子目录，绝不能误删，
  #     例如 `GPT_SoVITS/AR/models` 是源码而非数据；
  #   * `web/dist`：前端构建产物。
  isExcluded =
    path: type:
    let
      root = toString ../../..;
      rel = lib.removePrefix "/" (lib.removePrefix root (toString path));
      base = baseNameOf (toString path);
      anyDepth = builtins.elem base [
        ".git"
        ".direnv"
        ".venv"
        "__pycache__"
        "nix"
        "node_modules"
        ".vite"
      ];
      topOnly = builtins.elem rel [
        "logs"
        "output"
        "dataset"
        "TEMP"
        "references"
        "models"
        "train"
        "tmp"
        "huggingface"
        "modelscope"
        "onnx"
        "onnx_export"
        "webui_ng_references.json"
        "webui_ng_settings.json"
      ];
      webDist = rel == "web/dist" || lib.hasPrefix "web/dist/" rel;
      # `result`/`result-*` 是仓库根的 nix build 软链；按 rel 精确匹配，
      # 避免误删源码里以 "result" 开头的文件（如 web/src/lib/results.ts）。
      resultLink = rel == "result" || lib.hasPrefix "result-" rel;
    in
    !(anyDepth || topOnly || webDist || resultLink);

  # 仓库源码（过滤掉 .git/.direnv/…/nix/result*）。
  # 禁用自动下载等改动已**直接内联到源码**，不再需要 patches。
  source = lib.cleanSourceWith {
    name = "gpt-sovits-source";
    src = ../../..;
    filter = path: type: isExcluded path type;
  };

  # 静态目录（纯 lib 数据）：复用其中的 G2PWModel 归档 URL/hash。
  catalog = import ../../nixosModules/model-catalog.nix { inherit lib; };

  # G2PWModel 资产（HF / hf-mirror / modelscope 之一），构建期注入源码树。
  g2pwModelUrl = if g2pwUrl != null then g2pwUrl else catalog.g2pwZip.hf;

  g2pwModel = pkgs.runCommand "G2PWModel" { nativeBuildInputs = [ pkgs.unzip ]; } ''
    mkdir -p $out
    unzip -q ${
      pkgs.fetchurl {
        url = g2pwModelUrl;
        hash = catalog.g2pwZip.hash;
      }
    } -d $out
    mv $out/G2PWModel/* $out/
    rmdir $out/G2PWModel
  '';

  # 打包源码 = 过滤后的仓库 + 内建 G2PWModel（cwd 相对 `GPT_SoVITS/text/G2PWModel`
  # 直接命中，代码无需 env/重定向）+ 预计算 g2pw 缓存（polyphonic.pickle/md5，令
  # 运行期 md5 自洽、绝不写盘）。整棵树只读。
  #
  # 预计算算法与运行期 `g2pw.get_dict()` 一致；仓库里已提交的 polyphonic.md5 与当前
  # `.rep` 不一致（实测 e511…bda1… vs 13b2…），故必须重算。
  sourceWithG2PW = pkgs.runCommand "gpt-sovits-source-g2pw" { } ''
    cp -a ${source} $out
    chmod -R u+w $out
    rm -rf $out/GPT_SoVITS/text/G2PWModel
    ln -sn ${g2pwModel} $out/GPT_SoVITS/text/G2PWModel
    ${pkgs.python3}/bin/python - "$out/GPT_SoVITS/text/g2pw" <<'PY'
    import hashlib, os, pickle, sys

    d = sys.argv[1]

    def md5(path):
        h = hashlib.md5()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                h.update(chunk)
        return h.hexdigest()

    dct = {}
    for name in ("polyphonic.rep", "polyphonic-fix.rep"):
        with open(os.path.join(d, name), encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    key, value_str = line.split(":", 1)
                    dct[key.strip()] = eval(value_str.strip())
    with open(os.path.join(d, "polyphonic.pickle"), "wb") as f:
        pickle.dump(dct, f)
    with open(os.path.join(d, "polyphonic.md5"), "w", encoding="utf-8") as f:
        f.write(md5(os.path.join(d, "polyphonic.rep")) + md5(os.path.join(d, "polyphonic-fix.rep")))
    PY
    chmod -R a-w $out
  '';

  # GPU（WSL CUDA）下补上驱动库路径：预编译 CUDA wheels 需要 libcuda.so。
  # WSL 把驱动放在 /usr/lib/wsl/lib（不在 ldconfig 默认搜索路径内），
  # NixOS 则在 /run/opengl-driver/lib。CPU 分支拼接为空串，保持逐字节不变。
  driverLibPath = ''
    for d in /run/opengl-driver/lib /usr/lib/wsl/lib; do
      if [ -d "$d" ]; then
        export LD_LIBRARY_PATH="$d''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
      fi
    done
  '';

  # 运行前切到只读 store 源码根（cwd=代码根，所有代码/脚本/config 的 cwd 相对
  # 路径天然解析）；运行期数据目录经 GPT_SOVITS_DATA_DIR 暴露给进程（默认回退到
  # 旧的 GPT_SOVITS_WORKDIR，再回退到源码根）；webui_ng 经 `python -m webui_ng.app`
  # 启动。
  ngRun = "cd ${sourceWithG2PW} && export GPT_SOVITS_DATA_DIR=\"\${GPT_SOVITS_DATA_DIR:-\${GPT_SOVITS_WORKDIR:-${sourceWithG2PW}}}\" && export PYTHONPATH=\"$PWD/src:$PWD:$PWD/GPT_SoVITS/BigVGAN:$PWD/tools:$PWD/tools/asr:$PWD/GPT_SoVITS:$PWD/tools/uvr5\${PYTHONPATH:+:$PYTHONPATH}\"";

  ngRunScript = ngRun + lib.optionalString (acceleration == "cuda") ("\n" + driverLibPath);

  # 前端构建产物（index.html + assets/），运行时经 GPT_SOVITS_WEB_DIST 提供。
  web = pkgs.callPackage ./web.nix { };
in
pkgs.stdenvNoCC.mkDerivation {
  pname = "gpt-sovits";
  version = "0.1.0";

  # 没有 src 需要解包；所有产物在 installPhase 手工生成。
  dontUnpack = true;
  dontConfigure = true;
  dontBuild = true;

  nativeBuildInputs = [ pkgs.makeWrapper ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin

    # 唯一入口：单进程 FastAPI（webui_ng）+ 前端静态资源（web）。
    makeWrapper ${pythonEnv}/bin/python $out/bin/gpt-sovits-webui-ng \
      --add-flags "-m webui_ng.app" \
      --prefix PATH : "${pythonEnv}/bin" \
      --set GPT_SOVITS_WEB_DIST "${web}" \
      --run '${ngRunScript}'

    runHook postInstall
  '';

  passthru = {
    # 只读打包源码根（运行的 cwd / PYTHONPATH 基），已内建 G2PWModel + g2pw 缓存。
    source = sourceWithG2PW;
    # 前端构建产物，供需要单独引用 SPA 的场合。
    inherit web;
  };

  meta = {
    description = "GPT-SoVITS webui-ng (single-process FastAPI + React SPA) launcher";
    homepage = "https://github.com/RVC-Boss/GPT-SoVITS";
    license = lib.licenses.mit;
    mainProgram = "gpt-sovits-webui-ng";
    platforms = lib.platforms.linux;
  };
}
