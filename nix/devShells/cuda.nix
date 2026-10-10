{
  lib,
  pkgs,
  inputs,
  ...
}:
let
  envCuda = import ../packages/gpt-sovits/env.nix {
    inherit pkgs inputs lib;
    acceleration = "cuda";
  };
in
{
  # GPU（WSL CUDA）变体：torch 系改用预编译 CUDA wheels（torch-bin 等）。
  cuda = pkgs.mkShell {
    packages =
      with pkgs;
      [
        ffmpeg
        sox
        cmake
        gnumake
        gcc
        pkg-config
        unzip
        git
        which
        # Justfile
        just-lsp
        # Nix
        nix-output-monitor
        nixd
        nixfmt
        nixfmt-tree
      ]
      ++ [ envCuda.pythonEnv ];

    shellHook = ''
      echo "GPT-SoVITS devshell (CUDA Python environment)"
      echo "python: $(command -v python) -- $(python --version 2>&1)"
      # 预编译 CUDA wheels 需要 libcuda.so：WSL 驱动库在 /usr/lib/wsl/lib
      # （不在 ldconfig 默认搜索路径内），NixOS 则在 /run/opengl-driver/lib。
      for d in /run/opengl-driver/lib /usr/lib/wsl/lib; do
        if [ -d "$d" ]; then
          export LD_LIBRARY_PATH="$d''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
        fi
      done
      # 复刻 webui.py 原本写入 site-packages 的 users.pth（只读 store 下写不了）。
      export PYTHONPATH="$PWD:$PWD/GPT_SoVITS/BigVGAN:$PWD/tools:$PWD/tools/asr:$PWD/GPT_SoVITS:$PWD/tools/uvr5''${PYTHONPATH:+:$PYTHONPATH}"
    '';
  };
}
