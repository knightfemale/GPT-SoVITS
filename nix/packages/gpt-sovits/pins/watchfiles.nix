{
  ...
}:
final: prev: {
  # watchfiles 1.2.0 的文件系统监视自测依赖内核 inotify 事件时序，
  # 在构建沙箱内会多收到 Change.modified 事件而必失败（3 failed:
  # test_watch / test_awatch / test_watch_polling_not_env），与包本身
  # 无关；它是 gradio 的传递依赖，关闭 check 以免阻塞 devShell。
  watchfiles = prev.watchfiles.overridePythonAttrs (old: {
    doCheck = false;
  });
}
