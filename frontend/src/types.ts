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

export interface BoardPower {
  monitor_inputs: number;
}

export type VehicleType = "copter" | "plane" | "rover" | "sub" | "tracker" | "blimp";

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
}

export interface BoardsPayload {
  boards: Board[];
}
