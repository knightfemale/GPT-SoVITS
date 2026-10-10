{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
  fast-langdetect,
  pydantic,
  budoux,
}:
buildPythonPackage (finalAttrs: {
  pname = "split-lang";
  version = "2.1.0";
  format = "setuptools";

  # Note: the repo is `DoodleBears/split-lang` (hyphen); the `langsplit` URL
  # advertised on PyPI is a dead link.
  src = fetchFromGitHub {
    owner = "DoodleBears";
    repo = "split-lang";
    tag = "v${finalAttrs.version}";
    hash = "sha256-eUBt8kHmbfR5wLVLfE7MEHWlCy0WWxmuKfBLDzmtggU=";
  };

  nativeBuildInputs = [ setuptools ];

  dependencies = [
    fast-langdetect
    pydantic
    budoux
  ];

  pythonImportsCheck = [ "split_lang" ];

  meta = {
    description = "Split text by languages through concatenating over split substrings based on their language";
    homepage = "https://github.com/DoodleBears/split-lang";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
  };
})
