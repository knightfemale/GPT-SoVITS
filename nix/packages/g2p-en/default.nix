{
  lib,
  buildPythonPackage,
  fetchPypi,
  setuptools,
  numpy,
  nltk,
  inflect,
  distance,
}:
buildPythonPackage (finalAttrs: {
  pname = "g2p-en";
  version = "2.1.0";
  # 2.1.0 only exists as a PyPI sdist (the GitHub repo has no such tag).
  format = "setuptools";

  src = fetchPypi {
    # NOTE: the PyPI artefact is uploaded as `g2p_en-2.1.0.tar.gz`
    # (hyphen in the project name, underscore in the file name).
    pname = "g2p_en";
    inherit (finalAttrs) version;
    hash = "sha256-MuyxGYJ6OxDqjBGXJ29OpPRAcK5Wy70B8PJhh19Valg=";
  };

  nativeBuildInputs = [ setuptools ];

  dependencies = [
    numpy
    nltk
    inflect
    distance
  ];

  doCheck = false;
  pythonImportsCheck = [ "g2p_en" ];

  meta = {
    description = "A Simple Python Module for English Grapheme To Phoneme Conversion";
    homepage = "https://github.com/Kyubyong/g2p";
    license = lib.licenses.asl20;
    platforms = lib.platforms.linux;
  };
})
