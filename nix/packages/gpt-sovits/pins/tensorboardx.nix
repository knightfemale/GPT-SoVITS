{
  ...
}:
final: prev: {
  # tensorboardx 2.6.4 的自测在沙箱内报
  # `TypeError: reshape() got an unexpected keyword argument 'shape'`
  # （tests/test_utils.py、tests/test_writer.py），与包运行期无关；
  # tensorboardx 仅为 pytorch-lightning 的运行期依赖，关闭 check。
  tensorboardx = prev.tensorboardx.overridePythonAttrs (old: {
    doCheck = false;
  });
}
