{
  lib,
  buildPythonPackage,
  fetchPypi,
  setuptools,
  pybind11,
  wheel,
}:

# This package installs an importable module literally named `fasttext`, which
# COLLIDES with the `fasttext` Python package from facebook (nixpkgs
# `fasttext`). They cannot coexist in the same Python environment.
#
# Upstream searxng/fasttext-predict was archived on 2026-03-02 and its codeload
# archive now 404s, so the PyPI sdist is used as the source.
buildPythonPackage (finalAttrs: {
  pname = "fasttext-predict";
  version = "0.9.2.4";
  pyproject = true;

  src = fetchPypi {
    pname = "fasttext_predict";
    inherit (finalAttrs) version;
    hash = "sha256-GKb7DXTH35KA2x+Wy3XZkL/QBPqdZpST6j3T1U+E28c=";
  };

  # pyproject.toml build-system requires setuptools>=42, pybind11>=2.10.0 and
  # wheel; pybind11 is needed to compile the C++17 pybind11 extension
  # (`fasttext_pybind`).
  build-system = [
    setuptools
    pybind11
    wheel
  ];

  # Upstream declares no runtime dependencies (the extension is self-contained).
  dependencies = [ ];

  pythonImportsCheck = [ "fasttext" ];

  meta = {
    description = "fastText predictor (pybind11, predict-only, no external dependency)";
    homepage = "https://github.com/searxng/fasttext-predict/";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
  };
})
