{
  snapshots,
  ...
}:
final: prev: {
  # nixpkgs(2026-10) 的 ml-dtypes 0.6.0 wheel 元数据要求 numpy>=2.0，
  # 与本 scope 的 numpy 1.26.4 冲突（pythonRuntimeDepsCheckHook 报
  # `numpy~=2.0 wanted: ~=2.0 found: 1.26.4`），并级联拖垮 onnx /
  # onnxruntime。multiverse 2026-01-01 快照仍有 0.5.4：最后一个运行期
  # 兼容 numpy 1.26、且满足 onnx 1.23.2 `ml_dtypes>=0.5.4` 的版本。
  # 直接复用该快照的派生定义（与 transformers/scipy 的做法一致），
  # 只把依赖解析绑定到本 scope 的 numpy/setuptools，并放宽其
  # build-system.requires（numpy~=2.0），使 C++ 扩展按 numpy 1.26 编译。
  ml-dtypes =
    (final.callPackage "${snapshots.ps2026.path}/pkgs/development/python-modules/ml-dtypes/default.nix"
      { }
    ).overridePythonAttrs
      (old: {
        # 上游测试依赖 numpy 2 的若干新行为，且非本 app 所需。
        doCheck = false;
        nativeCheckInputs = [ ];
        postPatch = (old.postPatch or "") + ''
          substituteInPlace pyproject.toml \
            --replace 'numpy~=2.0' 'numpy' \
            --replace 'setuptools~=80.9.0' 'setuptools'
        '';
      });
}
