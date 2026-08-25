"""Shared pytest fixtures for the gate tests."""

import sys
from pathlib import Path

# Make the pipeline package importable when running pytest from the repo root
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
