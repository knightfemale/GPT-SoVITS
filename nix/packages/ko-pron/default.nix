{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
}:
buildPythonPackage {
  pname = "ko-pron";
  version = "1.3";
  format = "setuptools";

  src = fetchFromGitHub {
    owner = "kord123";
    repo = "ko_pron";
    rev = "682a976b959405f55b6fcfa8a38c1b59ee56deec";
    hash = "sha256-2+RCh+togWGh7zuJA3gTxfw451r4zAyExHXIx+7a8N8=";
  };

  nativeBuildInputs = [ setuptools ];

  # Pure-python data (data.py) is bundled inside the package.
  pythonImportsCheck = [ "ko_pron" ];

  meta = {
    description = "Korean pronunciation and romanisation based on the Wiktionary ko-pron Lua module";
    homepage = "https://github.com/kord123/ko_pron";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
  };
}
