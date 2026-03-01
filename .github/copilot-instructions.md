# Copilot Instructions

This is a **Python project managed with [uv](https://github.com/astral-sh/uv)**, developed inside a **NixOS flake**-based development shell.

## Stack

- **Nix flake** – reproducible dev environment (`flake.nix`)
- **uv** – fast Python package & project manager
- **Python 3** – sourced from nixpkgs via the flake
- **direnv** – automatic shell activation via `.envrc`

## Development Workflow

1. Enter the dev shell: `nix develop` (or automatically via direnv)
2. Install dependencies: `uv sync`
3. Run the project: `uv run python -m aimc` (adjust module name as needed)

## Conventions

- Source code lives under `src/aimc/`
- Tests live under `tests/`
- Prefer `uv add <package>` over editing `pyproject.toml` manually
- Keep `flake.lock` and `uv.lock` committed
