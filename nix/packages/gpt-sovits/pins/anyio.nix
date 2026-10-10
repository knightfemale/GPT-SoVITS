{
  ...
}:
final: prev: {
  # nixpkgs 锁定的 anyio 4.14.2 自测在当前 Python 3.12/OpenSSL 下
  # 有 flaky TLS 用例（server_hostname can only be specified in
  # client mode），失败与包本身无关；关闭其 check。
  anyio = prev.anyio.overridePythonAttrs (old: {
    doCheck = false;
  });
}
