inputs:
inputs.flake-parts.lib.mkFlake { inherit inputs; } {
  systems = [ "x86_64-linux" ];

  perSystem =
    {
      lib,
      config,
      system,
      ...
    }:
    let
      # allowUnfree: 已存在非自由许可依赖（kaldiio = NTT proprietary evaluation license）
      pkgs = import inputs.nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
          # modelscope 因 CVE-2026-84202 被 nixpkgs 标记 insecure；GPT-SoVITS 需要它。
          # 仅放行 modelscope，避免全局 allowInsecure。
          allowInsecurePredicate = p: (p.pname or "") == "modelscope";
        };
      };
    in
    {
      _module.args.pkgs = pkgs;

      packages = import ./packages {
        inherit
          lib
          pkgs
          inputs
          ;
      };
      devShells =
        (import ./devShells/default.nix {
          inherit
            lib
            pkgs
            inputs
            ;
        })
        // (import ./devShells/cuda.nix {
          inherit
            lib
            pkgs
            inputs
            ;
        });
      apps =
        (import ./apps/default.nix {
          inherit
            lib
            config
            ;
        })
        // (import ./apps/cuda.nix {
          inherit
            lib
            config
            ;
        });
    };

  flake = {
    nixosModules.default = import ./nixosModules {
      inherit inputs;
    };
  };
}
