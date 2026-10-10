{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
}:
buildPythonPackage {
  pname = "tojyutping";
  version = "3.2.0";
  format = "setuptools";

  src = fetchFromGitHub {
    owner = "CanCLID";
    repo = "ToJyutping";
    tag = "3.2.0";
    hash = "sha256-gwV6y1GVo0mUqb1In4Gw6TZOifpMxT9exIzCzsarnLE=";
  };

  nativeBuildInputs = [ setuptools ];

  # src-layout (`package_dir={'': 'src'}`), package dir is `ToJyutping`;
  # `trie.txt` is shipped via explicit package_data.
  pythonImportsCheck = [ "ToJyutping" ];

  meta = {
    description = "Cantonese Pronunciation Automatic Labeling Tool";
    homepage = "https://github.com/CanCLID/ToJyutping";
    license = lib.licenses.bsd2;
    platforms = lib.platforms.linux;
  };
}
