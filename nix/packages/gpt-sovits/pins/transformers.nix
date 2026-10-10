{
  snapshots,
  ...
}:
final: prev: {
  transformers = prev.transformers.overridePythonAttrs (old: {
    version = "4.52.4";
    src = snapshots.ps2025.transformers.src;
    patches = [ ];
    # transformers 4.52 的核心 install_requires；"huggingface-hub_0"
    # 是 nixpkgs 现成的 0.36.2（满足 <1.0）。
    dependencies = [
      final.filelock
      final."huggingface-hub_0"
      final.numpy
      final.packaging
      final.pyyaml
      final.regex
      final.requests
      final.tokenizers
      final.safetensors
      final.tqdm
    ];
  });
}
