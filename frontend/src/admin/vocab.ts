// Controlled vocabularies for the admin panel.
// Stored values are the strings below verbatim — renaming an option
// breaks existing data, so prefer adding over editing.

export const FORM_FACTORS = [
  { value: "aio",        label: "All-in-One (AIO)" },
  { value: "stack",      label: "Stack module" },
  { value: "carrier",    label: "Carrier + module" },
  { value: "standalone", label: "Standalone" },
  { value: "wing",       label: "Wing / long-format" },
  { value: "node",       label: "CAN node / peripheral" },
] as const;

// Mounting hole patterns — the actual industry standards.
// Order = popularity (most-common first cuts edit time on 236 boards).
export const MOUNTING_PATTERNS = [
  { value: "30.5x30.5", label: "30.5 × 30.5 mm" },
  { value: "20x20",     label: "20 × 20 mm" },
  { value: "25.5x25.5", label: "25.5 × 25.5 mm" },
  { value: "16x16",     label: "16 × 16 mm" },
  { value: "35x35",     label: "35 × 35 mm" },
  { value: "pixhawk",   label: "Pixhawk standard" },
  { value: "cube",      label: "Cube carrier" },
  { value: "custom",    label: "Other / custom" },
  { value: "none",      label: "No mounting holes" },
] as const;

export const ASSEMBLY_OPTIONS = [
  { value: "no-solder",      label: "Pixhawk style — no assembly needed" },
  { value: "partial-solder", label: "Some soldering required for some ports" },
  { value: "no-ports",       label: "No ports — solder everything yourself" },
] as const;

export const STATUS_OPTIONS = [
  { value: "not_started", label: "Not started", short: "Not started" },
  { value: "partial",     label: "Partial",     short: "Partial" },
  { value: "complete",    label: "Complete",    short: "Complete" },
] as const;

// What the port DOES — primary field on a connector row.
// Ordered roughly by frequency on a typical flight controller.
export const CONNECTOR_FUNCTIONS = [
  "GPS",
  "CAN",
  "UART / Telem",
  "I2C",
  "SPI",
  "RC in",
  "PWM out",
  "Power input",
  "Power output / BEC",
  "Battery",
  "USB",
  "Debug / SWD",
  "Ethernet",
  "SBUS out",
  "Servo rail",
  "Sensor",
  "Other",
] as const;

export const CONNECTOR_TYPES = [
  { value: "JST-GH",          label: "JST-GH (1.25mm)" },
  { value: "JST-SH",          label: "JST-SH (1.00mm)" },
  { value: "JST-ZH",          label: "JST-ZH (1.50mm)" },
  { value: "JST-XH",          label: "JST-XH (2.50mm)" },
  { value: "Molex-PicoBlade", label: "Molex PicoBlade" },
  { value: "Molex-ClikMate",  label: "Molex Clik-Mate" },
  { value: "Header-2.54",     label: "Pin header 2.54mm" },
  { value: "Header-1.27",     label: "Pin header 1.27mm" },
  { value: "Solder-pad",      label: "Solder pad" },
  { value: "USB-C",           label: "USB-C" },
  { value: "Micro-USB",       label: "Micro-USB" },
  { value: "DF13",            label: "DF13 (legacy)" },
  { value: "XT30",            label: "XT30" },
  { value: "XT60",            label: "XT60" },
  { value: "Other",           label: "Other / unknown" },
] as const;
