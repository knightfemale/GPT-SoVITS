{
  ...
}:
final: prev: {
  # narwhals 2.23.0（altair → gradio 的运行期依赖）在 nixpkgs 里开启了
  # 自测，其 nativeCheckInputs 通过 optional-dependencies 拉入
  # sqlframe → databricks-sql-connector → pybreaker；其中 pybreaker
  # 1.4.1 的 redis 并发用例在沙箱内 flaky（`assert 2 == 1`），进而
  # 逐级拖垮 databricks-sql-connector / sqlframe / narwhals / altair /
  # gradio。这些纯属测试依赖，与本 app 无关；关闭 narwhals 的 check
  # 即可把整条测试链移出构建闭包（check 输入仅在 doCheck 时加入）。
  narwhals = prev.narwhals.overridePythonAttrs (old: {
    doCheck = false;
  });
}
