{
  ...
}:
final: prev: {
  # scikit-image 0.26.0（gradio 的依赖）运行期要求 numpy>=1.24，但
  # [build-system].requires 写死 `numpy>=2.0`（及 build extra 同款），
  # 运行期校验会报 numpy>=2.0 未满足。放宽构建期约束以匹配 numpy 1.26。
  scikit-image = prev.scikit-image.overridePythonAttrs (old: {
    postPatch = (old.postPatch or "") + ''
      substituteInPlace pyproject.toml \
        --replace-fail "'numpy>=2.0'" "'numpy>=1.24'"
    '';
  });
}
