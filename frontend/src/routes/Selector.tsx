import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { mcuFamilyLabel, useBoards } from "../data";
import type { Board, VehicleType } from "../types";

interface Filters {
  query: string;
  mcu: string;
  vehicles: VehicleType[];
  uart: number;
  i2c: number;
  spi: number;
  can: number;
  pwm: number;
  imus: number;
  canfd: boolean;
  minFlash: number;
}

const DEFAULTS: Filters = {
  query: "",
  mcu: "ANY",
  vehicles: [],
  uart: 0,
  i2c: 0,
  spi: 0,
  can: 0,
  pwm: 0,
  imus: 1,
  canfd: false,
  minFlash: 0,
};

const VEHICLES: { id: VehicleType; label: string }[] = [
  { id: "copter",  label: "Copter" },
  { id: "plane",   label: "Plane" },
  { id: "rover",   label: "Rover" },
  { id: "sub",     label: "Sub" },
  { id: "tracker", label: "Tracker" },
  { id: "blimp",   label: "Blimp" },
];

type SortKey = "slug" | "mcu" | "flash" | "uart" | "i2c" | "spi" | "can" | "pwm" | "imus";

interface CsvColumn {
  id: string;
  label: string;
  get: (b: Board) => string | number;
}

const CSV_COLUMNS: CsvColumn[] = [
  { id: "slug",       label: "Board name",         get: (b) => b.slug },
  { id: "mcu_family", label: "MCU family",         get: (b) => b.mcu.family ?? "" },
  { id: "mcu_part",   label: "MCU part",           get: (b) => b.mcu.part ?? "" },
  { id: "flash_kb",   label: "Flash (KB)",         get: (b) => b.flash_kb ?? "" },
  { id: "uart",       label: "UART count",         get: (b) => b.io.uart_count },
  { id: "i2c",        label: "I²C count",          get: (b) => b.io.i2c_count },
  { id: "spi",        label: "SPI count",          get: (b) => b.io.spi_count },
  { id: "can",        label: "CAN count",          get: (b) => b.io.can_count },
  { id: "canfd",      label: "CAN-FD support",     get: (b) => (b.io.canfd ? "yes" : "no") },
  { id: "pwm",        label: "PWM total",          get: (b) => b.io.pwm.total },
  { id: "pwm_fmu",    label: "PWM (FMU)",          get: (b) => b.io.pwm.fmu },
  { id: "pwm_io",     label: "PWM (IO)",           get: (b) => b.io.pwm.io },
  { id: "ethernet",   label: "Ethernet",           get: (b) => (b.io.ethernet ? "yes" : "no") },
  { id: "sdcard",     label: "microSD",            get: (b) => (b.io.sdcard ? "yes" : "no") },
  { id: "sbus_out",   label: "SBUS out",           get: (b) => (b.io.sbus_out ? "yes" : "no") },
  { id: "usb",        label: "USB ports",          get: (b) => b.io.usb_count },
  { id: "power",      label: "Power inputs",       get: (b) => b.power.monitor_inputs },
  { id: "imus",       label: "IMU count",          get: (b) => b.imus.length },
  { id: "baros",      label: "Baro count",         get: (b) => b.baros.length },
  { id: "compasses",  label: "Compass count",      get: (b) => b.compasses.length },
  { id: "vehicles",   label: "Supported vehicles", get: (b) => b.vehicles.join("|") },
  { id: "docs_url",   label: "ArduPilot docs URL", get: (b) => b.docs_url ?? "" },
];

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(boards: Board[], columnIds: string[]) {
  const cols = CSV_COLUMNS.filter((c) => columnIds.includes(c.id));
  if (cols.length === 0) return;
  const header = cols.map((c) => c.id).join(",");
  const rows = boards.map((b) => cols.map((c) => csvCell(c.get(b))).join(","));
  const csv = [header, ...rows].join("\n") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fcpicker-boards-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function passes(b: Board, f: Filters): boolean {
  if (f.query) {
    const q = f.query.trim().toLowerCase();
    if (q && !b.slug.toLowerCase().includes(q)) return false;
  }
  if (f.mcu !== "ANY" && mcuFamilyLabel(b.mcu.family) !== f.mcu) return false;
  if (f.vehicles.length > 0) {
    for (const v of f.vehicles) {
      if (!b.vehicles.includes(v)) return false;
    }
  }
  if (b.io.uart_count < f.uart) return false;
  if (b.io.i2c_count < f.i2c) return false;
  if (b.io.spi_count < f.spi) return false;
  if (b.io.can_count < f.can) return false;
  if (b.io.pwm.total < f.pwm) return false;
  if (b.imus.length < f.imus) return false;
  if (f.canfd && !b.io.canfd) return false;
  if (f.minFlash && (b.flash_kb ?? 0) < f.minFlash) return false;
  return true;
}

export default function Selector() {
  const { boards, loading, error } = useBoards();
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "slug", dir: 1 });
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvScope, setCsvScope] = useState<"filtered" | "all">("filtered");
  const [csvCols, setCsvCols] = useState<Set<string>>(
    () => new Set(CSV_COLUMNS.map((c) => c.id)),
  );

  const mcuOptions = useMemo(() => {
    if (!boards) return [];
    const set = new Set<string>();
    for (const b of boards) set.add(mcuFamilyLabel(b.mcu.family));
    return Array.from(set).sort();
  }, [boards]);

  const filtered = useMemo(() => {
    if (!boards) return [];
    const out = boards.filter((b) => passes(b, f));
    out.sort((a, b) => {
      const dir = sort.dir;
      switch (sort.key) {
        case "slug": return a.slug.localeCompare(b.slug) * dir;
        case "mcu":  return mcuFamilyLabel(a.mcu.family).localeCompare(mcuFamilyLabel(b.mcu.family)) * dir;
        case "flash": return ((a.flash_kb ?? 0) - (b.flash_kb ?? 0)) * dir;
        case "uart": return (a.io.uart_count - b.io.uart_count) * dir;
        case "i2c":  return (a.io.i2c_count - b.io.i2c_count) * dir;
        case "spi":  return (a.io.spi_count - b.io.spi_count) * dir;
        case "can":  return (a.io.can_count - b.io.can_count) * dir;
        case "pwm":  return (a.io.pwm.total - b.io.pwm.total) * dir;
        case "imus": return (a.imus.length - b.imus.length) * dir;
      }
    });
    return out;
  }, [boards, f, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-block">
          <h3 className="block-title">Search</h3>
          <input
            type="text"
            className="input-text"
            placeholder="Cube, Pixhawk, Matek…"
            value={f.query}
            onChange={(e) => set("query", e.target.value)}
          />
        </div>

        <div className="sidebar-block">
          <h3 className="block-title">Vehicle type</h3>
          <div className="chip-row">
            {VEHICLES.map((v) => {
              const on = f.vehicles.includes(v.id);
              return (
                <button
                  key={v.id}
                  className={"chip " + (on ? "chip-on" : "")}
                  onClick={() =>
                    set(
                      "vehicles",
                      on ? f.vehicles.filter((x) => x !== v.id) : [...f.vehicles, v.id],
                    )
                  }
                >
                  {v.label}
                </button>
              );
            })}
          </div>
          {f.vehicles.length > 0 && (
            <p className="filter-note">
              Showing boards that build for {f.vehicles.length === 1 ? "this vehicle" : "all selected vehicles"}.
            </p>
          )}
        </div>

        <div className="sidebar-block">
          <h3 className="block-title">MCU family</h3>
          <div className="chip-row">
            {(["ANY", ...mcuOptions]).map((m) => (
              <button
                key={m}
                className={"chip " + (f.mcu === m ? "chip-on" : "")}
                onClick={() => set("mcu", m)}
              >
                {m === "ANY" ? "Any" : m.replace("STM32 ", "")}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-block">
          <h3 className="block-title">Minimum peripherals</h3>
          <Stepper label="UART"   value={f.uart} max={10} onChange={(v) => set("uart", v)} />
          <Stepper label="I²C"    value={f.i2c}  max={6}  onChange={(v) => set("i2c", v)} />
          <Stepper label="SPI"    value={f.spi}  max={8}  onChange={(v) => set("spi", v)} />
          <Stepper label="CAN"    value={f.can}  max={4}  onChange={(v) => set("can", v)} />
          <Stepper label="PWM"    value={f.pwm}  max={16} onChange={(v) => set("pwm", v)} />
          <Stepper label="IMU"    value={f.imus} max={5}  min={1} onChange={(v) => set("imus", v)} />
        </div>

        <div className="sidebar-block">
          <h3 className="block-title">Features</h3>
          <label className="toggle">
            <input type="checkbox" checked={f.canfd} onChange={(e) => set("canfd", e.target.checked)} />
            <span className="toggle-mark" aria-hidden />
            <span className="toggle-label">CAN-FD capable</span>
          </label>
        </div>

        <div className="sidebar-block">
          <h3 className="block-title">Minimum flash</h3>
          <input
            type="range"
            min={0}
            max={2048}
            step={128}
            value={f.minFlash}
            onChange={(e) => set("minFlash", Number(e.target.value))}
            className="range"
          />
          <div className="range-readout">
            <span>{f.minFlash} KB</span>
            <span className="range-max">up to 2048</span>
          </div>
        </div>

        <button className="reset" onClick={() => setF(DEFAULTS)}>
          Reset filters
        </button>
      </aside>

      <section className="results">
        <div className="results-head">
          <div>
            <h1 className="results-title">Flight controllers</h1>
            <p className="results-sub">
              <strong>{filtered.length}</strong> of {boards?.length ?? 0} ArduPilot-supported boards
              match your filters.
            </p>
          </div>
          <div className="results-actions">
            <button
              type="button"
              className="btn-csv"
              onClick={() => setCsvOpen(true)}
              disabled={(boards?.length ?? 0) === 0}
              title="Configure and download a CSV file"
            >
              ⤓ Download CSV…
            </button>
            <div className="results-legend">
              <span><i className="dot dot-green" /> ArduPilot official</span>
              <span><i className="dot dot-blue" /> CAN-FD</span>
            </div>
          </div>
        </div>

        {loading && <div className="state">Loading catalog…</div>}
        {error && <div className="state state-err">Couldn't load boards.json: {error}</div>}

        {boards && (
          <div className="table-wrap">
            <table className="ttable">
              <thead>
                <tr>
                  <Th label="BOARD"     k="slug"  sort={sort} onClick={toggleSort} />
                  <Th label="MCU"       k="mcu"   sort={sort} onClick={toggleSort} />
                  <Th label="FLASH"     k="flash" sort={sort} onClick={toggleSort} align="right" />
                  <Th label="UART"      k="uart"  sort={sort} onClick={toggleSort} align="right" />
                  <Th label="I²C"       k="i2c"   sort={sort} onClick={toggleSort} align="right" />
                  <Th label="SPI"       k="spi"   sort={sort} onClick={toggleSort} align="right" />
                  <Th label="CAN"       k="can"   sort={sort} onClick={toggleSort} align="right" />
                  <Th label="PWM"       k="pwm"   sort={sort} onClick={toggleSort} align="right" />
                  <Th label="IMU"       k="imus"  sort={sort} onClick={toggleSort} align="right" />
                  <th aria-label="open" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.slug} className="trow">
                    <td className="td-name">
                      <Link to={`/board/${b.slug}`} className="row-link">
                        <span className="row-bracket">[</span>
                        {b.slug}
                        <span className="row-bracket">]</span>
                      </Link>
                    </td>
                    <td className="td-mcu">{mcuFamilyLabel(b.mcu.family)}</td>
                    <td className="td-num">{b.flash_kb ? `${b.flash_kb}K` : "—"}</td>
                    <td className="td-num">{b.io.uart_count}</td>
                    <td className="td-num">{b.io.i2c_count}</td>
                    <td className="td-num">{b.io.spi_count}</td>
                    <td className="td-num">
                      {b.io.can_count}{b.io.canfd && <span className="canfd-tag">FD</span>}
                    </td>
                    <td className="td-num">{b.io.pwm.total}</td>
                    <td className="td-num">{b.imus.length}</td>
                    <td className="td-open">
                      <Link to={`/board/${b.slug}`} aria-label={`Open ${b.slug}`}>→</Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="empty">— NO BOARDS MATCH CURRENT PARAMETERS —</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {csvOpen && boards && (
          <CsvDialog
            filteredCount={filtered.length}
            totalCount={boards.length}
            scope={csvScope}
            setScope={setCsvScope}
            selected={csvCols}
            setSelected={setCsvCols}
            onCancel={() => setCsvOpen(false)}
            onDownload={() => {
              const rows = csvScope === "all" ? boards : filtered;
              downloadCsv(rows, Array.from(csvCols));
              setCsvOpen(false);
            }}
          />
        )}
      </section>
    </>
  );
}

function CsvDialog({
  filteredCount, totalCount, scope, setScope, selected, setSelected,
  onCancel, onDownload,
}: {
  filteredCount: number;
  totalCount: number;
  scope: "filtered" | "all";
  setScope: (s: "filtered" | "all") => void;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onCancel: () => void;
  onDownload: () => void;
}) {
  const toggleCol = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const selectAll = () => setSelected(new Set(CSV_COLUMNS.map((c) => c.id)));
  const selectNone = () => setSelected(new Set());

  const willExport = scope === "filtered" ? filteredCount : totalCount;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-head">
          <h2>Download CSV</h2>
          <button className="modal-x" onClick={onCancel} aria-label="Close">×</button>
        </header>

        <div className="modal-body">
          <fieldset className="modal-section">
            <legend>What to export</legend>
            <label className="radio">
              <input
                type="radio"
                checked={scope === "filtered"}
                onChange={() => setScope("filtered")}
              />
              <span>
                <strong>Current filtered results</strong>{" "}
                <span className="radio-hint">({filteredCount} board{filteredCount === 1 ? "" : "s"})</span>
              </span>
            </label>
            <label className="radio">
              <input
                type="radio"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              <span>
                <strong>All boards</strong>{" "}
                <span className="radio-hint">({totalCount} boards, ignores filters)</span>
              </span>
            </label>
          </fieldset>

          <fieldset className="modal-section">
            <legend>
              Columns
              <span className="legend-actions">
                <button type="button" className="link-btn" onClick={selectAll}>All</button>
                {" · "}
                <button type="button" className="link-btn" onClick={selectNone}>None</button>
              </span>
            </legend>
            <div className="col-grid">
              {CSV_COLUMNS.map((c) => (
                <label key={c.id} className="check">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleCol(c.id)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <footer className="modal-foot">
          <span className="modal-summary">
            {selected.size} column{selected.size === 1 ? "" : "s"} ·{" "}
            {willExport} row{willExport === 1 ? "" : "s"}
          </span>
          <div className="modal-buttons">
            <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
            <button
              type="button"
              className="btn-csv"
              onClick={onDownload}
              disabled={selected.size === 0 || willExport === 0}
            >
              Download
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Th({
  label, k, sort, onClick, align,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onClick: (k: SortKey) => void;
  align?: "right";
}) {
  const active = sort.key === k;
  return (
    <th
      className={`th${align === "right" ? " th-right" : ""}${active ? " th-active" : ""}`}
      onClick={() => onClick(k)}
    >
      <span>{label}</span>
      <span className="th-caret">{active ? (sort.dir === 1 ? "▲" : "▼") : "·"}</span>
    </th>
  );
}

function Stepper({
  label, value, onChange, min = 0, max,
}: { label: string; value: number; min?: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-ctrl">
        <button
          className="stepper-btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`${label} decrease`}
        >−</button>
        <span className="stepper-value">≥ {value}</span>
        <button
          className="stepper-btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`${label} increase`}
        >+</button>
      </div>
    </div>
  );
}
