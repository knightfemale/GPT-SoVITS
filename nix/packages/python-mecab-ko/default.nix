{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
  pybind11,
  mecab,
  python-mecab-ko-dic,
}:
buildPythonPackage (finalAttrs: {
  pname = "python-mecab-ko";
  version = "1.3.7";
  pyproject = true;

  src = fetchFromGitHub {
    owner = "jonghwanhyeon";
    repo = "python-mecab-ko";
    tag = "v${finalAttrs.version}";
    hash = "sha256-Mtyzq6C7wLx/YNg+9ckiUbbX0LKCcVHRuW6kvs3SAP0=";
  };

  build-system = [ setuptools ];
  # setup.py imports `pybind11.setup_helpers` and builds a C++14 extension
  # that links against libmecab (discovered via `mecab-config`). `mecab-config`
  # must be on PATH at build time, hence mecab goes in nativeBuildInputs.
  nativeBuildInputs = [
    pybind11
    mecab
  ];
  buildInputs = [ mecab ];

  dependencies = [ python-mecab-ko-dic ];

  pythonImportsCheck = [ "mecab" ];

  meta = {
    description = "A python binding for mecab-ko";
    homepage = "https://github.com/jonghwanhyeon/python-mecab-ko";
    license = lib.licenses.bsd3;
    platforms = lib.platforms.linux;
  };
})
