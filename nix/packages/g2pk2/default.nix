{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
  jamo,
  nltk,
}:
buildPythonPackage {
  pname = "g2pk2";
  version = "0.0.3";
  format = "setuptools";

  src = fetchFromGitHub {
    owner = "tenebo";
    repo = "g2pk2";
    rev = "51ec92b05054913b7ec1a60fe3592f7228071360";
    hash = "sha256-2PRNYzOmRpCn7QpsXVBZdV7zTiXYO/yLVb9cmcrAfSo=";
  };

  nativeBuildInputs = [ setuptools ];

  dependencies = [
    jamo
    nltk
  ];

  # The import name is `g2pk2` (not `g2pkk`).
  # Data files idioms.txt / rules.txt / table.csv are shipped through
  # MANIFEST.in + include_package_data=True.
  pythonImportsCheck = [ "g2pk2" ];

  meta = {
    description = "g2pk2: updated fork of the g2pk Korean grapheme-to-phoneme module";
    homepage = "https://github.com/tenebo/g2pk2";
    license = lib.licenses.asl20;
    platforms = lib.platforms.linux;
  };
}
