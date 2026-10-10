{
  ...
}:
final: prev: {
  # numcodecs 0.16.5（zarr 的依赖）运行期只要求 numpy>=1.24，但
  # pyproject 的 [build-system].requires 写死 `numpy>2`，构建期校验
  # 报 `Unmet dependencies: numpy>2 wanted: >2 found: 1.26.4`。其 C
  # 扩展本身兼容 numpy 1.x，直接放宽该构建期上/下界。
  numcodecs = prev.numcodecs.overridePythonAttrs (old: {
    postPatch = (old.postPatch or "") + ''
      substituteInPlace pyproject.toml \
        --replace-fail '"numpy>2"' '"numpy"'
    '';
  });
}
