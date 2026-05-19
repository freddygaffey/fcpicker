import { Link, useParams } from "react-router-dom";
import { mcuFamilyLabel, useBoards } from "../data";

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
        <div className="state state-err">Unknown board: {slug}</div>
        <Link to="/" className="back-link">← Back to selector</Link>
      </div>
    );
  }

  const docsCommon = "https://ardupilot.org/copter/docs/common-autopilots.html";
  const docsSearch = `https://ardupilot.org/search.html?q=${encodeURIComponent(b.slug)}&check_keywords=yes&area=default`;

  const ALL_VEHICLES = ["copter", "plane", "rover", "sub", "tracker", "blimp"] as const;
  const vehicleLabel: Record<string, string> = {
    copter: "Copter", plane: "Plane", rover: "Rover",
    sub: "Sub", tracker: "Tracker", blimp: "Blimp",
  };

  return (
    <div className="detail">
      <Link to="/" className="back-link">← Back to selector</Link>

      <div className="datasheet">
        <header className="ds-title">
          <div className="ds-tag">ArduPilot-supported autopilot</div>
          <h1 className="ds-h1">{b.slug}</h1>
          <div className="ds-sub">
            <span>{mcuFamilyLabel(b.mcu.family)}</span>
            {b.mcu.part && <span>{b.mcu.part}</span>}
            {b.flash_kb && <span>{b.flash_kb} KB flash</span>}
            <span className="ds-ok"><i className="dot dot-green" /> ArduPilot official</span>
          </div>
        </header>

        <section className="ds-grid">
          <Card title="I/O interfaces">
            <table className="ds-table">
              <tbody>
                <Row label="UART"     val={b.io.uart} />
                <Row label="I²C"      val={b.io.i2c} />
                <Row label="SPI"      val={b.io.spi} />
                <Row label="CAN"      val={`${b.io.can}${b.io.canfd ? "  (CAN-FD)" : ""}`} />
                <Row label="PWM (FMU)" val={b.io.pwm} hint={b.io.pwm <= 6 ? "main outputs likely via IOMCU" : undefined} />
              </tbody>
            </table>
          </Card>

          <Card title="On-board sensors">
            <SensorList kind="IMU"     items={b.imus} />
            <SensorList kind="Baro"    items={b.baros} />
            <SensorList kind="Compass" items={b.compasses} />
          </Card>

          <Card title="Supported vehicles" wide>
            <ul className="vehicle-pills">
              {ALL_VEHICLES.map((v) => {
                const supported = b.vehicles.includes(v);
                return (
                  <li key={v} className={"vehicle-pill " + (supported ? "vp-on" : "vp-off")}>
                    <span className="vp-mark">{supported ? "✓" : "—"}</span>
                    {vehicleLabel[v]}
                  </li>
                );
              })}
            </ul>
            <p className="vehicle-note">
              Based on the <code>AUTOBUILD_TARGETS</code> declaration in this board&rsquo;s hwdef.
            </p>
          </Card>

          <Card title="Firmware compatibility" wide>
            <table className="ds-table">
              <thead>
                <tr><th>Firmware</th><th>Maturity</th></tr>
              </thead>
              <tbody>
                {b.firmware_support.map((f) => (
                  <tr key={f.firmware}>
                    <td style={{ textTransform: "capitalize" }}>{f.firmware}</td>
                    <td>
                      <span className={`maturity maturity-${f.maturity}`}>
                        {f.maturity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="References &amp; documentation" wide>
            <ul className="link-list">
              {b.docs_url ? (
                <li className="link-primary">
                  <a href={b.docs_url} target="_blank" rel="noreferrer">
                    Official ArduPilot documentation for {b.slug} ↗
                  </a>
                </li>
              ) : (
                <li className="link-muted">
                  No dedicated ArduPilot wiki page found for this board.{" "}
                  <a href={docsSearch} target="_blank" rel="noreferrer">
                    Try a docs search ↗
                  </a>
                </li>
              )}
              <li>
                <a href={docsCommon} target="_blank" rel="noreferrer">
                  Common autopilots — overview index ↗
                </a>
              </li>
              <li>
                <a
                  href={`https://github.com/ArduPilot/ardupilot/tree/master/libraries/AP_HAL_ChibiOS/hwdef/${b.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  hwdef source on GitHub ↗
                </a>
              </li>
            </ul>
          </Card>
        </section>
      </div>
    </div>
  );
}

function Card({ title, wide, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={"ds-card" + (wide ? " ds-card-wide" : "")}>
      <div className="ds-card-head">
        <span className="ds-card-rule" aria-hidden />
        <span className="ds-card-title">{title}</span>
        <span className="ds-card-rule" aria-hidden />
      </div>
      <div className="ds-card-body">{children}</div>
    </div>
  );
}

function Row({ label, val, hint }: { label: string; val: React.ReactNode; hint?: string }) {
  return (
    <tr>
      <td className="ds-rowlabel">{label}</td>
      <td className="ds-rowval">
        {val}
        {hint && <span className="ds-hint"> // {hint}</span>}
      </td>
    </tr>
  );
}

function SensorList({ kind, items }: { kind: string; items: { chip: string; bus: string }[] }) {
  if (items.length === 0) {
    return <div className="sensor-line empty-line">{kind} · NONE</div>;
  }
  return (
    <div className="sensor-group">
      <div className="sensor-kind">{kind} × {items.length}</div>
      <ul className="sensor-ul">
        {items.map((s, i) => (
          <li key={i}>
            <span className="sensor-chip">{s.chip}</span>
            <span className="sensor-bus"> @ {s.bus}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
