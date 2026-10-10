{
  lib,
  pkgs,
  inputs,
  ...
}:
let
  env = import ../packages/gpt-sovits/env.nix { inherit pkgs inputs lib; };
in
{
  default = pkgs.mkShell {
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
      ++ [ env.pythonEnv ];

    shellHook = ''
      echo "GPT-SoVITS devshell (CPU-only Python environment)"
      echo "python: $(command -v python) -- $(python --version 2>&1)"
      # 复刻 webui.py 原本写入 site-packages 的 users.pth（只读 store 下写不了）。
      export PYTHONPATH="$PWD:$PWD/GPT_SoVITS/BigVGAN:$PWD/tools:$PWD/tools/asr:$PWD/GPT_SoVITS:$PWD/tools/uvr5''${PYTHONPATH:+:$PYTHONPATH}"
    '';
  };
}
