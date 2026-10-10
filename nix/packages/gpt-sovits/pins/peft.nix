{
  snapshots,
  ...
}:
final: prev: {
  peft = prev.peft.overridePythonAttrs (old: {
    version = "0.13.2";
    src = snapshots.multiversePs.peft.src;
    patches = [ ];
    # nixpkgs 的 peft 派生按 0.18.1 编写，其 pytestCheckHook 的
    # disabledTestPaths 含 "tests/test_arrow.py"，而 0.13.2 源码无此文件，
    # 导致 pytestCheckHook 直接 "does not match any paths. Aborting"。
    # peft 仅为运行期依赖，测试与本 app 无关，关闭 check。
    doCheck = false;
  });
}
