{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
}:

# Pure data package: bundles the pre-built mecab-ko-dic Korean dictionary
# binaries, so there is no compilation step. Metadata lives in setup.cfg and it
# is built through setup.py + setuptools (no pyproject.toml).
buildPythonPackage {
  pname = "python-mecab-ko-dic";
  version = "2.1.1.post2";
  format = "setuptools";

  src = fetchFromGitHub {
    owner = "jonghwanhyeon";
    repo = "python-mecab-ko-dic";
    rev = "ba4b7432b663ad7da4eafc52157a6400237d6854";
    hash = "sha256-GIB2XJoLhwhG8rckFPIv3unJeC3GGP2tatWQ9MXWfxE=";
  };

  nativeBuildInputs = [ setuptools ];

  dependencies = [ ];

  pythonImportsCheck = [ "mecab_ko_dic" ];

  meta = {
    description = "mecab-ko-dic packaged for Python";
    homepage = "https://github.com/jonghwanhyeon/python-mecab-ko-dic";
    license = lib.licenses.asl20;
    platforms = lib.platforms.linux;
  };
}
