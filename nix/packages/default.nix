{
  lib,
  pkgs,
  inputs,
  ...
}:
let
  # CPU 环境的 python.pkgs，用于暴露 20 个本地打包依赖（见下）。
  py = (import ./gpt-sovits/env.nix { inherit pkgs inputs lib; }).python.pkgs;

  # Same list as nix/packages/gpt-sovits/local-packages.nix's `localPackageNames`;
  # exposing them lets you build any single package with e.g.
  # `nix build .#numpy` or `nix build .#funasr`.
  inherit (import ./gpt-sovits/local-packages.nix { inherit pkgs inputs lib; }) localPackageNames;

  # 单一包，用 acceleration 作为包参数在 CPU / CUDA（预编译 wheels）间切换：
  #   nix build .#gpt-sovits                                          # CPU（默认）
  #   nix build '.#gpt-sovits.override { acceleration = "cuda"; }'    # CUDA
  # `default` 仍为 CPU，且保持逐字节不变。
  gpt-sovits = lib.makeOverridable (
    {
      acceleration ? "cpu",
      ...
    }:
    let
      env = import ./gpt-sovits/env.nix {
        inherit
          pkgs
          inputs
          lib
          acceleration
          ;
      };
    in
    import ./gpt-sovits {
      inherit
        pkgs
        lib
        acceleration
        ;
      pythonEnv = env.pythonEnv;
    }
  ) { };
in
{
  inherit gpt-sovits;
  default = gpt-sovits;
}
// builtins.listToAttrs (
  map (n: {
    name = n;
    value = py.${n};
  }) localPackageNames
)
