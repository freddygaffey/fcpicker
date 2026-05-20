import { Link, useParams } from "react-router-dom";
import { mcuFamilyLabel, useBoardImages, useBoards } from "../data";
import type { SensorEntry } from "../types";

const ALL_VEHICLES = ["copter", "plane", "rover", "sub", "tracker", "blimp"] as const;
const VEHICLE_LABEL: Record<string, string> = {
  copter: "Copter", plane: "Plane", rover: "Rover",
  sub: "Sub", tracker: "Tracker", blimp: "Blimp",
};

export default function BoardDetail() {
  const { slug = "" } = useParams();
  const { boards, loading, error } = useBoards();
  const boardImages = useBoardImages(slug);

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
          <span>Unable to find the documentation link.</span>
        </div>
      )}

      {b.manual?.ardupilot_repo_url && b.manual.ardupilot_repo_url !== b.docs_url && (
        <a
          className="bd-doc-cta"
          href={b.manual.ardupilot_repo_url}
          target="_blank"
          rel="noreferrer"
          style={{ marginTop: 8 }}
        >
          <span className="bd-doc-cta-label">Vendor / ArduPilot repository link</span>
          <span className="bd-doc-cta-arrow">↗</span>
        </a>
      )}

      {/* Board images — admin uploads first, then hwdef images from GitHub */}
      <BoardGallery
        slug={slug}
        adminImages={b.manual?.images ?? []}
        hwdefImages={boardImages}
      />

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
          <Stat label="IMUs" value={imuStatValue(b.imus)} hint={imuStatHint(b.imus)} />
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

      {/* Power output (BEC rails) — only when curated data exists */}
      {b.power.bec.length > 0 && (
        <section className="bd-section">
          <h2 className="bd-h2">Power output</h2>
          <ul className="bd-bec">
            {b.power.bec.map((r, i) => (
              <li key={i} className="bd-bec-item">
                <span className="bd-bec-rail">{r.rail}</span>
                <span className="bd-bec-spec">{r.voltage_v} V · {r.current_a} A</span>
                {r.note && <span className="bd-bec-note">{r.note}</span>}
              </li>
            ))}
          </ul>
          <p className="bd-aside">Hand-curated from vendor docs.</p>
        </section>
      )}

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

function BoardGallery({
  slug, adminImages, hwdefImages,
}: {
  slug: string;
  adminImages: string[];
  hwdefImages: ReturnType<typeof useBoardImages>;
}) {
  type Img = { url: string; caption: string; source: "admin" | "hwdef" };
  const images: Img[] = [];
  // Track basenames already added — first wins (admin uploads win over hwdef).
  const seen = new Set<string>();
  const key = (name: string) => name.split("/").pop()!.toLowerCase();
  for (const f of adminImages) {
    if (seen.has(key(f))) continue;
    seen.add(key(f));
    images.push({
      url: `/board-images/${encodeURIComponent(slug)}/${encodeURIComponent(f)}`,
      caption: f,
      source: "admin",
    });
  }
  if (hwdefImages) {
    for (const img of hwdefImages.images) {
      if (seen.has(key(img))) continue;
      seen.add(key(img));
      images.push({
        url: `${hwdefImages.baseUrl}/${slug}/${img.split("/").map(encodeURIComponent).join("/")}`,
        caption: img,
        source: "hwdef",
      });
    }
  }
  if (images.length === 0) return null;
  return (
    <section className="bd-section">
      <h2 className="bd-h2">Board photos &amp; diagrams</h2>
      <div className="bd-gallery">
        {images.map((it) => (
          <a key={it.source + ":" + it.url} className="bd-gallery-item" href={it.url} target="_blank" rel="noreferrer" title={it.caption}>
            <img src={it.url} alt={it.caption} loading="lazy" />
            <span className="bd-gallery-caption">{it.caption}</span>
          </a>
        ))}
      </div>
      <p className="bd-aside">
        Curated photos plus hwdef pinouts pulled from GitHub.
      </p>
    </section>
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

function SensorRow({ label, items }: { label: string; items: SensorEntry[] }) {
  if (items.length === 0) {
    return (
      <div className="bd-sensor-row">
        <span className="bd-sensor-label">{label}</span>
        <span className="bd-sensor-empty">none</span>
      </div>
    );
  }

  const hasVariants = items.some((s) => s.variant);
  if (!hasVariants) {
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

  // Group sensors by variant. Preserve first-seen order for both variants
  // and the sensors within them. Ungated sensors (variant=null) come first
  // under a "Common" group if both gated and ungated exist on the same kind.
  const groups: { variant: string | null; entries: SensorEntry[] }[] = [];
  for (const s of items) {
    const key = s.variant ?? null;
    let g = groups.find((x) => x.variant === key);
    if (!g) {
      g = { variant: key, entries: [] };
      groups.push(g);
    }
    g.entries.push(s);
  }

  return (
    <div className="bd-sensor-row">
      <span className="bd-sensor-label">{label}</span>
      <div className="bd-sensor-variants">
        <p className="bd-aside">
          This board ships in multiple hardware variants; sensors differ per revision.
        </p>
        {groups.map((g, gi) => (
          <div className="bd-sensor-variant" key={gi}>
            <div className="bd-sensor-variant-label">
              {g.variant ? prettyVariant(g.variant) : "Common to all variants"}
              <span className="bd-sensor-count"> ×{g.entries.length}</span>
            </div>
            <ul className="bd-sensor-list">
              {g.entries.map((s, i) => (
                <li key={i}>
                  <span className="bd-sensor-chip">{s.chip}</span>
                  <span className="bd-sensor-bus"> @ {s.bus}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function imuStatValue(items: SensorEntry[]): string {
  const counts = perVariantCounts(items);
  if (counts.length <= 1) return String(items.length);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  return min === max ? String(min) : `${min}–${max}`;
}

function imuStatHint(items: SensorEntry[]): string | undefined {
  const counts = perVariantCounts(items);
  return counts.length > 1 ? "per hardware variant" : undefined;
}

function perVariantCounts(items: SensorEntry[]): number[] {
  if (!items.some((s) => s.variant)) return [items.length];
  const byVariant = new Map<string, number>();
  let ungated = 0;
  for (const s of items) {
    if (s.variant) byVariant.set(s.variant, (byVariant.get(s.variant) ?? 0) + 1);
    else ungated += 1;
  }
  return [...byVariant.values()].map((n) => n + ungated);
}

function prettyVariant(token: string): string {
  // FMUV6_BOARD_HOLYBRO_6X → Holybro 6X
  // FMUV6_BOARD_HOLYBRO_6X_REV6 → Holybro 6X Rev6
  let s = token.replace(/^FMUV\d+_BOARD_/i, "");
  s = s.replace(/_/g, " ");
  return s.replace(/\b([a-z])([a-z]*)/gi, (_, a: string, rest: string) =>
    a.toUpperCase() + rest.toLowerCase(),
  );
}
