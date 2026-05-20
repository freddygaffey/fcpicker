export interface SensorEntry {
  chip: string;
  bus: string;
  // BOARD_MATCH(...) token if this sensor is gated to a hardware variant.
  variant: string | null;
}

export interface FirmwareSupport {
  firmware: string;
  maturity: string;
}

export interface BoardIO {
  uart_count: number;
  uart_buses: string[];
  i2c_count: number;
  i2c_buses: string[];
  spi_count: number;
  spi_buses: string[];
  can_count: number;
  can_buses: string[];
  canfd: boolean;
  usb_count: number;
  pwm: { fmu: number; io: number; total: number };
  ethernet: boolean;
  sdcard: boolean;
  sbus_out: boolean;
  iomcu: boolean;
  adc_inputs: number;
}

export interface BecRail {
  rail: string;
  voltage_v: number;
  current_a: number;
  note: string | null;
}

export interface BoardPower {
  monitor_inputs: number;
  bec: BecRail[];
}

export type VehicleType = "copter" | "plane" | "rover" | "sub" | "tracker" | "blimp";

export interface BoardConnector {
  // Function (what the port does) is the primary field — UART, CAN, GPS, etc.
  function: string | null;
  // Physical connector — JST-GH, USB-C, pin header...
  type: string;
  pin_count: number | null;
  // Multiplier: "2× JST-GH 4P (CAN)" is one row with quantity=2.
  quantity: number;
  label: string | null;
}

export interface BoardDimensions {
  length: number | null;
  width: number | null;
  height: number | null;
}

export type ManualStatus = "not_started" | "partial" | "complete";

export interface BoardManual {
  // Explicit completion state — set by the human, not inferred.
  status: ManualStatus;
  form_factor: string | null;
  // Mounting hole pattern (industry standards: 20×20, 30.5×30.5, etc.)
  mounting: string | null;
  // Assembly state: no soldering / headers included / soldering required.
  assembly: string | null;
  dimensions_mm: BoardDimensions | null;
  weight_g: number | null;
  connectors: BoardConnector[];
  // Filenames of images uploaded via the admin UI. Served from
  // /board-images/<slug>/<filename>. Shown alongside hwdef images.
  images: string[];
  // Direct link to the board's source in the ArduPilot repo (or vendor docs).
  ardupilot_repo_url: string | null;
  // If true, hide from the public selector by default.
  discontinued: boolean;
  notes: string | null;
}

export interface Board {
  slug: string;
  name: string;
  manufacturer: string | null;
  mcu: { family: string | null; part: string | null };
  flash_kb: number | null;
  io: BoardIO;
  power: BoardPower;
  imus: SensorEntry[];
  baros: SensorEntry[];
  compasses: SensorEntry[];
  firmware_support: FirmwareSupport[];
  vehicles: VehicleType[];
  docs_url: string | null;
  manual?: BoardManual;
}

export interface BoardsPayload {
  boards: Board[];
}
