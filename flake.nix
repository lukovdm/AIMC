{
  description = "AIMC – Python project with uv, managed via NixOS flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix-direnv.url = "github:nix-community/nix-direnv";
  };

  outputs = { self, nixpkgs, flake-utils, nix-direnv }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            python3
            uv
            direnv
            nix-direnv.packages.${system}.default
          ];

          shellHook = ''
            echo "🐍 Python $(python3 --version) | uv $(uv --version)"
            echo "Run 'uv sync' to install project dependencies."
          '';
        };
      });
}
