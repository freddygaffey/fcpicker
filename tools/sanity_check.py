"""Sanity-check the sensor counts fcPicker will display.

This mirrors the count logic in frontend/src/data.ts (onboard-only, external
probes dropped, probe-alternates on a shared SPI slot / I2C bus channel
collapsed, IMUs capped at the physical maximum of 3) and asserts that no board
shows a physically impossible value. It is the guardrail against publishing a
nonsense number like "15 barometers".

Run before deploying:
    .venv/bin/python tools/sanity_check.py

Exits non-zero if any HARD bound is violated, so it can gate a commit/deploy.
HARD bounds fail the run; SOFT anomalies are printed for review but don't fail.
"""
from __future__ import annotations

import glob
import json
import sys

# Physical ceilings. A value above these is not "uncertain" — it's wrong.
MAX_IMU = 3       # ArduPilot's INS instance limit; no board has more.
MAX_BARO = 3      # observed real max is 2; 3 leaves margin, >3 is a bug.
MAX_COMPASS = 3   # onboard mags; externals are excluded from the count.


def is_onboard(s: dict) -> bool:
    return "EXTERNAL" not in (s.get("bus") or "").upper()


def slot_key(s: dict) -> str:
    """Physical position key — SPI chip-select slot, or I2C bus channel."""
    if s.get("slot"):
        return s["slot"]
    parts = (s.get("bus") or "").split(":")
    if parts[0] == "I2C" and len(parts) >= 3:
        return f"I2C:{parts[1]}"
    return s.get("bus") or "?"


def positions(items: list[dict]) -> int:
    return len({slot_key(s) for s in items if is_onboard(s)})


def counts(board: dict) -> tuple[int, int, int]:
    imu = min(positions(board["imus"]), MAX_IMU)   # capped, as displayed
    return imu, positions(board["baros"]), positions(board["compasses"])


def main() -> int:
    files = sorted(glob.glob("data/boards/*.json"))
    if not files:
        print("error: no data/boards/*.json found (run from repo root)", file=sys.stderr)
        return 2

    hard: list[str] = []
    soft: list[str] = []
    dist = {"imu": {}, "baro": {}, "compass": {}}

    for f in files:
        b = json.load(open(f))
        slug = b["slug"]
        imu, baro, comp = counts(b)
        for k, v in (("imu", imu), ("baro", baro), ("compass", comp)):
            dist[k][v] = dist[k].get(v, 0) + 1

        # HARD: physically impossible → fails the run.
        if not (1 <= imu <= MAX_IMU):
            hard.append(f"{slug}: IMU={imu} (must be 1..{MAX_IMU})")
        if not (0 <= baro <= MAX_BARO):
            hard.append(f"{slug}: Baro={baro} (must be 0..{MAX_BARO})")
        if not (0 <= comp <= MAX_COMPASS):
            hard.append(f"{slug}: Compass={comp} (must be 0..{MAX_COMPASS})")
        if b["platform"] == "chibios" and not (b.get("mcu") or {}).get("family"):
            hard.append(f"{slug}: chibios board with no MCU family")

        # SOFT: plausible but worth an eyeball (not a failure).
        if imu >= 3 and baro == 0:
            soft.append(f"{slug}: {imu} IMU but 0 baro — verify against wiki")

    print(f"Checked {len(files)} boards.\n")
    for k in ("imu", "baro", "compass"):
        print(f"  {k:8} count distribution: {dict(sorted(dist[k].items()))}")

    if soft:
        print(f"\nSOFT — {len(soft)} board(s) to eyeball (not failures):")
        for s in soft:
            print(f"  · {s}")

    if hard:
        print(f"\nHARD FAIL — {len(hard)} physically-impossible value(s):", file=sys.stderr)
        for h in hard:
            print(f"  ✗ {h}", file=sys.stderr)
        return 1

    print("\n✓ All counts within physical bounds. No impossible values.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
