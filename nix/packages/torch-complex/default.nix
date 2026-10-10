{
  lib,
  buildPythonPackage,
  fetchPypi,
  setuptools,
  packaging,
  numpy,
  torch,
}:

# The upstream Git repository (kamo-naoyuki/torch_complex) is no longer
# reachable over HTTPS, so the PyPI sdist is used as the source. Note that the
# PyPI distribution is named `torch_complex` (underscore).
buildPythonPackage (finalAttrs: {
  pname = "torch-complex";
  version = "0.4.4";
  format = "setuptools";

  src = fetchPypi {
    pname = "torch_complex";
    inherit (finalAttrs) version;
    hash = "sha256-QVP9aySgutaJ5vGTv70A84KDsYkNgIvvaE3cbR9j/T8=";
  };

  nativeBuildInputs = [ setuptools ];

  dependencies = [
    packaging
    numpy
    torch
  ];

  postPatch = ''
    # setup_requires pulls pytest-runner (not packaged in nixpkgs).
    sed -i -e "/setup_requires/d" -e "/tests_require/d" setup.py
  '';

  pythonImportsCheck = [ "torch_complex" ];

  meta = {
    description = "Differentiable complex tensor operations for PyTorch";
    homepage = "https://github.com/kamo-naoyuki/torch_complex";
    # PyPI classifiers declare Apache-2.0 (the sdist ships no LICENSE file).
    license = lib.licenses.asl20;
    platforms = lib.platforms.linux;
  };
})
