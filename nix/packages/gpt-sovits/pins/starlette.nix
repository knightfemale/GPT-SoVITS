{
  snapshots,
  ...
}:
final: prev: {
  # fastapi 0.112.0 依赖 starlette 0.37.2；必须与 fastapi 同代降级，否则
  # gradio 4.x 仍会命中 starlette 1.x 的 request-first 模板 API，运行期报
  # `TypeError: unhashable type: 'dict'`。取 multiverse 2024-11-01 版本。
  starlette =
    (final.callPackage
      "${snapshots.multiverse2024.path}/pkgs/development/python-modules/starlette/default.nix"
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
