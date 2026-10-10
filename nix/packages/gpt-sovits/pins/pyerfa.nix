{
  ...
}:
final: prev: {
  # pyerfa 2.0.1.5（astropy 的依赖，经 scikit-image/gradio 引入）的
  # pyproject [build-system].requires 写死 `numpy>=2.0.0rc1`，运行期
  # 校验报 `Unmet dependencies: numpy>=2.0.0rc1 ... found: 1.26.4`。
  # 其 [project].dependencies 只要求 numpy>=1.19.3，C 扩展兼容 1.x，
  # 放宽构建期下界即可。
  pyerfa = prev.pyerfa.overridePythonAttrs (old: {
    postPatch = (old.postPatch or "") + ''
      substituteInPlace pyproject.toml \
        --replace-fail '"numpy>=2.0.0rc1"' '"numpy"'
    '';
  });
}
