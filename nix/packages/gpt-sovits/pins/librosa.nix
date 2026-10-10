{
  snapshots,
  ...
}:
final: prev: {
  # nixpkgs(2026) 的 librosa 1.0.0 要求 numpy>=2.1；降回 numpy<2
  # 兼容的 0.10.2.post1（src 复用 multiverse 2024-11-01）。
  librosa = prev.librosa.overridePythonAttrs (old: {
    version = "0.10.2.post1";
    src = snapshots.multiversePs.librosa.src;
    patches = [ ];
    # 0.10.2 比 1.0.0 多出 audioread / typing-extensions。
    dependencies = old.dependencies ++ [
      final.audioread
      final.typing-extensions
    ];
    # 其自测依赖图像基线/sklearn 旧行为，跨版本必失败；非本 app 所需。
    doCheck = false;
  });
}
