{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
  proces,
}:
buildPythonPackage {
  pname = "cn2an";
  version = "0.5.24";
  format = "setuptools";

  src = fetchFromGitHub {
    owner = "Ailln";
    repo = "cn2an";
    rev = "7c9ba0770b129960d9b6e6c6b2b46c00ec580778";
    hash = "sha256-CGg0XFn93EHR4Fsbl8KpPNX6BNbVDi316QiPJlq/QBw=";
  };

  nativeBuildInputs = [ setuptools ];

  dependencies = [ proces ];

  pythonImportsCheck = [ "cn2an" ];

  meta = {
    description = "Convert Chinese numerals and Arabic numerals";
    homepage = "https://github.com/Ailln/cn2an";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
  };
}
