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
#
#           # HTTPS option A — ACME / Let's Encrypt (needs a public domain):
#           hostname = "aimc.example.com";
#           ssl.acme = true;
#
#           # HTTPS option B — bring your own cert:
#           # hostname = "aimc.example.com";
#           # ssl.certFile = "/run/secrets/aimc.crt";
#           # ssl.keyFile  = "/run/secrets/aimc.key";
#         };
#         # Open ports in the firewall:
#         networking.firewall.allowedTCPPorts = [ 80 443 ];
#         # Required for ACME:
#         security.acme.acceptTerms = true;
#         security.acme.defaults.email = "admin@example.com";
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
  hasCustomCert = cfg.ssl.certFile != null && cfg.ssl.keyFile != null;
  hasSsl = cfg.ssl.acme || hasCustomCert;
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

    hostname = lib.mkOption {
      type    = lib.types.str;
      default = "localhost";
      description = "Public hostname nginx serves. Required when using SSL.";
    };

    port = lib.mkOption {
      type    = lib.types.port;
      default = 8000;
      description = "Port the FastAPI backend listens on (not externally exposed).";
    };

    ssl = {
      acme = lib.mkOption {
        type    = lib.types.bool;
        default = false;
        description = ''
          Obtain a TLS certificate automatically via ACME / Let's Encrypt.
          Requires a public domain in `hostname` and open ports 80 + 443.
          You must also set security.acme.acceptTerms = true and
          security.acme.defaults.email in your system config.
        '';
      };

      certFile = lib.mkOption {
        type    = lib.types.nullOr lib.types.path;
        default = null;
        description = "Path to a PEM certificate file (for bring-your-own-cert setups).";
      };

      keyFile = lib.mkOption {
        type    = lib.types.nullOr lib.types.path;
        default = null;
        description = "Path to a PEM private key file (for bring-your-own-cert setups).";
      };
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
        Environment      = "AIMC_DB_PATH=/var/lib/aimc/aimc.db";
        EnvironmentFile  = cfg.environmentFile;
        ExecStart        = "${cfg.package}/bin/uvicorn aimc.main:app --host 127.0.0.1 --port ${toString cfg.port}";
        Restart          = "on-failure";
      };
    };

    services.nginx = {
      enable = true;
      virtualHosts."aimc" = {
        default    = true;
        serverName = cfg.hostname;

        # SSL via ACME
        enableACME = cfg.ssl.acme;
        forceSSL   = hasSsl;

        # SSL via custom cert
        sslCertificate    = lib.mkIf hasCustomCert cfg.ssl.certFile;
        sslCertificateKey = lib.mkIf hasCustomCert cfg.ssl.keyFile;

        root = "${cfg.frontendPackage}";
        locations."/" .tryFiles    = "$uri $uri/ /index.html";
        locations."/api".proxyPass = "http://127.0.0.1:${toString cfg.port}";
        locations."/api".extraConfig = "client_max_body_size 20M;";
      };
    };
  };
}
