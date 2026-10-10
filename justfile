
update:
    nix flake update

format:
    treefmt .

build-nix *args:
    nom build .#default -- {{args}}

run-nix *args:
    nix run .#default -- {{args}} |& nom
