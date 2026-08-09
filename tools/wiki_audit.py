"""Audit fcPicker's sensor counts against the ArduPilot wiki.

For every board that has a wiki page, this pulls the page's sensor text, tries
to read the IMU / baro / compass counts the wiki states, and compares them to
what fcPicker computes (same onboard-only, alternate-collapsed logic the site
uses). It writes a full evidence report so a human can scan every board, and
prints a summary of auto-comparable matches / mismatches.

The wiki states sensors in prose ("three IMUs", "dual barometer", "IIM-42652
x2"), so auto-extraction is deliberately conservative: a count is only claimed
when the wording is unambiguous. Everything else is left for human review with
the raw wiki lines shown — this is a guide + evidence, not an oracle.

Usage (needs a local wiki checkout):
    .venv/bin/python tools/wiki_audit.py --wiki ~/ardupilot_wiki
    .venv/bin/python tools/wiki_audit.py --wiki /tmp/fcpicker-wiki-master --out audit.txt
"""
from __future__ import annotations

import argparse
import glob
import json
import re
from pathlib import Path

NUM = {"single": 1, "one": 1, "two": 2, "dual": 2, "three": 3, "triple": 3, "four": 4}

# mirror of the site's count logic ------------------------------------------------
def is_onboard(s): return "EXTERNAL" not in (s.get("bus") or "").upper()
def slot_key(s):
    if s.get("slot"): return s["slot"]
    p = (s.get("bus") or "").split(":")
    return f"I2C:{p[1]}" if p[0] == "I2C" and len(p) >= 3 else (s.get("bus") or "?")
def positions(items): return len({slot_key(s) for s in items if is_onboard(s)})
def fc_counts(b): return (min(positions(b["imus"]), 3), positions(b["baros"]), positions(b["compasses"]))


# Words that mean the sensor is NOT onboard — a count near these is about a
# plug-in module or a spare port, so we must not read it as an onboard count.
AVOID = re.compile(r"external|i2c port|i2c pad|gps/compass|connect|plug", re.I)


def wiki_count(text: str, words: str) -> int | None:
    """Best-effort onboard count of a sensor kind from wiki prose. None if unsure."""
    kind = rf"(?:{words})"

    def ok(span: str) -> bool:
        return not AVOID.search(span)

    # "<number-word> <kind>" with the number adjacent (one optional adjective),
    # so "Two Barometers, One Magnetometer" doesn't read "Two ... Magnetometer".
    for m in re.finditer(rf"\b({'|'.join(NUM)})\b(?: \w+)? {kind}", text, re.I):
        if ok(m.group(0)):
            return NUM[m.group(1).lower()]
    # "<kind> ... x2" or "2x <kind>" or "<N> <kind>"
    for pat in (rf"{kind}[\w ,/-]{{0,15}}?\bx\s*([1-4])\b", rf"\b([1-4])\s*x?\s*{kind}"):
        m = re.search(pat, text, re.I)
        if m and ok(m.group(0)):
            return int(m.group(1))
    return None


def rst_for(url, wiki: Path):
    m = re.search(r"/([^/]+)/docs/([^/]+)\.html", url or "")
    if not m:
        return None
    for p in wiki.glob(f"*/source/docs/{m.group(2)}.rst"):
        return p
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--wiki", type=Path, default=Path.home() / "ardupilot_wiki")
    ap.add_argument("--out", type=Path, default=Path("wiki_audit_report.txt"))
    args = ap.parse_args()
    if not args.wiki.is_dir():
        print(f"error: wiki dir not found: {args.wiki}")
        return 2

    lines_out = []
    have_page = 0
    checks = {"imu": [0, 0], "baro": [0, 0], "compass": [0, 0]}  # [comparable, matched]
    mismatches = []

    for f in sorted(glob.glob("data/boards/*.json")):
        b = json.load(open(f))
        rst = rst_for(b.get("docs_url"), args.wiki)
        if not rst:
            continue
        have_page += 1
        imu, baro, comp = fc_counts(b)
        txt = rst.read_text(errors="ignore")
        w = {"imu": wiki_count(txt, "imu|imus"),
             "baro": wiki_count(txt, "baro|barometer|barometers"),
             "compass": wiki_count(txt, "compass|magnetometer")}
        fc = {"imu": imu, "baro": baro, "compass": comp}

        row = f"{b['slug']:30} fcPicker imu/baro/comp = {imu}/{baro}/{comp}"
        flags = []
        for k in ("imu", "baro", "compass"):
            if w[k] is not None:
                checks[k][0] += 1
                if w[k] == fc[k]:
                    checks[k][1] += 1
                else:
                    flags.append(f"{k}: wiki~{w[k]} vs fc {fc[k]}")
        if flags:
            mismatches.append(f"{b['slug']}: " + "; ".join(flags))
            row += "   <<< " + "; ".join(flags)
        lines_out.append(row)
        # sensor evidence lines from the wiki
        for l in txt.splitlines():
            if re.search(r"\b(IMU|baro|barometer|compass|magnetom|gyro|accel)\w*", l, re.I) \
               and 4 < len(l.strip()) < 130 and not l.strip().startswith((".", "=", "-", ":")):
                lines_out.append("      | " + l.strip())

    args.out.write_text("\n".join(lines_out) + "\n")

    print(f"Boards with a wiki page: {have_page}")
    for k in ("imu", "baro", "compass"):
        c, m = checks[k]
        rate = f"{m}/{c}" + (f" ({100*m//c}%)" if c else "")
        note = "  (least reliable — wiki mixes onboard + external mags)" if k == "compass" else ""
        print(f"  {k:8} auto-comparable: {rate} matched{note}")
    print(f"\nAuto-flagged possible mismatches: {len(mismatches)} "
          f"(wiki prose is fuzzy — most compass flags are the tool mis-reading; confirm by hand)")
    for m in mismatches[:40]:
        print(f"  ? {m}")
    print(f"\nFull per-board evidence written to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
