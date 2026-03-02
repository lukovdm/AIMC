{
  description = "AIMC – Python project with uv, managed via NixOS flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix-direnv.url = "github:nix-community/nix-direnv";
    uv2nix = {
      url = "github:pyproject-nix/uv2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    pyproject-nix = {
      url = "github:pyproject-nix/pyproject.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    pyproject-build-systems = {
      url = "github:pyproject-nix/build-system-pkgs";
      inputs.pyproject-nix.follows = "pyproject-nix";
      inputs.uv2nix.follows = "uv2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, nix-direnv, uv2nix, pyproject-nix, pyproject-build-systems }:
    let
      # Expose the NixOS module at the top level so it is system-independent.
      nixosModules.default = import ./nix/module.nix;
    in
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # -----------------------------------------------------------------------
        # Python package via uv2nix
        # -----------------------------------------------------------------------
        workspace = uv2nix.lib.workspace.loadWorkspace { workspaceRoot = ./.; };

        overlay = workspace.mkPyprojectOverlay {
          sourcePreference = "wheel";
        };

        python = pkgs.python313;

        pythonSet =
          (pkgs.callPackage pyproject-nix.build.packages {
            inherit python;
          }).overrideScope
            (pkgs.lib.composeManyExtensions [
              pyproject-build-systems.overlays.wheel
              overlay
            ]);

        # A virtual environment containing uvicorn + the aimc package + all deps
        venv = pythonSet.mkVirtualEnv "aimc-env" workspace.deps.default;

        # Wrap into a package: bin/uvicorn is the entry point used by the module
        aimcPackage = pkgs.runCommand "aimc" {} ''
          mkdir -p $out/bin $out/lib
          cp -r ${venv}/. $out/
        '';

        # -----------------------------------------------------------------------
        # Frontend static build
        # -----------------------------------------------------------------------
        frontendPackage = pkgs.buildNpmPackage {
          pname = "aimc-frontend";
          version = "0.1.0";
          src = ./frontend;
          npmDepsHash = "sha256-Q61/gvEMx/0ohSUwKKNr1RBnk7JjUpuFa2CLlL13ZYY=";
          buildPhase = "npm run build";
          installPhase = "cp -r dist $out";
        };

      in
      {
        # Expose packages for `nix build`
        packages = {
          aimc = aimcPackage;
          aimc-frontend = frontendPackage;
          default = aimcPackage;
        };

        # Pass the module through per-system outputs too (convenience)
        inherit nixosModules;

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
      }) // {
        # Also expose at the top-level flake output
        inherit nixosModules;
      };
}
