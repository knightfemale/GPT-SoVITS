{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
}:

buildPythonPackage {
  pname = "proces";
  version = "0.1.7";
  format = "setuptools";

  src = fetchFromGitHub {
    owner = "Ailln";
    repo = "proces";
    rev = "622d37aa378cdae2010ee40834067e4698f6ec3a";
    hash = "sha256-7KAI6N19nyh6zsTQKeZ1amb9DTzNG1TqQTOzbVndiuk=";
  };

  nativeBuildInputs = [ setuptools ];

  # Pure Python, no runtime dependencies.
  dependencies = [ ];

  pythonImportsCheck = [ "proces" ];

  meta = {
    description = "Chinese text processing library (proces)";
    homepage = "https://github.com/Ailln/proces";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
  };
}
