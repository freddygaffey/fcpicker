"""Bundle per-board JSON files into the single boards.json the frontend fetches.

Source:  data/boards/<slug>.json   (one file per board, hand-editable, committed)
Output:  frontend/public/boards.json

Run directly (`python tools/bundle.py`) or import `bundle()`. The pre-commit
hook runs this whenever data/boards/* changes are staged.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BOARDS_DIR = REPO_ROOT / "data" / "boards"
OUT_PATH = REPO_ROOT / "frontend" / "public" / "boards.json"


def bundle(boards_dir: Path = BOARDS_DIR, out_path: Path = OUT_PATH) -> int:
    files = sorted(boards_dir.glob("*.json"))
    payload = [json.loads(f.read_text()) for f in files]
    payload.sort(key=lambda b: b["slug"].lower())
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"boards": payload}, indent=2) + "\n")
    return len(payload)


def main() -> int:
    if not BOARDS_DIR.exists():
        print(f"No board dir at {BOARDS_DIR}", file=sys.stderr)
        return 1
    n = bundle()
    print(f"Bundled {n} boards → {OUT_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
