{
  description = "GPT-SoVITS devshell, package and NixOS module";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };
    nixpkgs-multiverse.url = "github:fzakaria/nixpkgs-multiverse";
  };

  outputs = inputs: import ./nix inputs;
}
