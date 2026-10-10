{
  ...
}:
final: prev: {
  # faster-whisper 1.2.1 默认依赖 scope 的 huggingface-hub 1.30.0，而它
  # 依赖的 tokenizers 0.21.1 依赖 huggingface-hub_0（0.36.2），会在其闭包
  # 内出现重复包，python-catch-conflicts-hook 直接报错。requirements 要求
  # huggingface_hub<1.0，故把 faster-whisper 也统一到 huggingface-hub_0。
  faster-whisper = prev.faster-whisper.overridePythonAttrs (old: {
    dependencies = [
      final.av
      final.ctranslate2
      final."huggingface-hub_0"
      final.onnxruntime
      final.tokenizers
    ];
  });
}
