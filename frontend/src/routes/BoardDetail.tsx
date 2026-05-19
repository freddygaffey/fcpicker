import { Link, useParams } from "react-router-dom";
import { mcuFamilyLabel, useBoards } from "../data";

const ALL_VEHICLES = ["copter", "plane", "rover", "sub", "tracker", "blimp"] as const;
const VEHICLE_LABEL: Record<string, string> = {
  copter: "Copter", plane: "Plane", rover: "Rover",
  sub: "Sub", tracker: "Tracker", blimp: "Blimp",
};

export default function BoardDetail() {
  const { slug = "" } = useParams();
  const { boards, loading, error } = useBoards();

  if (loading) return <div className="state">Loading…</div>;
  if (error) return <div className="state state-err">Couldn't load boards.json: {error}</div>;
  if (!boards) return null;

  const b = boards.find((x) => x.slug === slug);
  if (!b) {
    return (
      <div className="detail">
        <Link to="/" className="back-link">← Back to selector</Link>
        <div className="state state-err">Unknown board: {slug}</div>
      </div>
    );
  }

  const docsCommon = "https://ardupilot.org/copter/docs/common-autopilots.html";
  const docsSearch = `https://ardupilot.org/search.html?q=${encodeURIComponent(b.slug)}&check_keywords=yes&area=default`;
  const hwdefUrl = `https://github.com/ArduPilot/ardupilot/tree/master/libraries/AP_HAL_ChibiOS/hwdef/${b.slug}`;
  const firmware = b.firmware_support[0];

  return (
    <article className="detail">
      <Link to="/" className="back-link">← Back to selector</Link>

      <header className="bd-head">
        <p className="bd-eyebrow">ArduPilot-supported autopilot</p>
        <h1 className="bd-title">{b.slug}</h1>
        <p className="bd-subtitle">
          {mcuFamilyLabel(b.mcu.family)}
          {b.mcu.part && <> &nbsp;·&nbsp; <code className="bd-code">{b.mcu.part}</code></>}
          {b.flash_kb && <> &nbsp;·&nbsp; {b.flash_kb} KB flash</>}
        </p>
      </header>

      {/* Most-important action: open the official docs */}
      {b.docs_url ? (
        <a className="bd-doc-cta" href={b.docs_url} target="_blank" rel="noreferrer">
          <span className="bd-doc-cta-label">Open the official ArduPilot docs for this board</span>
          <span className="bd-doc-cta-arrow">↗</span>
        </a>
      ) : (
        <div className="bd-doc-cta bd-doc-cta-missing">
          <span>No dedicated ArduPilot wiki page found for this board.</span>
          <a href={docsSearch} target="_blank" rel="noreferrer">Search the docs ↗</a>
        </div>
      )}

      {/* Stats strip — at a glance */}
      <section className="bd-section">
        <h2 className="bd-h2">Key specs</h2>
        <div className="bd-stats">
          <Stat label="UART" value={b.io.uart_count} hint={b.io.uart_buses.join(", ") || undefined} />
          <Stat label="I²C"  value={b.io.i2c_count} hint={b.io.i2c_buses.join(", ") || undefined} />
          <Stat label="SPI"  value={b.io.spi_count} hint={b.io.spi_buses.join(", ") || undefined} />
          <Stat label={b.io.canfd ? "CAN-FD" : "CAN"} value={b.io.can_count} hint={b.io.can_buses.join(", ") || undefined} />
          <Stat
            label="PWM"
            value={b.io.pwm.total}
            hint={b.io.iomcu ? `${b.io.pwm.fmu} FMU + ${b.io.pwm.io} IO` : "FMU only"}
          />
          <Stat label="IMUs" value={b.imus.length} />
        </div>
        <div className="bd-feature-row">
          <FeatureChip on={b.io.ethernet} label="Ethernet" />
          <FeatureChip on={b.io.sdcard} label="microSD" />
          <FeatureChip on={b.io.sbus_out} label="SBUS out" />
          <FeatureChip on={b.io.usb_count > 0} label={`USB ×${b.io.usb_count}`} />
          {b.power.monitor_inputs > 0 && <FeatureChip on label={`Power inputs ×${b.power.monitor_inputs}`} />}
          {b.io.adc_inputs > 0 && <FeatureChip on label={`ADC ×${b.io.adc_inputs}`} />}
        </div>
      </section>

      {/* Sensors */}
      <section className="bd-section">
        <h2 className="bd-h2">On-board sensors</h2>
        <SensorRow label="IMUs"        items={b.imus} />
        <SensorRow label="Barometers"  items={b.baros} />
        <SensorRow label="Compasses"   items={b.compasses} />
      </section>

      {/* Vehicles — inline row of pills, NOT stacked */}
      <section className="bd-section">
        <h2 className="bd-h2">Vehicle support</h2>
        <p className="bd-vehicles">
          {ALL_VEHICLES.map((v) => (
            <span
              key={v}
              className={"bd-v " + (b.vehicles.includes(v) ? "bd-v-on" : "bd-v-off")}
              title={b.vehicles.includes(v) ? "Supported" : "Not built for this vehicle"}
            >
              {b.vehicles.includes(v) ? "✓" : "✕"} {VEHICLE_LABEL[v]}
            </span>
          ))}
        </p>
        <p className="bd-aside">
          From the <code className="bd-code">AUTOBUILD_TARGETS</code> line in this board&rsquo;s hwdef.
        </p>
      </section>

      {/* Firmware compatibility — one-liner, not a table */}
      <section className="bd-section">
        <h2 className="bd-h2">Firmware compatibility</h2>
        <p className="bd-line">
          <strong style={{ textTransform: "capitalize" }}>{firmware.firmware}</strong>{" "}
          —{" "}
          <span className={`maturity maturity-${firmware.maturity}`}>{firmware.maturity}</span>
        </p>
      </section>

      {/* Other references */}
      <section className="bd-section">
        <h2 className="bd-h2">More references</h2>
        <ul className="bd-links">
          <li><a href={hwdefUrl} target="_blank" rel="noreferrer">hwdef source on GitHub ↗</a></li>
          <li><a href={docsCommon} target="_blank" rel="noreferrer">Common autopilots — overview index ↗</a></li>
        </ul>
      </section>
    </article>
  );
}

function FeatureChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={"bd-v " + (on ? "bd-v-on" : "bd-v-off")}>
      {on ? "✓" : "✕"} {label}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="bd-stat" title={hint}>
      <div className="bd-stat-value">{value}</div>
      <div className="bd-stat-label">{label}</div>
      {hint && <div className="bd-stat-hint">{hint}</div>}
    </div>
  );
}

function SensorRow({ label, items }: { label: string; items: { chip: string; bus: string }[] }) {
  if (items.length === 0) {
    return (
      <div className="bd-sensor-row">
        <span className="bd-sensor-label">{label}</span>
        <span className="bd-sensor-empty">none</span>
      </div>
    );
  }
  return (
    <div className="bd-sensor-row">
      <span className="bd-sensor-label">{label} <span className="bd-sensor-count">×{items.length}</span></span>
      <ul className="bd-sensor-list">
        {items.map((s, i) => (
          <li key={i}>
            <span className="bd-sensor-chip">{s.chip}</span>
            <span className="bd-sensor-bus"> @ {s.bus}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
