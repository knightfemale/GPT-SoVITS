{
  snapshots,
  ...
}:
final: prev: {
  # torchmetrics 1.4.3 的 setup.py 依赖 `pkg_resources`（pkg_resources.Requirement
  # 的 `.specs` 元组接口），而本 scope 的 setuptools 83 已彻底移除 pkg_resources。
  # 这里显式把 build-system 固定为 ps2026 的 setuptools 80.x（仍带 pkg_resources），
  # 它在 nativeBuildInputs 中排在 pypa-build-hook 传递进来的 setuptools 83 之后，
  # 因此在 PYTHONPATH 中优先。
  torchmetrics = prev.torchmetrics.overridePythonAttrs (old: {
    version = "1.4.3";
    src = snapshots.multiversePs.torchmetrics.src;
    patches = [ ];
    build-system = [ snapshots.ps2026.python312Packages.setuptools ];
  });
}
