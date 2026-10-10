{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  pdm-backend,
  robust-downloader,
  requests,
  fasttext-predict,
}:
buildPythonPackage {
  pname = "fast-langdetect";
  version = "0.3.2";
  pyproject = true;

  src = fetchFromGitHub {
    owner = "LlmKira";
    repo = "fast-langdetect";
    tag = "pypi_0.3.2";
    hash = "sha256-p+OpdobS9H0c6ZDahDcGa3KY1k9jZYUU9hIksCckmcE=";
  };

  build-system = [ pdm-backend ];

  dependencies = [
    robust-downloader
    requests
    fasttext-predict
  ];

  # src-layout (`src/fast_langdetect`); resource files are included by pdm.
  pythonImportsCheck = [ "fast_langdetect" ];

  meta = {
    description = "Quickly detect text language and segment language";
    homepage = "https://github.com/LlmKira/fast-langdetect";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
  };
}
