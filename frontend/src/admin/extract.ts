// Parse pasted product-page / datasheet text and propose structured fields.
// Conservative: only emits hits it's pretty sure about. User reviews
// proposals before they apply.

import type { BoardConnector, BoardDimensions } from "../types";

export interface ExtractResult {
  connectors: BoardConnector[];
  dimensions: BoardDimensions | null;
  weight_g: number | null;
  // Mounting pattern hint (e.g. "30.5×30.5") — typically from "hole grid" text.
  mounting: string | null;
}

// ---- Connector regex --------------------------------------------------------
const CONNECTOR_RE =
  /(?:(\d+)\s*[x×]\s*)?(JST[- ]?(?:GH|SH|ZH|XH)|Molex[- ]?(?:PicoBlade|Clik[- ]?Mate)|DF13|2\.54\s*mm\s*header|1\.27\s*mm\s*header|USB[- ]?C|Micro[- ]?USB)\s*[, ]*\s*(\d+)\s*[- ]?(?:pin|p|P)?\b\s*\(?([^)\n]{0,40}?)?\)?/gi;

// ---- Mounting hole grid -----------------------------------------------------
// "30.5 x 30.5mm hole grid", "20×20 mounting holes", "30.5x30.5 pattern"
const HOLE_GRID_RE =
  /(\d+(?:\.\d+)?)\s*(?:mm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:hole(?:\s*grid)?|mounting(?:\s*hole[s]?)?|pattern|spacing)/i;

// ---- Inline dimensions ------------------------------------------------------
// Tolerates "92.2 (L) x 51.2 (W) x 28.3 (H) mm" — (L)/(W)/(H) tags and
// optional `mm` between dimensions are skipped.
const DIM_TAG = /\s*(?:\([^)]*\))?\s*(?:mm)?\s*/.source;
const DIMS_RE = new RegExp(
  `(\\d+(?:\\.\\d+)?)${DIM_TAG}[x×]${DIM_TAG}(\\d+(?:\\.\\d+)?)${DIM_TAG}(?:[x×]${DIM_TAG}(\\d+(?:\\.\\d+)?))?\\s*(?:mm)?`,
  "i",
);

// ---- Labelled-axis dimensions ----------------------------------------------
// e.g. ArduPilot wiki "Width 50 mm" / "Height 15.5 mm" / "Length 81.5 mm".
function labelledAxis(text: string, label: string): number | null {
  const re = new RegExp(`\\b${label}\\b[^0-9\\n]{0,12}(\\d+(?:\\.\\d+)?)\\s*mm\\b`, "i");
  const m = text.match(re);
  return m ? parseFloat(m[1]) : null;
}

// ---- Weight ----------------------------------------------------------------
const WEIGHT_RE = /(\d+(?:\.\d+)?)\s*g\b/i;
// Also: "Weight 38 g (1.3 oz)" — labelled style.
const WEIGHT_LABEL_RE = /\bweight\b[^0-9\n]{0,12}(\d+(?:\.\d+)?)\s*g\b/i;

function normalizeType(raw: string): string {
  const u = raw.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  if (u.startsWith("JSTGH")) return "JST-GH";
  if (u.startsWith("JSTSH")) return "JST-SH";
  if (u.startsWith("JSTZH")) return "JST-ZH";
  if (u.startsWith("JSTXH")) return "JST-XH";
  if (u.startsWith("MOLEXPICO")) return "Molex-PicoBlade";
  if (u.startsWith("MOLEXCLIK")) return "Molex-ClikMate";
  if (u === "DF13") return "DF13";
  if (u.includes("2.54")) return "Header-2.54";
  if (u.includes("1.27")) return "Header-1.27";
  if (u.includes("USBC")) return "USB-C";
  if (u.includes("MICROUSB")) return "Micro-USB";
  return "Other";
}

function guessFunction(label: string): string | null {
  const l = label.toLowerCase();
  if (/gps|gnss/.test(l)) return "GPS";
  if (/\bcan\b|dronecan|uavcan/.test(l)) return "CAN";
  if (/uart|telem|tx|rx/.test(l)) return "UART / Telem";
  if (/\bi2c\b|compass/.test(l)) return "I2C";
  if (/\bspi\b/.test(l)) return "SPI";
  if (/power|vbat|batt/.test(l)) return "Power input";
  if (/pwm|esc|motor/.test(l)) return "PWM out";
  if (/sbus|ppm|crsf|rc\s*in/.test(l)) return "RC in";
  if (/usb/.test(l)) return "USB";
  if (/debug|swd|jtag/.test(l)) return "Debug / SWD";
  if (/ether|rj45/.test(l)) return "Ethernet";
  return null;
}

// Map a raw "30.5×30.5" to one of the canonical MOUNTING_PATTERNS values if it
// matches; otherwise return the freeform form for display.
function canonicalMounting(a: number, b: number): string {
  const round = (n: number) => Math.round(n * 10) / 10;
  const key = `${round(a)}x${round(b)}`;
  const known = ["16x16", "20x20", "25.5x25.5", "30.5x30.5", "35x35"];
  return known.includes(key) ? key : `${a}×${b}`;
}

export function extract(text: string): ExtractResult {
  const out: ExtractResult = { connectors: [], dimensions: null, weight_g: null, mounting: null };
  if (!text.trim()) return out;

  // Mounting first — if we find a hole grid, we'll exclude that match from the
  // dimensions pass so it doesn't get mistaken for the board outline.
  const holes = text.match(HOLE_GRID_RE);
  let stripped = text;
  if (holes) {
    out.mounting = canonicalMounting(parseFloat(holes[1]), parseFloat(holes[2]));
    stripped = text.replace(HOLE_GRID_RE, " ");
  }

  // Inline dimensions on the hole-grid-removed text.
  const d = stripped.match(DIMS_RE);
  if (d) {
    out.dimensions = {
      length: parseFloat(d[1]),
      width: parseFloat(d[2]),
      height: d[3] ? parseFloat(d[3]) : null,
    };
  } else {
    // Fall back to labelled axes (Width / Height / Length).
    const w = labelledAxis(text, "width");
    const h = labelledAxis(text, "height");
    const l = labelledAxis(text, "length") ?? labelledAxis(text, "depth");
    if (w != null || h != null || l != null) {
      out.dimensions = { length: l, width: w, height: h };
    }
  }

  // Weight — prefer labelled match, fall back to bare "Ng".
  const wl = text.match(WEIGHT_LABEL_RE);
  if (wl) out.weight_g = parseFloat(wl[1]);
  else {
    const wb = text.match(WEIGHT_RE);
    if (wb) out.weight_g = parseFloat(wb[1]);
  }

  // Connectors — merge identical (type, pins, function) into one row.
  const acc = new Map<string, BoardConnector>();
  for (const m of text.matchAll(CONNECTOR_RE)) {
    const count = parseInt(m[1] ?? "1", 10) || 1;
    const type = normalizeType(m[2]);
    const pins = parseInt(m[3], 10);
    const labelText = (m[4] ?? "").trim();
    const fn = labelText ? guessFunction(labelText) : null;
    const key = `${type}|${pins}|${fn ?? ""}|${labelText}`;
    const existing = acc.get(key);
    if (existing) {
      existing.quantity += count;
    } else {
      acc.set(key, {
        function: fn,
        type,
        pin_count: pins,
        quantity: count,
        label: labelText || null,
      });
    }
  }
  out.connectors = Array.from(acc.values());

  return out;
}
