{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
}:

buildPythonPackage {
  pname = "budoux";
  version = "0.9.3";
  pyproject = true;

  src = fetchFromGitHub {
    owner = "google";
    repo = "budoux";
    rev = "25946bbbb271dc8a53bb5b04082c6859abc5c847";
    hash = "sha256-qnoRc5mucb63xHWX/YrApncqqT/PhGwTsOPzsr8yRrc=";
  };

  build-system = [ setuptools ];

  # Pure Python, no runtime dependencies.
  dependencies = [ ];

  pythonImportsCheck = [ "budoux" ];

  meta = {
    description = "Line-break detection for Japanese and Chinese text";
    homepage = "https://github.com/google/budoux";
    license = lib.licenses.asl20;
    platforms = lib.platforms.linux;
  };
}
