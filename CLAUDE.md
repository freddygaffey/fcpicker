# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

fcPicker is a **fully static** site backed by an offline build pipeline. There is no server at runtime — Cloudflare Pages just serves the Vite build of `frontend/`.

Data flow:

```
~/ardupilot/.../hwdef/*    tools/build.py     data/boards/<slug>.json    tools/bundle.py    frontend/public/boards.json
  (hwdef.dat / .inc)    ─▶ (Python/SQLAlchemy) ─▶ (one per board,      ─▶ (concat)       ─▶ (committed; fetched by React)
                                                  hand-editable,
                                                  committed)
                                  │
                                  └─▶ data/fcpicker.sqlite (intermediate)
```

Key consequences:

- **`data/boards/<slug>.json` is the source of truth.** Each file has hwdef-derived keys plus a `manual` block (`form_factor`, `size_class`, `dimensions_mm`, `weight_g`, `connectors`, `notes`) that humans / the admin UI own. `tools/build.py` only overwrites its own keys; `manual` is preserved across re-runs.
- **`frontend/public/boards.json` is bundled from those files** by `tools/bundle.py`. Committed because Cloudflare's build env does not run Python. The pre-commit hook re-bundles whenever any `data/boards/*.json` is staged.
- The build script is now mostly a **one-shot importer** — run it when ArduPilot adds a new hwdef board, and a new `data/boards/<slug>.json` appears. Existing files keep their `manual` block.
- The schema in `tools/build.py` is intentionally firmware-agnostic (Board / Sensor / FirmwareSupport with a `firmware` discriminator) so PX4 / INAV / Betaflight can be layered in later.
- The pipeline also reads `~/ardupilot_wiki` (cloned separately) to match boards to documentation URLs. Missing wiki dir is fine — boards just won't get `docs_url`.

### `tools/build.py` internals

- `parse_board()` reads `hwdef.dat` + `hwdef.inc` concatenated (fields are split across them) and returns `None` for non-autopilots (peripherals, bootloaders — see `PERIPHERAL_PATTERNS` and `is_autopilot()`). Boards without any IMU line are also dropped.
- Sensor lines (IMU/BARO/COMPASS) can be gated to a hardware revision via `BOARD_MATCH(...)`. The matched token is stored on `Sensor.variant` so the frontend can group sensors by physical board variant.
- Feature detection is regex-based against the concatenated hwdef text. Each peripheral has its own regex constant at module top (`SERIAL_ORDER_RE`, `SPIDEV_RE`, `CAN_PIN_RE`, `IOMCU_RE`, `BRICK_RE`, etc.) — extend those when adding a new peripheral field rather than parsing inside `parse_board`.
- `build_docs_map()` + `match_docs_url()` implement progressively looser slug-to-wiki-page matching (exact → "the"-prefix → substring → token overlap). The four strategies are intentional; tighten thresholds before adding a fifth.

### Frontend

- React 19 + Vite + TypeScript, react-router-dom v7. Routes live in `frontend/src/routes/` (`Layout`, `Selector`, `BoardDetail`).
- The app fetches `/boards.json` on mount; types for the payload are in `frontend/src/types.ts`. Keep these in sync with `export_json()` in `tools/build.py` — they are the contract between the two halves.

## Commands

Run from repo root unless noted.

```bash
# Re-import from hwdef (writes data/fcpicker.sqlite, updates data/boards/*.json,
# preserves manual blocks, re-bundles frontend/public/boards.json)
.venv/bin/python tools/build.py

# Re-bundle per-board JSON files into frontend/public/boards.json
# (run by the pre-commit hook automatically when data/boards/*.json is staged)
.venv/bin/python tools/bundle.py

# Frontend dev / lint / build (root package.json proxies to frontend/)
npm run dev
npm run lint
npm run build

# Cloudflare Pages deploy (uses wrangler.jsonc)
npm run deploy
```

There is no test suite. A pre-commit hook in `.githooks/pre-commit` runs `npm run lint` + `npm run build` when any `frontend/` file is staged; it's wired up via `npm run prepare` (`git config core.hooksPath .githooks`).

## Conventions

- Prereq for the build script: a clone of ArduPilot at `~/ardupilot` (only the `libraries/AP_HAL_ChibiOS/hwdef/` tree is needed) and optionally `~/ardupilot_wiki` for docs links.
- `data/fcpicker.sqlite` is gitignored and recreated from scratch on every build (`db_path.unlink()` at the top of `main()`).
