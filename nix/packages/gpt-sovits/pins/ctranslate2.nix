{
  snapshots,
  ...
}:
final: prev: {
  # ctranslate2 4.5.0 的 python/ 目录只有 setup.py（无 pyproject.toml），
  # 而 prev（4.8.2）的配方基于 pyproject 且 postPatch 会改写 pyproject.toml，
  # 因此需切回 setuptools 格式并清空 postPatch；同时 python 绑定必须搭配
  # 同版本 C++ 库（prev 的 CTRANSLATE2_ROOT 指向 4.8.2，会与 4.5.0 绑定不匹配）。
  ctranslate2 = prev.ctranslate2.overridePythonAttrs (old: {
    version = "4.5.0";
    src = snapshots.multiversePs.ctranslate2.src;
    patches = [ ];
    pyproject = null;
    format = "setuptools";
    postPatch = "";
    env = (old.env or { }) // {
      CTRANSLATE2_ROOT = "${snapshots.multiverse2024.ctranslate2}";
    };
  });
}
