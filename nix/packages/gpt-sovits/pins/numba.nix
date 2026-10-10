{
  pkgs,
  ...
}:
final: prev: {
  numba = prev.numba.overridePythonAttrs (old: {
    version = "0.62.0";
    src = pkgs.fetchFromGitHub {
      owner = "numba";
      repo = "numba";
      tag = "0.62.0";
      hash = "sha256-y/mvmzMwTHc/tWg4WFqFJOThbFiIF71OHLvtztkT+hE=";
      postFetch = ''
        sed -i 's/git_refnames = "[^"]*"/git_refnames = " (tag: 0.62.0)"/' $out/numba/_version.py
      '';
    };
    # 0.62 运行期支持 numpy>=1.22,<2.4，但构建期写死 numpy>=2.0.0rc1，
    # 放宽构建期下界以便用 numpy 1.26.4 编译。
    postPatch = (old.postPatch or "") + ''
      substituteInPlace setup.py \
        --replace-fail 'min_numpy_build_version = "2.0.0rc1"' 'min_numpy_build_version = "1.22"' \
        --replace-fail 'max_numpy_run_version = "2.4"' 'max_numpy_run_version = "2.3"'
    '';
  });
}
