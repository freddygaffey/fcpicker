import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  CatalogConfig, ChipsFilter, FilterDef, RangeFilter, SearchFilter, ToggleFilter,
} from "./types";

type FilterValues = Record<string, unknown>;

function defaultValue(f: FilterDef<unknown>): unknown {
  switch (f.kind) {
    case "search": return "";
    case "chips":  return [] as string[];
    case "range":  return 0;
    case "toggle": return false;
  }
}

function passes<T>(item: T, filters: FilterDef<T>[], values: FilterValues): boolean {
  for (const f of filters) {
    const v = values[f.id];
    switch (f.kind) {
      case "search": {
        const q = (v as string).trim();
        if (q && !f.match(item, q)) return false;
        break;
      }
      case "chips": {
        const sel = v as string[];
        if (sel.length && !f.match(item, sel)) return false;
        break;
      }
      case "range": {
        const n = v as number;
        if (n > f.min && !f.match(item, n)) return false;
        break;
      }
      case "toggle": {
        if ((v as boolean) && !f.match(item, true)) return false;
        break;
      }
    }
  }
  return true;
}

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadCsv<T>(rows: T[], cfg: NonNullable<CatalogConfig<T>["csv"]>): void {
  const lines = [cfg.columns.map((c) => c.label).join(",")];
  for (const r of rows) {
    lines.push(cfg.columns.map((c) => csvEscape(c.get(r))).join(","));
  }
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = cfg.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Props<T> {
  config: CatalogConfig<T>;
}

export function CatalogPage<T>({ config }: Props<T>) {
  const { items, loading, error } = config.useData();

  const [values, setValues] = useState<FilterValues>(() => {
    const v: FilterValues = {};
    for (const f of config.filters) v[f.id] = defaultValue(f as FilterDef<unknown>);
    return v;
  });
  const setValue = (id: string, v: unknown) => setValues((p) => ({ ...p, [id]: v }));
  const reset = () => {
    const v: FilterValues = {};
    for (const f of config.filters) v[f.id] = defaultValue(f as FilterDef<unknown>);
    setValues(v);
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    const out = items.filter((it) => passes(it, config.filters, values));
    if (config.sortBy) out.sort(config.sortBy);
    return out;
  }, [items, values, config]);

  const siblingIds = useMemo(() => filtered.map(config.getId), [filtered, config]);

  return (
    <>
      <aside className="sidebar">
        {config.experimentalNote && (
          <div className="sidebar-block">
            <div className="experimental-banner">
              <strong>Experimental.</strong> {config.experimentalNote}
            </div>
          </div>
        )}

        {config.filters.map((f) => (
          <FilterControl
            key={f.id}
            filter={f}
            value={values[f.id]}
            onChange={(v) => setValue(f.id, v)}
            items={items ?? []}
          />
        ))}

        <button className="reset" onClick={reset}>Reset filters</button>
      </aside>

      <section className="results">
        <div className="results-head">
          <div>
            <h1 className="results-title">{config.title}</h1>
            {config.subtitle && (
              <p className="results-sub">
                {config.subtitle(filtered.length, items?.length ?? 0)}
              </p>
            )}
          </div>
          <div className="results-actions">
            {config.csv && (
              <button
                type="button"
                className="btn-csv"
                onClick={() => downloadCsv(filtered, config.csv!)}
                disabled={filtered.length === 0}
                title="Download current filtered results as CSV"
              >
                ⤓ Download CSV
              </button>
            )}
            {config.legend && (
              <div className="results-legend">
                {config.legend.map((l) => (
                  <span key={l.label}>
                    <i className={`dot dot-${l.color}`} /> {l.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading && <div className="state">Loading catalog…</div>}
        {error && <div className="state state-err">Couldn't load data: {error}</div>}

        {items && (
          <div className="table-wrap">
            <table className="ttable">
              <thead>
                <tr>
                  <th className="th">{config.columns[0]?.label ?? ""}</th>
                  {config.columns.slice(1).map((c) => (
                    <th
                      key={c.id}
                      className={"th" + (c.align === "right" ? " th-right" : c.align === "center" ? " th-center" : "")}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const id = config.getId(it);
                  return (
                    <tr key={id} className="trow">
                      <td className="td-name">
                        <Link
                          to={config.detailUrl(it)}
                          state={{ siblings: siblingIds }}
                          className="row-link"
                        >
                          <span className="row-bracket">[</span>
                          {config.primaryLabel(it)}
                          <span className="row-bracket">]</span>
                        </Link>
                      </td>
                      {config.columns.slice(1).map((c) => (
                        <td
                          key={c.id}
                          style={c.align === "right" ? { textAlign: "right" } : undefined}
                        >
                          {c.cell(it)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {filtered.length === 0 && items.length > 0 && (
                  <tr>
                    <td colSpan={config.columns.length} className="empty">
                      — NO ITEMS MATCH CURRENT PARAMETERS —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

interface ControlProps<T> {
  filter: FilterDef<T>;
  value: unknown;
  onChange: (v: unknown) => void;
  items: T[];
}

function FilterControl<T>({ filter, value, onChange, items }: ControlProps<T>): ReactNode {
  switch (filter.kind) {
    case "search":  return <SearchControl  f={filter} v={value as string}   set={onChange as (v: string) => void} />;
    case "chips":   return <ChipsControl   f={filter} v={value as string[]} set={onChange as (v: string[]) => void} items={items} />;
    case "range":   return <RangeControl   f={filter} v={value as number}   set={onChange as (v: number) => void} />;
    case "toggle":  return <ToggleControl  f={filter} v={value as boolean}  set={onChange as (v: boolean) => void} />;
  }
}

function SearchControl<T>({ f, v, set }: { f: SearchFilter<T>; v: string; set: (v: string) => void }) {
  return (
    <div className="sidebar-block">
      <h3 className="block-title">{f.label}</h3>
      <input
        type="text"
        className="input-text"
        placeholder={f.placeholder}
        value={v}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  );
}

function ChipsControl<T>({ f, v, set, items }:
  { f: ChipsFilter<T, string>; v: string[]; set: (v: string[]) => void; items: T[] }) {
  const opts = typeof f.options === "function" ? f.options(items) : f.options;
  const toggle = (id: string) => set(v.includes(id) ? v.filter((x) => x !== id) : [...v, id]);
  return (
    <div className="sidebar-block">
      <h3 className="block-title">{f.label}</h3>
      <div className="chip-row">
        {opts.map((o) => (
          <button
            key={o.id}
            className={"chip " + (v.includes(o.id) ? "chip-on" : "")}
            onClick={() => toggle(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeControl<T>({ f, v, set }: { f: RangeFilter<T>; v: number; set: (v: number) => void }) {
  return (
    <div className="sidebar-block">
      <h3 className="block-title">{f.label}</h3>
      <input
        type="range"
        min={f.min}
        max={f.max}
        step={f.step ?? 1}
        value={v}
        onChange={(e) => set(Number(e.target.value))}
        className="range"
      />
      <div className="range-readout">
        <span>{v}{f.unit ? ` ${f.unit}` : ""}</span>
        <span className="range-max">up to {f.max}</span>
      </div>
    </div>
  );
}

function ToggleControl<T>({ f, v, set }: { f: ToggleFilter<T>; v: boolean; set: (v: boolean) => void }) {
  return (
    <div className="sidebar-block">
      <label className="toggle">
        <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} />
        <span className="toggle-mark" aria-hidden />
        <span className="toggle-label">{f.label}</span>
      </label>
    </div>
  );
}
