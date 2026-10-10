{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
}:
buildPythonPackage (finalAttrs: {
  pname = "wordsegment";
  version = "1.3.1";
  format = "setuptools";

  src = fetchFromGitHub {
    owner = "grantjenks";
    repo = "python-wordsegment";
    tag = "v${finalAttrs.version}";
    hash = "sha256-/E0woT1XpZ8UvDzzOsxdZlNhwTo8bpCERy06E2g3BC8=";
  };

  nativeBuildInputs = [ setuptools ];

  # The word lists (words.txt, unigrams.txt, bigrams.txt) are shipped through
  # MANIFEST.in + include_package_data=True.
  pythonImportsCheck = [ "wordsegment" ];

  meta = {
    description = "English word segmentation";
    homepage = "http://www.grantjenks.com/docs/wordsegment/";
    license = lib.licenses.asl20;
    platforms = lib.platforms.linux;
  };
})
