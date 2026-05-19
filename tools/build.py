"""Build script for fcPicker.

Walks the local ArduPilot firmware repo (~/ardupilot), parses each board's
hwdef files for structured specs (MCU, flash, IMUs, baros, compasses),
loads them into a SQLite database, then exports a single boards.json
for the static frontend to consume.

Schema is firmware-agnostic so PX4/INAV/Betaflight can be layered in later.

Usage:
    python tools/build.py
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, create_engine, select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, Session


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
FRONTEND_PUBLIC = ROOT / "frontend" / "public"
ARDUPILOT_HWDEF = Path.home() / "ardupilot" / "libraries" / "AP_HAL_ChibiOS" / "hwdef"
BEC_OVERRIDES = ROOT / "data" / "bec_overrides.json"
SITE_BASE_URL = "https://fcpicker.pebnum.com"
ARDUPILOT_WIKI_ROOT = Path.home() / "ardupilot_wiki"
ARDUPILOT_WIKI_DOCS = ARDUPILOT_WIKI_ROOT / "common" / "source" / "docs"
DOCS_BASE = "https://ardupilot.org"
# Platform dirs (besides common/) whose docs/ contain board landing pages.
# Common docs render under /copter/docs/ for historical reasons.
WIKI_PLATFORMS = ("copter", "plane", "rover", "sub", "blimp", "antennatracker", "dev")
COMMON_PLATFORM = "copter"

# Directory names that are peripherals / nodes / bootloaders, not autopilots.
PERIPHERAL_PATTERNS = (
    "GPS", "GNSS", "CANNODE", "PMU", "ESC", "Periph", "periph",
    "Airspeed", "Compass-", "RTK", "ADSB", "TBS-",
)


class Base(DeclarativeBase):
    pass


class Board(Base):
    __tablename__ = "boards"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    manufacturer: Mapped[str | None] = mapped_column(String, nullable=True)
    mcu_family: Mapped[str | None] = mapped_column(String, nullable=True)
    mcu_part: Mapped[str | None] = mapped_column(String, nullable=True)
    flash_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Bus IDs stored as comma-separated names (e.g. "SPI1,SPI2,SPI6")
    uart_buses_csv: Mapped[str] = mapped_column(String, default="")
    i2c_buses_csv: Mapped[str] = mapped_column(String, default="")
    spi_buses_csv: Mapped[str] = mapped_column(String, default="")
    can_buses_csv: Mapped[str] = mapped_column(String, default="")
    canfd: Mapped[bool] = mapped_column(Integer, default=0)
    pwm_fmu: Mapped[int] = mapped_column(Integer, default=0)
    pwm_io: Mapped[int] = mapped_column(Integer, default=0)
    usb_count: Mapped[int] = mapped_column(Integer, default=0)
    ethernet: Mapped[bool] = mapped_column(Integer, default=0)
    sdcard: Mapped[bool] = mapped_column(Integer, default=0)
    sbus_out: Mapped[bool] = mapped_column(Integer, default=0)
    iomcu: Mapped[bool] = mapped_column(Integer, default=0)
    adc_inputs: Mapped[int] = mapped_column(Integer, default=0)
    power_inputs: Mapped[int] = mapped_column(Integer, default=0)
    vehicles_csv: Mapped[str] = mapped_column(String, default="")
    docs_url: Mapped[str | None] = mapped_column(String, nullable=True)
    readme: Mapped[str | None] = mapped_column(String, nullable=True)

    sensors: Mapped[list["Sensor"]] = relationship(back_populates="board", cascade="all, delete-orphan")
    firmware_support: Mapped[list["FirmwareSupport"]] = relationship(back_populates="board", cascade="all, delete-orphan")
    bec_rails: Mapped[list["BecRail"]] = relationship(back_populates="board", cascade="all, delete-orphan")


class Sensor(Base):
    __tablename__ = "sensors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    kind: Mapped[str] = mapped_column(String)   # "imu" | "baro" | "compass"
    chip: Mapped[str] = mapped_column(String)
    bus: Mapped[str | None] = mapped_column(String, nullable=True)
    # BOARD_MATCH(...) token if the sensor line is gated to a hardware variant,
    # else NULL. Multiple sensors sharing the same variant token belong to the
    # same physical board revision.
    variant: Mapped[str | None] = mapped_column(String, nullable=True)

    board: Mapped[Board] = relationship(back_populates="sensors")


class FirmwareSupport(Base):
    __tablename__ = "firmware_support"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    firmware: Mapped[str] = mapped_column(String)   # ardupilot | px4 | inav | betaflight
    maturity: Mapped[str] = mapped_column(String)   # official | community | experimental

    board: Mapped[Board] = relationship(back_populates="firmware_support")


class BecRail(Base):
    """Hand-curated BEC output rail. Loaded from data/bec_overrides.json,
    keyed by board slug. Not derivable from hwdef."""
    __tablename__ = "bec_rails"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    rail: Mapped[str] = mapped_column(String)         # "Servo", "Peripheral", "VTX", ...
    voltage_v: Mapped[float] = mapped_column(Float)
    current_a: Mapped[float] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(String, nullable=True)

    board: Mapped[Board] = relationship(back_populates="bec_rails")


@dataclass
class ParsedBoard:
    slug: str
    mcu_family: str | None = None
    mcu_part: str | None = None
    flash_kb: int | None = None
    # (chip, bus, variant_or_None)
    imus: list[tuple[str, str, str | None]] = None
    baros: list[tuple[str, str, str | None]] = None
    compasses: list[tuple[str, str, str | None]] = None
    uart_buses: list[str] = None
    i2c_buses: list[str] = None
    spi_buses: list[str] = None
    can_buses: list[str] = None
    canfd: bool = False
    pwm_fmu: int = 0
    pwm_io: int = 0
    usb_count: int = 0
    ethernet: bool = False
    sdcard: bool = False
    sbus_out: bool = False
    iomcu: bool = False
    adc_inputs: int = 0
    power_inputs: int = 0
    vehicles: list[str] = None
    docs_url: str | None = None
    readme: str | None = None


MCU_RE = re.compile(r"^\s*MCU\s+(\S+)\s+(\S+)", re.MULTILINE)
FLASH_RE = re.compile(r"^\s*FLASH_SIZE_KB\s+(\d+)", re.MULTILINE)
# Sensor lines capture chip + bus + the rest of the line (for BOARD_MATCH extraction).
IMU_RE = re.compile(r"^\s*IMU\s+(\S+)\s+(\S+)(.*)$", re.MULTILINE)
BARO_RE = re.compile(r"^\s*BARO\s+(\S+)\s+(\S+)(.*)$", re.MULTILINE)
COMPASS_RE = re.compile(r"^\s*COMPASS\s+(\S+)\s+(\S+)(.*)$", re.MULTILINE)
BOARD_MATCH_RE = re.compile(r"\bBOARD_MATCH\(([^)]+)\)")
SERIAL_ORDER_RE = re.compile(r"^\s*SERIAL_ORDER\s+(.+)$", re.MULTILINE)
I2C_ORDER_RE = re.compile(r"^\s*I2C_ORDER\s+(.+)$", re.MULTILINE)
SPIDEV_RE = re.compile(r"^\s*SPIDEV\s+\S+\s+(SPI\d+)", re.MULTILINE)
CAN_PIN_RE = re.compile(r"\bCAN(\d+)_(?:TX|RX)\b")
CANFD_RE = re.compile(r"^\s*CANFD_SUPPORTED\b", re.MULTILINE)
PWM_RE = re.compile(r"\bPWM\(\d+\)")
AUTOBUILD_RE = re.compile(r"^\s*AUTOBUILD_TARGETS\s+(.+)$", re.MULTILINE)
PHY_RE = re.compile(r"^\s*define\s+BOARD_PHY_ID\b", re.MULTILINE)
SDMMC_RE = re.compile(r"\bSDMMC\d?_(?:CK|CMD)\b")
FATFS_RE = re.compile(r"^\s*define\s+HAL_OS_FATFS_IO\s+1\b", re.MULTILINE)
IOMCU_RE = re.compile(r"^\s*IOMCU_UART\b|^\s*define\s+HAL_WITH_IO_MCU\w*\s+1\b", re.MULTILINE)
# nVALID brick pins. Boards typically declare one per power input as
# VDD_BRICK_nVALID, VDD_BRICK2_nVALID, VDD_BRICK3_nVALID, etc.
BRICK_RE = re.compile(r"\bVDD_BRICK\d*_n?VALID\b")
SBUS_OUT_RE = re.compile(
    r"^\s*define\s+HAL_GPIO_PIN_SBUS_OUT\b|^\s*PINIO_PIN\s+\S+\s+SBUS_OUT\b|\bSBUS_OUT\b",
    re.MULTILINE,
)
# ADC channel pin definitions — count distinct ADC pins by their PIN token,
# across ADC1/ADC2/ADC3.
ADC_PIN_RE = re.compile(r"^\s*(P[A-K]\d{1,2})\s+\S+\s+ADC[123]\b", re.MULTILINE)

ALL_VEHICLES = ["copter", "plane", "rover", "sub", "tracker", "blimp"]


def read_hwdef_text(board_dir: Path) -> str:
    """Concatenate hwdef.dat + hwdef.inc since fields are split between them."""
    parts = []
    for fname in ("hwdef.dat", "hwdef.inc"):
        p = board_dir / fname
        if p.exists():
            try:
                parts.append(p.read_text(errors="ignore"))
            except OSError:
                pass
    return "\n".join(parts)


def is_autopilot(slug: str) -> bool:
    if any(pat in slug for pat in PERIPHERAL_PATTERNS):
        return False
    if slug.startswith("bootloader") or slug.endswith("-bl"):
        return False
    return True


def parse_board(board_dir: Path) -> ParsedBoard | None:
    slug = board_dir.name
    if not is_autopilot(slug):
        return None
    text = read_hwdef_text(board_dir)
    if not text:
        return None

    mcu_m = MCU_RE.search(text)
    flash_m = FLASH_RE.search(text)

    def _sensors(rx):
        out = []
        for m in rx.finditer(text):
            tail = m.group(3) or ""
            bm = BOARD_MATCH_RE.search(tail)
            variant = bm.group(1).strip() if bm else None
            out.append((m.group(1), m.group(2), variant))
        return out

    imus = _sensors(IMU_RE)
    baros = _sensors(BARO_RE)
    compasses = _sensors(COMPASS_RE)

    if not imus:
        return None

    # SERIAL_ORDER lists every serial port; OTG entries are USB.
    uart_buses: list[str] = []
    usb_count = 0
    sm = SERIAL_ORDER_RE.search(text)
    if sm:
        for t in sm.group(1).split():
            if t == "EMPTY":
                continue
            if t.startswith("OTG"):
                usb_count += 1
            else:
                uart_buses.append(t)

    i2c_buses: list[str] = []
    im = I2C_ORDER_RE.search(text)
    if im:
        i2c_buses = [t for t in im.group(1).split() if t.startswith("I2C")]

    spi_buses = sorted({m.group(1) for m in SPIDEV_RE.finditer(text)})
    can_buses = sorted({f"CAN{m.group(1)}" for m in CAN_PIN_RE.finditer(text)})
    canfd = bool(CANFD_RE.search(text))

    # PWM split: total PWM channels declared, plus 8 extra from IOMCU when present.
    pwm_total = len(PWM_RE.findall(text))
    iomcu = bool(IOMCU_RE.search(text))
    pwm_io = 8 if iomcu else 0
    pwm_fmu = pwm_total

    ethernet = bool(PHY_RE.search(text))
    sdcard = bool(FATFS_RE.search(text)) or bool(SDMMC_RE.search(text))
    sbus_out = bool(SBUS_OUT_RE.search(text))
    adc_inputs = len(set(ADC_PIN_RE.findall(text)))
    # Distinct brick indices: VDD_BRICK_nVALID, VDD_BRICK2_nVALID → 2 inputs.
    power_inputs = len({m for m in BRICK_RE.findall(text)})

    # Vehicle support — defaults to all six unless hwdef overrides via AUTOBUILD_TARGETS.
    am = AUTOBUILD_RE.search(text)
    if am:
        raw = am.group(1).strip().lower()
        vehicles = [] if raw == "none" else [v.strip() for v in raw.split(",") if v.strip()]
    else:
        vehicles = list(ALL_VEHICLES)

    readme_path = board_dir / "README.md"
    readme = readme_path.read_text(errors="ignore") if readme_path.exists() else None

    return ParsedBoard(
        slug=slug,
        mcu_family=mcu_m.group(1) if mcu_m else None,
        mcu_part=mcu_m.group(2) if mcu_m else None,
        flash_kb=int(flash_m.group(1)) if flash_m else None,
        imus=imus,
        baros=baros,
        compasses=compasses,
        uart_buses=uart_buses,
        i2c_buses=i2c_buses,
        spi_buses=spi_buses,
        can_buses=can_buses,
        canfd=canfd,
        pwm_fmu=pwm_fmu,
        pwm_io=pwm_io,
        usb_count=usb_count,
        ethernet=ethernet,
        sdcard=sdcard,
        sbus_out=sbus_out,
        iomcu=iomcu,
        adc_inputs=adc_inputs,
        power_inputs=power_inputs,
        vehicles=vehicles,
        readme=readme,
    )


def _norm(s: str) -> str:
    """Lowercase alphanumeric-only normalization for fuzzy slug matching."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


_TOKEN_SPLIT = re.compile(r"[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z0-9]+|[A-Z]+|\d+")
# Generic words that match too many boards; ignore them when scoring.
_STOP_TOKENS = {"the", "common", "overview", "fc", "v", "ardupilot", "autopilot", "flight"}


def _tokens(s: str) -> list[str]:
    return [t.lower() for t in _TOKEN_SPLIT.findall(s) if t.lower() not in _STOP_TOKENS]


def build_docs_map() -> dict[str, tuple[str, list[str], str]]:
    """Build canonical-key → (doc-name, tokens, platform) map from the local wiki.

    Sources:
      - common/source/docs/common-*.rst (rendered under /copter/docs/)
      - <platform>/source/docs/*.rst for each platform in WIKI_PLATFORMS
        (rendered under /<platform>/docs/)
      - common-* references inside common-autopilots.rst

    Map key is the normalized stem with leading `common-` and trailing
    `-overview` / `-autopilot` removed.
    """
    # (doc_stem, platform) entries.
    entries: set[tuple[str, str]] = set()

    if ARDUPILOT_WIKI_DOCS.exists():
        for p in ARDUPILOT_WIKI_DOCS.glob("common-*.rst"):
            entries.add((p.stem, COMMON_PLATFORM))
        ap_page = ARDUPILOT_WIKI_DOCS / "common-autopilots.rst"
        if ap_page.exists():
            for m in re.finditer(r"common-[A-Za-z0-9._-]+", ap_page.read_text(errors="ignore")):
                name = m.group(0)
                if name.endswith(".rst"):
                    name = name[:-4]
                entries.add((name, COMMON_PLATFORM))
        entries.discard(("common-autopilots", COMMON_PLATFORM))

    for platform in WIKI_PLATFORMS:
        pdir = ARDUPILOT_WIKI_ROOT / platform / "source" / "docs"
        if not pdir.exists():
            continue
        for p in pdir.glob("*.rst"):
            # Only pages that look like board landing pages, to avoid linking
            # generic guides. Heuristic: ends with `-autopilot` or `-overview`.
            stem = p.stem
            if stem.endswith("-autopilot") or stem.endswith("-overview"):
                entries.add((stem, platform))

    out: dict[str, tuple[str, list[str], str]] = {}
    for doc, platform in entries:
        core = doc[len("common-"):] if doc.startswith("common-") else doc
        for suffix in ("-overview", "-autopilot"):
            if core.endswith(suffix):
                core = core[: -len(suffix)]
                break
        key = _norm(core)
        if key and key not in out:
            out[key] = (doc, _tokens(core), platform)
    return out


def _doc_url(doc: str, platform: str) -> str:
    return f"{DOCS_BASE}/{platform}/docs/{doc}.html"


def match_docs_url(slug: str, docs_map: dict[str, tuple[str, list[str], str]]) -> str | None:
    """Match a board slug to a wiki doc using progressively looser strategies.

    1. Exact normalized-string match.
    2. "the" + slug (ArduPilot prefixes Cube boards).
    3. Substring containment of normalized strings, with min length 6 to
       guard against accidental hits on short tokens.
    4. Meaningful-token overlap: every alphabetic token of length >= 3 in the
       slug must appear (exact or substring) in some wiki token of length
       >= 3, AND at least 2 such tokens must agree.
    """
    if not docs_map:
        return None
    key = _norm(slug)
    if key in docs_map:
        doc, _t, platform = docs_map[key]
        return _doc_url(doc, platform)
    if ("the" + key) in docs_map:
        doc, _t, platform = docs_map["the" + key]
        return _doc_url(doc, platform)

    # Substring containment on normalized strings. Best = longest overlap.
    if len(key) >= 6:
        best_sub: tuple[int, str, str] | None = None
        for wkey, (doc, _wtoks, platform) in docs_map.items():
            if len(wkey) < 6:
                continue
            if key in wkey:
                overlap = len(key)
            elif wkey in key:
                overlap = len(wkey)
            else:
                continue
            if best_sub is None or overlap > best_sub[0]:
                best_sub = (overlap, doc, platform)
        if best_sub:
            return _doc_url(best_sub[1], best_sub[2])

    # Token overlap, last resort. Score using ALL slug tokens (exact-match
    # works for short tokens like "3"/"dr"/"g"; substring only for ≥3-char
    # tokens). Tie-break by preferring the most-specific wiki page (fewest
    # unmatched extra tokens).
    slug_toks = _tokens(slug)
    if len(slug_toks) < 2:
        return None
    threshold = max(2, int(round(len(slug_toks) * 0.75)))

    best: tuple[int, float, str, str] | None = None
    for _wkey, (doc, wtoks, platform) in docs_map.items():
        if len(wtoks) < 1:
            continue
        hits = 0
        for st in slug_toks:
            for wt in wtoks:
                if st == wt:
                    hits += 1
                    break
                if len(st) >= 3 and len(wt) >= 3 and (st in wt or wt in st):
                    hits += 1
                    break
        if hits < threshold:
            continue
        wiki_specificity = hits / len(wtoks)  # higher = wiki is more focused on these tokens
        ranking = (hits, wiki_specificity, doc, platform)
        if best is None or ranking > best:
            best = ranking
    if best:
        return _doc_url(best[2], best[3])
    return None


def load_bec_overrides() -> dict[str, list[dict]]:
    """Load hand-curated BEC rails per slug. Keys starting with `_` are
    metadata (e.g. _README) and ignored."""
    if not BEC_OVERRIDES.exists():
        return {}
    raw = json.loads(BEC_OVERRIDES.read_text())
    return {k: v for k, v in raw.items() if not k.startswith("_") and isinstance(v, list)}


def populate_db(session: Session, parsed: list[ParsedBoard], docs_map: dict[str, tuple[str, list[str], str]]) -> None:
    bec_map = load_bec_overrides()
    for p in parsed:
        p.docs_url = match_docs_url(p.slug, docs_map)
        b = Board(
            slug=p.slug,
            name=p.slug,                 # TODO: pretty-name from wiki / README
            manufacturer=None,           # TODO: infer from slug / wiki
            mcu_family=p.mcu_family,
            mcu_part=p.mcu_part,
            flash_kb=p.flash_kb,
            uart_buses_csv=",".join(p.uart_buses or []),
            i2c_buses_csv=",".join(p.i2c_buses or []),
            spi_buses_csv=",".join(p.spi_buses or []),
            can_buses_csv=",".join(p.can_buses or []),
            canfd=p.canfd,
            pwm_fmu=p.pwm_fmu,
            pwm_io=p.pwm_io,
            usb_count=p.usb_count,
            ethernet=p.ethernet,
            sdcard=p.sdcard,
            sbus_out=p.sbus_out,
            iomcu=p.iomcu,
            adc_inputs=p.adc_inputs,
            power_inputs=p.power_inputs,
            vehicles_csv=",".join(p.vehicles or []),
            docs_url=p.docs_url,
            readme=p.readme,
        )
        for chip, bus, variant in p.imus:
            b.sensors.append(Sensor(kind="imu", chip=chip, bus=bus, variant=variant))
        for chip, bus, variant in p.baros:
            b.sensors.append(Sensor(kind="baro", chip=chip, bus=bus, variant=variant))
        for chip, bus, variant in p.compasses:
            b.sensors.append(Sensor(kind="compass", chip=chip, bus=bus, variant=variant))
        b.firmware_support.append(FirmwareSupport(firmware="ardupilot", maturity="official"))
        for entry in bec_map.get(p.slug, []):
            b.bec_rails.append(BecRail(
                rail=str(entry["rail"]),
                voltage_v=float(entry["voltage_v"]),
                current_a=float(entry["current_a"]),
                note=entry.get("note"),
            ))
        session.add(b)
    session.commit()


def export_sitemap(session: Session, out_path: Path) -> None:
    """Write sitemap.xml listing the selector page + every board detail route."""
    from datetime import date
    from xml.sax.saxutils import escape as xml_escape

    today = date.today().isoformat()
    boards = session.scalars(select(Board)).all()
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        f"  <url><loc>{SITE_BASE_URL}/</loc><lastmod>{today}</lastmod>"
        f"<changefreq>weekly</changefreq><priority>1.0</priority></url>",
    ]
    for b in sorted(boards, key=lambda x: x.slug.lower()):
        # Slugs are ASCII alnum + dashes/underscores; xml_escape is belt-and-suspenders.
        loc = f"{SITE_BASE_URL}/board/{xml_escape(b.slug)}"
        lines.append(
            f"  <url><loc>{loc}</loc><lastmod>{today}</lastmod>"
            f"<changefreq>monthly</changefreq><priority>0.7</priority></url>"
        )
    lines.append("</urlset>\n")
    out_path.write_text("\n".join(lines))


def export_robots(out_path: Path) -> None:
    out_path.write_text(
        "User-agent: *\n"
        "Allow: /\n"
        f"Sitemap: {SITE_BASE_URL}/sitemap.xml\n"
    )


def export_json(session: Session, out_path: Path) -> None:
    boards = session.scalars(select(Board)).all()
    payload = []
    for b in boards:
        uart_buses = [x for x in b.uart_buses_csv.split(",") if x]
        i2c_buses = [x for x in b.i2c_buses_csv.split(",") if x]
        spi_buses = [x for x in b.spi_buses_csv.split(",") if x]
        can_buses = [x for x in b.can_buses_csv.split(",") if x]
        payload.append({
            "slug": b.slug,
            "name": b.name,
            "manufacturer": b.manufacturer,
            "mcu": {"family": b.mcu_family, "part": b.mcu_part},
            "flash_kb": b.flash_kb,
            "io": {
                "uart_count": len(uart_buses),
                "uart_buses": uart_buses,
                "i2c_count": len(i2c_buses),
                "i2c_buses": i2c_buses,
                "spi_count": len(spi_buses),
                "spi_buses": spi_buses,
                "can_count": len(can_buses),
                "can_buses": can_buses,
                "canfd": bool(b.canfd),
                "usb_count": b.usb_count,
                "pwm": {
                    "fmu": b.pwm_fmu,
                    "io": b.pwm_io,
                    "total": b.pwm_fmu + b.pwm_io,
                },
                "ethernet": bool(b.ethernet),
                "sdcard": bool(b.sdcard),
                "sbus_out": bool(b.sbus_out),
                "iomcu": bool(b.iomcu),
                "adc_inputs": b.adc_inputs,
            },
            "power": {
                "monitor_inputs": b.power_inputs,
                "bec": [
                    {
                        "rail": r.rail,
                        "voltage_v": r.voltage_v,
                        "current_a": r.current_a,
                        "note": r.note,
                    }
                    for r in b.bec_rails
                ],
            },
            "imus":     [{"chip": s.chip, "bus": s.bus, "variant": s.variant} for s in b.sensors if s.kind == "imu"],
            "baros":    [{"chip": s.chip, "bus": s.bus, "variant": s.variant} for s in b.sensors if s.kind == "baro"],
            "compasses":[{"chip": s.chip, "bus": s.bus, "variant": s.variant} for s in b.sensors if s.kind == "compass"],
            "firmware_support": [
                {"firmware": f.firmware, "maturity": f.maturity}
                for f in b.firmware_support
            ],
            "vehicles": [v for v in b.vehicles_csv.split(",") if v],
            "docs_url": b.docs_url,
        })
    payload.sort(key=lambda x: x["slug"].lower())
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"boards": payload}, indent=2))


def main() -> int:
    if not ARDUPILOT_HWDEF.exists():
        print(f"ArduPilot hwdef dir not found at {ARDUPILOT_HWDEF}", file=sys.stderr)
        return 1

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db_path = DATA_DIR / "fcpicker.sqlite"
    if db_path.exists():
        db_path.unlink()
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)

    parsed: list[ParsedBoard] = []
    for board_dir in sorted(ARDUPILOT_HWDEF.iterdir()):
        if not board_dir.is_dir():
            continue
        p = parse_board(board_dir)
        if p:
            parsed.append(p)

    docs_map = build_docs_map()

    with Session(engine) as session:
        populate_db(session, parsed, docs_map)
        export_json(session, FRONTEND_PUBLIC / "boards.json")
        export_sitemap(session, FRONTEND_PUBLIC / "sitemap.xml")
        export_robots(FRONTEND_PUBLIC / "robots.txt")

    matched = sum(1 for p in parsed if p.docs_url)
    print(f"Parsed {len(parsed)} autopilot boards "
          f"({matched} matched to wiki docs, {len(parsed) - matched} unmatched).")
    print(f"  SQLite: {db_path}")
    print(f"  JSON:   {FRONTEND_PUBLIC / 'boards.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
