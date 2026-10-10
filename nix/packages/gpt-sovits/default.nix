# 可运行的 GPT-SoVITS app 派生。
#
# 把仓库源码（本文件相对路径的 ../../..）打包进 store，再基于 pythonEnv 用
# makeWrapper 生成 $out/bin/{gpt-sovits-webui,gpt-sovits-api,gpt-sovits-inference}。
# 每个 wrapper：
#   - 解释器固定为 ${pythonEnv}/bin/python；
#   - 把 pythonEnv/bin 前缀进 PATH（子进程再次调用 `python` 时命中同一环境）；
#   - 运行前 cd 到源码目录（相对 import/资源路径依赖 cwd）；
#   - "$@" 透传由 makeWrapper 自动追加在 --add-flags 之后。
{
  lib,
  pkgs,
  pythonEnv,
  acceleration ? "cpu",
  ...
}:

let
  # 仓库根：nix/packages/gpt-sovits -> nix/packages -> nix -> 仓库根。
  # 过滤规则（全部走 lib.cleanSourceWith 的 filter，目录被排除时不会递归）：
  #   .git / .direnv / .venv / __pycache__ / nix / result*
  isExcluded =
    path: type:
    let
      base = baseNameOf (toString path);
    in
    !(
      builtins.elem base [
        ".git"
        ".direnv"
        ".venv"
        "__pycache__"
        "nix"
      ]
      || lib.hasPrefix "result" base
    );

  # 仓库源码（先过滤掉 .git/.direnv/…/nix/result*）。
  cleanSource = lib.cleanSourceWith {
    name = "gpt-sovits-source";
    src = ../../..;
    filter = path: type: isExcluded path type;
  };

  source = pkgs.applyPatches {
    name = "gpt-sovits-source";
    src = cleanSource;
    patches = [
      # 只读 site-packages（Nix store）无法写 users.pth，禁用 webui.py 里那段
      # 写 users.pth 的逻辑；项目 import 路径改由 wrapper/devShell 的 PYTHONPATH 提供。
      ./patches/0001-disable-users-pth.patch
      # 禁用一切运行期自动下载模型（g2pw / BERT / BigVGAN / denoise / funasr /
      # faster-whisper），缺失模型时以明确异常失败，绝不联网。
      ./patches/0002-disable-model-download.patch
    ];
  };

  # 运行前切换到可写工作目录：设置了 GPT_SOVITS_WORKDIR 时切到该目录（上层
  # 服务会把源码播种到那里，微调模型/output/日志的写入都不会碰只读 store），
  # 否则退回只读源码目录（仅适合不写盘的用法）。
  chdirRun = "cd \"\${GPT_SOVITS_WORKDIR:-${source}}\" && export PYTHONPATH=\"$PWD:$PWD/GPT_SoVITS/BigVGAN:$PWD/tools:$PWD/tools/asr:$PWD/GPT_SoVITS:$PWD/tools/uvr5\${PYTHONPATH:+:$PYTHONPATH}\"";

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

  runScript = chdirRun + lib.optionalString (acceleration == "cuda") ("\n" + driverLibPath);
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

    makeWrapper ${pythonEnv}/bin/python $out/bin/gpt-sovits-webui \
      --add-flags "webui.py" \
      --prefix PATH : "${pythonEnv}/bin" \
      --run '${runScript}'

    makeWrapper ${pythonEnv}/bin/python $out/bin/gpt-sovits-api \
      --add-flags "api_v2.py" \
      --prefix PATH : "${pythonEnv}/bin" \
      --run '${runScript}'

    makeWrapper ${pythonEnv}/bin/python $out/bin/gpt-sovits-inference \
      --add-flags "GPT_SoVITS/inference_webui.py" \
      --prefix PATH : "${pythonEnv}/bin" \
      --run '${runScript}'

    runHook postInstall
  '';

  passthru = {
    # 供 NixOS 模块把只读源码播种到可写数据目录（见 nix/nixosModules）。
    inherit source;
  };

  meta = {
    description = "GPT-SoVITS webui / api / inference launchers";
    homepage = "https://github.com/RVC-Boss/GPT-SoVITS";
    license = lib.licenses.mit;
    mainProgram = "gpt-sovits-webui";
    platforms = lib.platforms.linux;
  };
}
