{
  ...
}:
final: prev: {
  # accelerate 1.13.0 的自测在沙箱内收集阶段即报 7 个 collection error
  # （tests/deepspeed、tests/fsdp、test_big_modeling、test_cli 等，缺
  # deepspeed 等可选依赖），与包运行期无关；关闭 check 以免阻塞 devShell。
  accelerate = prev.accelerate.overridePythonAttrs (old: {
    doCheck = false;
  });
}
