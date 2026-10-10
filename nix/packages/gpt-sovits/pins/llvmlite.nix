{
  pkgs,
  ...
}:
final: prev: {
  # numba/llvmlite 需要 numpy<2。nixpkgs numba 0.67 要求
  # numpy>=2，降到支持 numpy 1.26 的 numba 0.62 + llvmlite 0.45
  # （llvmlite 0.45 对应 LLVM 20，nixpkgs 仍有 llvmPackages_20）。
  llvmlite = prev.llvmlite.overridePythonAttrs (old: {
    version = "0.45.0";
    src = pkgs.fetchFromGitHub {
      owner = "numba";
      repo = "llvmlite";
      tag = "v0.45.0";
      hash = "sha256-ifJ+CapLe2iEHuipte0SPKvyRCnP6pixaFxMXd5Hk2M=";
    };
    buildInputs = [
      pkgs.llvmPackages_20.llvm
      pkgs.libxml2.dev
    ];
    # setuptools 83 的 vendored distutils `spawn` 不再接受 dry_run
    # 关键字；构建期该值恒为 False，直接去掉。
    postPatch = (old.postPatch or "") + ''
      substituteInPlace setup.py \
        --replace-fail 'spawn(cmd, dry_run=dry_run)' 'spawn(cmd)'
    '';
  });
}
