import { CatalogPage } from "../catalog/CatalogPage";
import type { CatalogConfig } from "../catalog/types";
import { useRangefinders } from "../data";
import type { Rangefinder } from "../types";

function rangeMax(r: Rangefinder): number | null {
  return r.manual?.range_max_m_override ?? r.wiki_range_max_m;
}
function rangeMin(r: Rangefinder): number | null {
  return r.manual?.range_min_m_override ?? r.wiki_range_min_m;
}
function weight(r: Rangefinder): number | null {
  return r.manual?.weight_g_override ?? r.wiki_weight_g;
}
function fov(r: Rangefinder): number | null {
  return r.manual?.fov_deg_override ?? r.wiki_fov_deg;
}

const config: CatalogConfig<Rangefinder> = {
  title: "Rangefinders & proximity sensors",
  subtitle: (matched, total) => (
    <>
      <strong>{matched}</strong> of {total} devices parsed from ArduPilot's
      AP_RangeFinder + AP_Proximity libraries.
    </>
  ),
  experimentalNote:
    "Catalog is in testing — specs are best-effort scrapes from the ArduPilot wiki and the source code so it may be wrong.",
  useData: () => {
    const { rangefinders, loading, error } = useRangefinders();
    return { items: rangefinders, loading, error };
  },
  getId: (r) => `${r.kind}-${r.slug}`,
  detailUrl: (r) => `/rangefinder/${r.kind}-${r.slug}`,
  primaryLabel: (r) => r.display_name,
  sortBy: (a, b) => a.display_name.localeCompare(b.display_name),
  legend: [
    { color: "green", label: "Rangefinder" },
    { color: "blue",  label: "Proximity" },
  ],
  filters: [
    {
      kind: "search",
      id: "query",
      label: "Search",
      placeholder: "Benewake, lidar, TFmini…",
      match: (r, q) => {
        const s = q.toLowerCase();
        return r.display_name.toLowerCase().includes(s) || r.slug.toLowerCase().includes(s);
      },
    },
    {
      kind: "chips",
      id: "directionality",
      label: "Class",
      // ArduPilot's own terminology — see common-rangefinder-landingpage and
      // common-proximity-landingpage in the wiki.
      options: [
        { id: "unidirectional",  label: "Rangefinder" },
        { id: "omnidirectional", label: "Proximity sensor" },
      ],
      match: (r, sel) => sel.includes(r.directionality),
    },
    {
      kind: "chips",
      id: "tech",
      label: "Technology",
      options: [
        { id: "lidar",      label: "Lidar" },
        { id: "tof",        label: "ToF" },
        { id: "radar",      label: "Radar" },
        { id: "ultrasonic", label: "Ultrasonic" },
        { id: "sonar",      label: "Sonar" },
      ],
      match: (r, sel) => !!r.tech && sel.includes(r.tech),
    },
    {
      kind: "chips",
      id: "bus",
      label: "Bus",
      options: [
        { id: "serial", label: "serial" },
        { id: "i2c",    label: "i2c" },
        { id: "can",    label: "can" },
        { id: "gpio",   label: "gpio" },
        { id: "platform", label: "platform" },
      ],
      match: (r, sel) => !!r.bus && sel.includes(r.bus),
    },
    {
      kind: "range",
      id: "minRange",
      label: "Minimum range",
      min: 0, max: 500, step: 5, unit: "m",
      match: (r, n) => {
        const max = rangeMax(r);
        return max != null && max >= n;
      },
    },
  ],
  columns: [
    { id: "device", label: "DEVICE", cell: (r) => r.display_name },
    {
      id: "class",  label: "CLASS",
      cell: (r) => (
        <>
          <i className={"dot " + (r.directionality === "omnidirectional" ? "dot-blue" : "dot-green")} />
          {" "}
          {r.directionality === "omnidirectional" ? "Proximity" : "Rangefinder"}
        </>
      ),
    },
    { id: "tech",      label: "TECH", cell: (r) => r.tech ?? "—" },
    { id: "bus",       label: "BUS",  cell: (r) => r.bus ?? "—" },
    { id: "range",     label: "MAX RANGE", align: "right",
      cell: (r) => { const v = rangeMax(r); return v != null ? `${v} m` : "—"; } },
    { id: "weight",    label: "WEIGHT", align: "right",
      cell: (r) => { const v = weight(r); return v != null ? `${v} g` : "—"; } },
    { id: "fov",       label: "FOV", align: "right",
      cell: (r) => { const v = fov(r); return v != null ? `${v}°` : "—"; } },
    { id: "typeId",    label: "TYPE ID", align: "right",
      cell: (r) => r.type_ids.map((t) => t.param_value).join(", ") || "—" },
  ],
  csv: {
    filename: "rangefinders.csv",
    columns: [
      { label: "Device",         get: (r) => r.display_name },
      { label: "Class",          get: (r) => r.directionality === "omnidirectional" ? "Proximity" : "Rangefinder" },
      { label: "Tech",           get: (r) => r.tech },
      { label: "Bus",            get: (r) => r.bus },
      { label: "Max range (m)",  get: (r) => rangeMax(r) },
      { label: "Min range (m)",  get: (r) => rangeMin(r) },
      { label: "Weight (g)",     get: (r) => weight(r) },
      { label: "FOV (deg)",      get: (r) => fov(r) },
      { label: "Type IDs",       get: (r) => r.type_ids.map((t) => t.param_value).join(";") },
      { label: "Driver class",   get: (r) => r.class_name },
      { label: "Docs URL",       get: (r) => r.docs_url },
    ],
  },
};

export default function Rangefinders() {
  return <CatalogPage config={config} />;
}
