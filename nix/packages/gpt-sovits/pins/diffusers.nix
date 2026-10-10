{
  ...
}:
final: prev: {
  # diffusers 0.38.0 的 setup.py install_requires 明确包含 httpx<1.0.0，
  # 但 nixpkgs 的 diffusers 派生 dependencies 漏列 httpx。默认 hub 1.30.0
  # 会传递带入 httpx 掩盖该问题；本 scope 把 hub 降到 0.36.2（改用
  # requests，不再传递 httpx）后，pythonRuntimeDepsCheck 便报
  # "httpx not installed"。这里补上运行期依赖。
  diffusers = prev.diffusers.overridePythonAttrs (old: {
    dependencies = (old.dependencies or [ ]) ++ [ final.httpx ];
  });
}
