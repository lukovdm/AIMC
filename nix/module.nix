# Simple NixOS module for running AIMC on a demo server.
#
# Usage in your system flake:
#
#   inputs.aimc.url = "github:lukovdm/AIMC";
#
#   nixosConfigurations.myserver = nixpkgs.lib.nixosSystem {
#     modules = [
#       aimc.nixosModules.default
#       {
#         services.aimc = {
#           enable          = true;
#           package         = aimc.packages.x86_64-linux.aimc;
#           frontendPackage = aimc.packages.x86_64-linux.aimc-frontend;
#           environmentFile = "/run/secrets/aimc-env";
#         };
#         networking.firewall.allowedTCPPorts = [ 80 ];
#       }
#     ];
#   };
#
# /run/secrets/aimc-env should contain:
#   MISTRAL_API_KEY=sk-...
#   OCR_PROVIDER=mistral          # optional, defaults to mistral

{ config, lib, pkgs, ... }:

let
  cfg = config.services.aimc;
in
{
  options.services.aimc = {
    enable = lib.mkEnableOption "AIMC demo server";

    package = lib.mkOption {
      type = lib.types.package;
      description = "The aimc Python venv package.";
    };

    frontendPackage = lib.mkOption {
      type = lib.types.package;
      description = "The pre-built frontend static files.";
    };

    port = lib.mkOption {
      type    = lib.types.port;
      default = 8000;
      description = "Port the FastAPI backend listens on.";
    };

    environmentFile = lib.mkOption {
      type = lib.types.path;
      description = "File with API keys (KEY=value lines). Must not be in the Nix store.";
    };
  };

  config = lib.mkIf cfg.enable {

    systemd.services.aimc = {
      description = "AIMC backend";
      wantedBy = [ "multi-user.target" ];
      after    = [ "network.target" ];
      serviceConfig = {
        DynamicUser      = true;
        StateDirectory   = "aimc";   # /var/lib/aimc — where aimc.db lives
        WorkingDirectory = "/var/lib/aimc";
        EnvironmentFile  = cfg.environmentFile;
        ExecStart        = "${cfg.package}/bin/uvicorn aimc.main:app --host 127.0.0.1 --port ${toString cfg.port}";
        Restart          = "on-failure";
      };
    };

    services.nginx = {
      enable = true;
      virtualHosts.default = {
        default = true;
        root    = "${cfg.frontendPackage}";
        locations."/" .tryFiles    = "$uri $uri/ /index.html";
        locations."/api".proxyPass = "http://127.0.0.1:${toString cfg.port}";
        locations."/api".extraConfig = "client_max_body_size 20M;";
      };
    };
  };
}
