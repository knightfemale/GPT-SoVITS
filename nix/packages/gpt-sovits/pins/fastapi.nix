{
  snapshots,
  ...
}:
final: prev: {
  # gradio 4.44.1 与 nixpkgs(2026) 的 starlette 1.x 不兼容：gradio 4.x 调用旧式
  # `templates.TemplateResponse(name, context)`，而 starlette 1.x 的签名已改为
  # request-first，运行期报 `TypeError: unhashable type: 'dict'`。降到 multiverse
  # 2024-11-01 同代版本（0.112.0），与 gradio 4.44.1 / starlette 0.37.2 配套。
  fastapi =
    (final.callPackage
      "${snapshots.multiverse2024.path}/pkgs/development/python-modules/fastapi/default.nix"
      { }
    ).overridePythonAttrs
      (old: {
        doCheck = false;
        nativeCheckInputs = [ ];
        dontCheckRuntimeDeps = true;
        # multiverse 2024 的配方使用已废弃的 pytestFlagsArray，本 scope 的
        # buildPythonPackage 会直接报错；置空即可。
        pytestFlagsArray = [ ];
      });
}
