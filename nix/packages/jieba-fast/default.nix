{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
}:
buildPythonPackage {
  pname = "jieba-fast";
  # 上游 setup.py 双版本号坑：python2 时为 0.53、python3 时为 0.52；
  # 本包在 py3 下构建，故取 0.52。
  version = "0.52";
  format = "setuptools";

  src = fetchFromGitHub {
    owner = "deepcs233";
    repo = "jieba_fast";
    rev = "5e6b21dece184e1004a35bfd802c8772059de3ab";
    hash = "sha256-MOeTAajZ/gi8OSGSxxNk1oSqeXUhSGQ8/lAund+qlYI=";
  };

  # The SWIG-generated .c wrappers are checked in; only gcc (stdenv) is needed.
  # setuptools is required because setup.py uses the `distutils` shim on 3.12.
  nativeBuildInputs = [ setuptools ];

  pythonImportsCheck = [ "jieba_fast" ];

  meta = {
    description = "Use C and SWIG to speed up jieba Chinese word segmentation";
    homepage = "https://github.com/deepcs233/jieba_fast";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
  };
}
