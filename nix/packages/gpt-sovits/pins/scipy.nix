{
  lib,
  pkgs,
  ...
}:
final: prev: {
  # === numpy<2 级联降级区块 ===
  # requirements.txt 硬约束 numpy<2，而 nixpkgs(2026) 已删除
  # `numpy_1` 别名，整条科学计算栈都默认 numpy>=2。因此必须在
  # 本 scope 内把 scipy / scikit-learn / numba / llvmlite /
  # librosa / umap-learn 一并降到兼容 numpy 1.26 的版本，否则
  # 任一环都会在构建期报 "numpy>=2 not satisfied"。
  #
  # scipy 降级：nixpkgs(2026) 的 scipy 1.18 要求 numpy>=2，与
  # requirements.txt 的 numpy<2 冲突。降到 numpy<2 时代最后一个
  # 兼容版本（scipy 1.14.x）。源码用 pkgs.fetchFromGitHub 直接抓取
  # scipy v1.14.1 的 tag（含 submodule）。
  scipy = prev.scipy.overridePythonAttrs (old: {
    version = "1.14.1";
    src = pkgs.fetchFromGitHub {
      owner = "scipy";
      repo = "scipy";
      tag = "v1.14.1";
      hash = "sha256-eYuUHr9wZMXvEsIhssGR35JnRBNGaOL/j1LNM5sHuYY=";
      fetchSubmodules = true;
    };
    # The 1.18 cross-compilation patch does not apply to 1.14.1.
    patches = [ ];
    # 1.18 的 meson 有 -Duse-system-libraries 选项，1.14.1 没有，
    # 去掉该 flag（保留 blas/lapack/cross-file 等其余 meson 参数）。
    mesonFlags = builtins.filter (f: !(lib.hasInfix "use-system-libraries" f)) old.mesonFlags;
    # scipy 1.14.1 的 pyproject 对构建期依赖设了上界，而 nixpkgs
    # 2026 提供的是更新的版本。这些上界官方注释说明只是“预防性”
    # 的（building against numpy 1.x works fine too），直接放开。
    postPatch = (old.postPatch or "") + ''
      substituteInPlace pyproject.toml \
        --replace-fail 'Cython>=3.0.8,<3.1.0' 'Cython' \
        --replace-fail 'pybind11>=2.12.0,<2.13.0' 'pybind11' \
        --replace-fail 'pythran>=0.14.0,<0.17.0' 'pythran' \
        --replace-fail 'numpy>=2.0.0rc1,<2.3' 'numpy' \
        --replace-fail 'meson-python>=0.15.0,<0.19.0' 'meson-python'
    '';
  });
}
