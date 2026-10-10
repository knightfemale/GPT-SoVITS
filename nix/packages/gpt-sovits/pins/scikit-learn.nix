{
  pkgs,
  ...
}:
final: prev: {
  # nixpkgs scikit-learn 1.9 要求 numpy>=2；降到 1.5.0（支持 numpy 1.26）。
  # 1.5.0 的 pyproject 构建期要求 numpy>=2，放宽；1.9 的 patch 与
  # postPatch 针对 1.9，故清空 patches 并整体替换 postPatch。
  scikit-learn = prev.scikit-learn.overridePythonAttrs (old: {
    version = "1.5.0";
    src = pkgs.fetchPypi {
      pname = "scikit_learn";
      version = "1.5.0";
      hash = "sha256-eJ49sBx1DtbUlvott9UGN4V7RR5XvK6GO/9wfBJHvvc=";
    };
    patches = [ ];
    # 1.5.0 不依赖 narwhals（1.9 才引入）；同时避免拉入 narwhals 的
    # 测试依赖（pybreaker 等 flaky）。依赖集回到 1.5.0 的真实集合。
    dependencies = [
      final.joblib
      final.numpy
      final.scipy
      final.threadpoolctl
    ];
    # 测试依赖图很大（pytest-codspeed 等在当前 gcc 下编译失败），
    # 且非本 app 所需；跳过 check。
    doCheck = false;
    postPatch = ''
      substituteInPlace pyproject.toml \
        --replace-fail 'numpy>=2.0.0rc2' 'numpy'
      # 1.5.0 的 meson.build 用 `/usr/bin/env python version.py`
      # 探测版本；构建沙箱内没有 `python`，直接写死版本。
      substituteInPlace meson.build \
        --replace-fail \
        "version: run_command('sklearn/_build_utils/version.py', check: true).stdout().strip()," \
        "version: '1.5.0',"
    '';
  });
}
