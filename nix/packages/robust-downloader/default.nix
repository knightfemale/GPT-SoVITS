{
  lib,
  buildPythonPackage,
  fetchPypi,
  setuptools,
  colorlog,
  requests,
  tqdm,
}:

buildPythonPackage (finalAttrs: {
  pname = "robust-downloader";
  version = "0.0.2";
  pyproject = true;

  src = fetchPypi {
    inherit (finalAttrs) pname version;
    hash = "sha256-CMk4uW4xer5rA340IwqRvam11hPwCbykpHZkmXxh3pA=";
  };

  build-system = [ setuptools ];

  dependencies = [
    colorlog
    requests
    tqdm
  ];

  pythonImportsCheck = [ "robust_downloader" ];

  meta = {
    description = "A simple robust downloader written in Python";
    homepage = "https://github.com/fedebotu/robust-downloader";
    license = lib.licenses.asl20;
    platforms = lib.platforms.linux;
  };
})
