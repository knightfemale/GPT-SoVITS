{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
}:

# NOTE: 随包的 LICENSE 为 GPL-2.0（“version 2 … or later”），而上游 setup.py
# 头部声明 GPLv3+，二者不一致，这里取更保守的 gpl2Plus。
buildPythonPackage {
  pname = "distance";
  version = "0.1.3";
  format = "setuptools";

  src = fetchFromGitHub {
    owner = "doukremt";
    repo = "distance";
    rev = "ad7f9dc7e9b0e88a08d0cefd1442f4ab1dd1779b";
    hash = "sha256-nu/vT1KHlhHJVE92L16laBH2fzlUy9al78j4ZkABlu0=";
  };

  nativeBuildInputs = [ setuptools ];

  postPatch = ''
    # Python 3.12 removed distutils; use setuptools' bundled shim explicitly.
    sed -i "s/^from distutils\.core import/from setuptools import/" setup.py
  '';

  # NOTE: upstream once shipped a C extension (`distance.cdistance`) but the
  # bundled `cdistance/distance.c` uses the removed Python 2 C API
  # (`PyUnicode_AS_UNICODE`, ...) and there is no `.pyx` to regenerate it from,
  # so only the pure-Python implementation is installed.
  dependencies = [ ];

  pythonImportsCheck = [ "distance" ];

  meta = {
    description = "Python module for computing various distance metrics";
    homepage = "https://github.com/doukremt/distance";
    license = lib.licenses.gpl2Plus;
    platforms = lib.platforms.linux;
  };
}
