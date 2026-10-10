{
  ...
}:
final: prev: {
  # imageio 2.37.2 的 nativeCheckInputs 通过 lib.concatAttrValues
  # optional-dependencies 拉入 astropy（fits extra）用于自测，而
  # nixpkgs 2026 的 astropy 8.0.0 运行期要求 numpy<3,>=2.0.0，与
  # 本 scope 的 numpy 1.26 不兼容（构建期校验报 Unmet dependencies）。
  # astropy 仅经此测试输入进入闭包，且与本 app 运行期无关；关闭
  # imageio 的 check 即可把 astropy（及其 pyerfa 链）整体移出构建闭包。
  imageio = prev.imageio.overridePythonAttrs (old: {
    doCheck = false;
  });
}
