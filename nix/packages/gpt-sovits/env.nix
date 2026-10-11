{
  lib,
  pkgs,
  inputs,
  acceleration ? "cpu",
  torchCudaPackages ? pkgs.cudaPackages_13_3,
  ...
}:
let
  # 必须采用 ComfyUI 模块的 override 做法：overrideScope 在
  # `withPackages appDependencies` 下不生效，会导致产出的环境缺少这些覆写。
  #
  # 环境装配：本地包接线与版本覆写/降级分别定义在 local-packages.nix /
  # version-pins.nix。两者用 composeExtensions 组合，顺序为“本地包在前、
  # 版本覆写/降级在后”，即先由 local-packages.nix 接入本地包，再由
  # version-pins.nix 在其上做版本覆写/降级。
  python = pkgs.python312.override {
    packageOverrides =
      lib.composeExtensions (import ./local-packages.nix { inherit pkgs inputs lib; }).overlay
        (
          import ./version-pins.nix {
            inherit
              pkgs
              inputs
              lib
              acceleration
              torchCudaPackages
              ;
          }
        );
  };

  appDependencies =
    ps: with ps; [
      # nixpkgs-provided
      scipy
      tensorboard
      librosa
      numba
      pytorch-lightning
      gradio
      ffmpeg-python
      # CPU-only（x86_64）下用 onnxruntime 替代 requirements 的 onnxruntime-gpu
      onnxruntime
      # onnx 1.23.2 依赖 ml-dtypes>=0.5.4；本 scope 已固定 ml-dtypes 0.5.4（见 version-pins.nix）
      onnx
      ml-dtypes
      tqdm
      pypinyin
      pyopenjtalk
      modelscope
      sentencepiece
      transformers
      peft
      chardet
      pyyaml
      psutil
      jieba
      opencc
      x-transformers
      rotary-embedding-torch
      ctranslate2
      av
      torchmetrics
      pydantic
      fastapi
      # webui_ng（api_v2 能力重实现）显式依赖：uvicorn（单进程服务）+
      # python-multipart（参考音频上传）+ soundfile（ogg 打包 / 参考音频 peaks）。
      # 此前仅经 gradio/librosa 传递引入，脆弱。
      uvicorn
      python-multipart
      soundfile
      faster-whisper
      torch
      torchaudio
      # locally packaged (see localPackageNames)；numpy 解析为本地 1.26.4
      numpy
      funasr
      cn2an
      g2p-en
      jieba-fast
      split-lang
      fast-langdetect
      wordsegment
      tojyutping
      g2pk2
      ko-pron
      python-mecab-ko
      # python-mecab-ko-dic 由 python-mecab-ko 传递引入，不重复列出
    ];

  pythonEnv = python.withPackages appDependencies;
in
{
  inherit python pythonEnv;
}
