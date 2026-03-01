# AIMC

A Python project managed with [uv](https://github.com/astral-sh/uv), developed inside a [NixOS flake](https://nixos.wiki/wiki/Flakes)-based reproducible development shell.

## Requirements

- [Nix](https://nixos.org/) with flakes enabled
- [direnv](https://direnv.net/) (optional, for automatic shell activation)

## Getting Started

### 1. Enter the dev shell

```bash
nix develop
```

Or, if you use direnv, allow it once:

```bash
direnv allow
```

### 2. Install project dependencies

```bash
uv sync
```

### 3. Run the project

```bash
uv run python -m aimc
```

### 4. Run tests

```bash
uv run pytest
```

## Project Structure

```
.
├── flake.nix          # Nix dev environment
├── flake.lock         # Locked Nix inputs
├── pyproject.toml     # Python project metadata & dependencies
├── uv.lock            # Locked Python dependencies
├── src/
│   └── aimc/          # Main package
│       ├── __init__.py
│       └── __main__.py
└── tests/             # Test suite
    └── test_placeholder.py
```

## Adding Dependencies

```bash
uv add <package>          # runtime dependency
uv add --dev <package>    # dev dependency
```
