{
  lib,
  buildPythonPackage,
  fetchPypi,

  # build-system
  meson-python,
  cython,
  pkg-config,
  gfortran,

  # native dependencies
  blas,
  lapack,
}:

# Self-built numpy 1.26.x: the nixpkgs `numpy` is 2.x and `numpy_1` is a
# deprecated, throwing alias. Built with Meson (numpy >= 1.26 does not support
# setuptools) and linked against nixpkgs' BLAS/LAPACK instead of the vendored
# (slow) reference implementation.
buildPythonPackage (finalAttrs: {
  pname = "numpy";
  version = "1.26.4";
  pyproject = true;

  src = fetchPypi {
    inherit (finalAttrs) pname version;
    hash = "sha256-KgKrqe0S5KxOs+qUIcQgMBoMZGDZgw10qd+H76SRIBA=";
  };

  build-system = [
    meson-python
    cython
    pkg-config
    gfortran
  ];

  buildInputs = [
    blas
    lapack
  ];

  # nixpkgs ships Cython 3.2.x and meson-python 0.20, both newer than the
  # (upper-bounded) build requirements declared by numpy 1.26.4. They work, so
  # drop the version bounds to let the build proceed.
  postPatch = ''
    substituteInPlace pyproject.toml \
      --replace-fail "Cython>=0.29.34,<3.1" "Cython" \
      --replace-fail "meson-python>=0.15.0,<0.16.0" "meson-python"
  '';

  # nixpkgs python modules (scipy, scikit-learn) read these attributes from the
  # numpy package at evaluation time; numpy 1.26 still uses the legacy
  # `numpy/core/include` layout (the `_core` rename is a numpy 2 change).
  # 使用 finalAttrs.finalPackage 得到静态 store 路径；不能用 placeholder，
  # 否则字符串被 scipy 的 cross-file 派生引用时会解析成 cross-file 的输出路径。
  passthru = {
    blas = blas.provider;
    blasImplementation = blas.implementation;
    coreIncludeDir = "${finalAttrs.finalPackage}/lib/python3.12/site-packages/numpy/core/include";
  };

  pythonImportsCheck = [ "numpy" ];

  # The upstream test-suite is very large and pulls in extra test-only deps;
  # it is not needed for the app environment.
  doCheck = false;

  meta = {
    description = "Scientific computing library for Python";
    homepage = "https://numpy.org";
    license = lib.licenses.bsd3;
    platforms = lib.platforms.linux;
  };
})
