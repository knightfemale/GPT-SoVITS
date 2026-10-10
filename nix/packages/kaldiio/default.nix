{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools,
  numpy,
}:

buildPythonPackage {
  pname = "kaldiio";
  version = "2.18.1";
  format = "setuptools";

  src = fetchFromGitHub {
    owner = "nttcslab-sp";
    repo = "kaldiio";
    rev = "7533933a533281c22046b53fd92995f87ad05cad";
    hash = "sha256-CssVH+Oxsw+it1mHdBhGIEYxoZ3OSr09eoankSjcxR0=";
  };

  nativeBuildInputs = [ setuptools ];

  dependencies = [ numpy ];

  postPatch = ''
    # setup_requires pulls pytest-runner (not packaged in nixpkgs) and makes
    # setuptools try to fetch it from the network during the build.
    sed -i -e "/setup_requires/d" -e "/tests_require/d" setup.py
  '';

  pythonImportsCheck = [ "kaldiio" ];

  # 实际为 NTT proprietary evaluation license（《SOFTWARE LICENSE AGREEMENT
  # FOR EVALUATION》），第 4(b) 条禁止再分发，故标记为 unfree。
  meta = {
    description = "Kaldi ark/scp reader/writer in pure Python";
    homepage = "https://github.com/nttcslab-sp/kaldiio";
    license = lib.licenses.unfree;
    platforms = lib.platforms.linux;
  };
}
