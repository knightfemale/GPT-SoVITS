{
  ...
}:
final: prev: {
  # httpx2 2.9.1（starlette/fastapi 的运行期依赖）自测中的
  # TestKeepalivePing.test_keepalive_ping[trio] 在沙箱内 flaky
  # （wsproto LocalProtocolError: cannot be sent in state
  # ConnectionState.LOCAL_CLOSING），与包本身无关；关闭 check 以免
  # 阻塞 devShell。
  httpx2 = prev.httpx2.overridePythonAttrs (old: {
    doCheck = false;
  });
}
