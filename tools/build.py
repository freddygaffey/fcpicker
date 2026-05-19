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
    Column, Integer, String, ForeignKey, create_engine, select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, Session


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
FRONTEND_PUBLIC = ROOT / "frontend" / "public"
ARDUPILOT_HWDEF = Path.home() / "ardupilot" / "libraries" / "AP_HAL_ChibiOS" / "hwdef"
ARDUPILOT_WIKI_DOCS = Path.home() / "ardupilot_wiki" / "common" / "source" / "docs"
DOCS_BASE_URL = "https://ardupilot.org/copter/docs"

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
    uart_count: Mapped[int] = mapped_column(Integer, default=0)
    i2c_count: Mapped[int] = mapped_column(Integer, default=0)
    spi_count: Mapped[int] = mapped_column(Integer, default=0)
    can_count: Mapped[int] = mapped_column(Integer, default=0)
    canfd: Mapped[bool] = mapped_column(Integer, default=0)
    pwm_count: Mapped[int] = mapped_column(Integer, default=0)
    vehicles_csv: Mapped[str] = mapped_column(String, default="")
    docs_url: Mapped[str | None] = mapped_column(String, nullable=True)
    readme: Mapped[str | None] = mapped_column(String, nullable=True)

    sensors: Mapped[list["Sensor"]] = relationship(back_populates="board", cascade="all, delete-orphan")
    firmware_support: Mapped[list["FirmwareSupport"]] = relationship(back_populates="board", cascade="all, delete-orphan")


class Sensor(Base):
    __tablename__ = "sensors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    kind: Mapped[str] = mapped_column(String)   # "imu" | "baro" | "compass"
    chip: Mapped[str] = mapped_column(String)
    bus: Mapped[str | None] = mapped_column(String, nullable=True)

    board: Mapped[Board] = relationship(back_populates="sensors")


class FirmwareSupport(Base):
    __tablename__ = "firmware_support"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    firmware: Mapped[str] = mapped_column(String)   # ardupilot | px4 | inav | betaflight
    maturity: Mapped[str] = mapped_column(String)   # official | community | experimental

    board: Mapped[Board] = relationship(back_populates="firmware_support")


@dataclass
class ParsedBoard:
    slug: str
    mcu_family: str | None = None
    mcu_part: str | None = None
    flash_kb: int | None = None
    imus: list[tuple[str, str]] = None
    baros: list[tuple[str, str]] = None
    compasses: list[tuple[str, str]] = None
    uart_count: int = 0
    i2c_count: int = 0
    spi_count: int = 0
    can_count: int = 0
    canfd: bool = False
    pwm_count: int = 0
    vehicles: list[str] = None
    docs_url: str | None = None
    readme: str | None = None


MCU_RE = re.compile(r"^\s*MCU\s+(\S+)\s+(\S+)", re.MULTILINE)
FLASH_RE = re.compile(r"^\s*FLASH_SIZE_KB\s+(\d+)", re.MULTILINE)
IMU_RE = re.compile(r"^\s*IMU\s+(\S+)\s+(\S+)", re.MULTILINE)
BARO_RE = re.compile(r"^\s*BARO\s+(\S+)\s+(\S+)", re.MULTILINE)
COMPASS_RE = re.compile(r"^\s*COMPASS\s+(\S+)\s+(\S+)", re.MULTILINE)
SERIAL_ORDER_RE = re.compile(r"^\s*SERIAL_ORDER\s+(.+)$", re.MULTILINE)
I2C_ORDER_RE = re.compile(r"^\s*I2C_ORDER\s+(.+)$", re.MULTILINE)
SPIDEV_RE = re.compile(r"^\s*SPIDEV\s+\S+\s+(SPI\d+)", re.MULTILINE)
CAN_PIN_RE = re.compile(r"\bCAN(\d+)_(?:TX|RX)\b")
CANFD_RE = re.compile(r"^\s*CANFD_SUPPORTED\b", re.MULTILINE)
PWM_RE = re.compile(r"\bPWM\(\d+\)")
AUTOBUILD_RE = re.compile(r"^\s*AUTOBUILD_TARGETS\s+(.+)$", re.MULTILINE)

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
    imus = [(m.group(1), m.group(2)) for m in IMU_RE.finditer(text)]
    baros = [(m.group(1), m.group(2)) for m in BARO_RE.finditer(text)]
    compasses = [(m.group(1), m.group(2)) for m in COMPASS_RE.finditer(text)]

    if not imus:
        return None

    # UART count: tokens in SERIAL_ORDER excluding USB OTG entries.
    uart_count = 0
    sm = SERIAL_ORDER_RE.search(text)
    if sm:
        toks = sm.group(1).split()
        uart_count = sum(1 for t in toks if not t.startswith("OTG") and t != "EMPTY")

    i2c_count = 0
    im = I2C_ORDER_RE.search(text)
    if im:
        i2c_count = len([t for t in im.group(1).split() if t.startswith("I2C")])

    spi_buses = {m.group(1) for m in SPIDEV_RE.finditer(text)}
    can_buses = {m.group(1) for m in CAN_PIN_RE.finditer(text)}
    pwm_count = len(PWM_RE.findall(text))
    canfd = bool(CANFD_RE.search(text))

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
        uart_count=uart_count,
        i2c_count=i2c_count,
        spi_count=len(spi_buses),
        can_count=len(can_buses),
        canfd=canfd,
        pwm_count=pwm_count,
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


def build_docs_map() -> dict[str, str]:
    """Build canonical-key → wiki doc-name map from the local ArduPilot wiki.

    Collects all `common-*.rst` filenames in the docs dir, plus any
    `common-*` references inside common-autopilots.rst. The map key is the
    normalized name with the `common-` prefix and `-overview` suffix removed.
    """
    docs: set[str] = set()
    if ARDUPILOT_WIKI_DOCS.exists():
        for p in ARDUPILOT_WIKI_DOCS.glob("common-*.rst"):
            docs.add(p.stem)
        ap_page = ARDUPILOT_WIKI_DOCS / "common-autopilots.rst"
        if ap_page.exists():
            for m in re.finditer(r"common-[A-Za-z0-9._-]+", ap_page.read_text(errors="ignore")):
                name = m.group(0)
                if name.endswith(".rst"):
                    name = name[:-4]
                docs.add(name)
        # Don't link to the index page itself.
        docs.discard("common-autopilots")

    out: dict[str, tuple[str, list[str]]] = {}
    for doc in docs:
        core = doc[len("common-"):] if doc.startswith("common-") else doc
        if core.endswith("-overview"):
            core = core[: -len("-overview")]
        key = _norm(core)
        if key:
            out[key] = (doc, _tokens(core))
    return out


def match_docs_url(slug: str, docs_map: dict[str, tuple[str, list[str]]]) -> str | None:
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
        return f"{DOCS_BASE_URL}/{docs_map[key][0]}.html"
    if ("the" + key) in docs_map:
        return f"{DOCS_BASE_URL}/{docs_map['the' + key][0]}.html"

    # Substring containment on normalized strings. Best = longest overlap.
    if len(key) >= 6:
        best_sub: tuple[int, str] | None = None
        for wkey, (doc, _wtoks) in docs_map.items():
            if len(wkey) < 6:
                continue
            if key in wkey:
                overlap = len(key)
            elif wkey in key:
                overlap = len(wkey)
            else:
                continue
            if best_sub is None or overlap > best_sub[0]:
                best_sub = (overlap, doc)
        if best_sub:
            return f"{DOCS_BASE_URL}/{best_sub[1]}.html"

    # Token overlap, last resort. Score using ALL slug tokens (exact-match
    # works for short tokens like "3"/"dr"/"g"; substring only for ≥3-char
    # tokens). Tie-break by preferring the most-specific wiki page (fewest
    # unmatched extra tokens).
    slug_toks = _tokens(slug)
    if len(slug_toks) < 2:
        return None
    threshold = max(2, int(round(len(slug_toks) * 0.75)))

    best: tuple[int, float, str] | None = None
    for _wkey, (doc, wtoks) in docs_map.items():
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
        ranking = (hits, wiki_specificity, doc)
        if best is None or ranking > best:
            best = ranking
    if best:
        return f"{DOCS_BASE_URL}/{best[2]}.html"
    return None


def populate_db(session: Session, parsed: list[ParsedBoard], docs_map: dict[str, str]) -> None:
    for p in parsed:
        p.docs_url = match_docs_url(p.slug, docs_map)
        b = Board(
            slug=p.slug,
            name=p.slug,                 # TODO: pretty-name from wiki / README
            manufacturer=None,           # TODO: infer from slug / wiki
            mcu_family=p.mcu_family,
            mcu_part=p.mcu_part,
            flash_kb=p.flash_kb,
            uart_count=p.uart_count,
            i2c_count=p.i2c_count,
            spi_count=p.spi_count,
            can_count=p.can_count,
            canfd=p.canfd,
            pwm_count=p.pwm_count,
            vehicles_csv=",".join(p.vehicles or []),
            docs_url=p.docs_url,
            readme=p.readme,
        )
        for chip, bus in p.imus:
            b.sensors.append(Sensor(kind="imu", chip=chip, bus=bus))
        for chip, bus in p.baros:
            b.sensors.append(Sensor(kind="baro", chip=chip, bus=bus))
        for chip, bus in p.compasses:
            b.sensors.append(Sensor(kind="compass", chip=chip, bus=bus))
        b.firmware_support.append(FirmwareSupport(firmware="ardupilot", maturity="official"))
        session.add(b)
    session.commit()


def export_json(session: Session, out_path: Path) -> None:
    boards = session.scalars(select(Board)).all()
    payload = []
    for b in boards:
        payload.append({
            "slug": b.slug,
            "name": b.name,
            "manufacturer": b.manufacturer,
            "mcu": {"family": b.mcu_family, "part": b.mcu_part},
            "flash_kb": b.flash_kb,
            "io": {
                "uart": b.uart_count,
                "i2c": b.i2c_count,
                "spi": b.spi_count,
                "can": b.can_count,
                "canfd": bool(b.canfd),
                "pwm": b.pwm_count,
            },
            "imus":     [{"chip": s.chip, "bus": s.bus} for s in b.sensors if s.kind == "imu"],
            "baros":    [{"chip": s.chip, "bus": s.bus} for s in b.sensors if s.kind == "baro"],
            "compasses":[{"chip": s.chip, "bus": s.bus} for s in b.sensors if s.kind == "compass"],
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

    matched = sum(1 for p in parsed if p.docs_url)
    print(f"Parsed {len(parsed)} autopilot boards "
          f"({matched} matched to wiki docs, {len(parsed) - matched} unmatched).")
    print(f"  SQLite: {db_path}")
    print(f"  JSON:   {FRONTEND_PUBLIC / 'boards.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
