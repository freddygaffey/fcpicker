export interface SensorEntry {
  chip: string;
  bus: string;
}

export interface FirmwareSupport {
  firmware: string;
  maturity: string;
}

export interface BoardIO {
  uart: number;
  i2c: number;
  spi: number;
  can: number;
  canfd: boolean;
  pwm: number;
}

export type VehicleType = "copter" | "plane" | "rover" | "sub" | "tracker" | "blimp";

export interface Board {
  slug: string;
  name: string;
  manufacturer: string | null;
  mcu: { family: string | null; part: string | null };
  flash_kb: number | null;
  io: BoardIO;
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
