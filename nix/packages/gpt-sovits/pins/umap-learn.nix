{
  snapshots,
  ...
}:
final: prev: {
  # funasr 依赖 umap-learn；nixpkgs(2026) 0.5.12 要求 scikit-learn>=1.6，
  # 与 numpy<2 所需的 scikit-learn 1.5.0 冲突，降回 0.5.6。
  umap-learn = prev.umap-learn.overridePythonAttrs (old: {
    version = "0.5.6";
    src = snapshots.multiversePs.umap-learn.src;
    patches = [ ];
  });
}
