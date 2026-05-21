import type { ReactNode } from "react";

/** A filter is just (current-value, item) → boolean, plus a way to render
 *  the control in the sidebar. Each kind manages its own value type. */
export type FilterDef<T> =
  | SearchFilter<T>
  | ChipsFilter<T, string>
  | RangeFilter<T>
  | ToggleFilter<T>;

export interface SearchFilter<T> {
  kind: "search";
  id: string;
  label: string;
  placeholder?: string;
  match: (item: T, q: string) => boolean;
}

export interface ChipsFilter<T, V extends string> {
  kind: "chips";
  id: string;
  label: string;
  /** Either a static option list or a function deriving it from the data. */
  options: { id: V; label: string }[] | ((items: T[]) => { id: V; label: string }[]);
  /** True = OR (any selected matches); false = AND (every selected must match). */
  any?: boolean;
  match: (item: T, selected: V[]) => boolean;
}

export interface RangeFilter<T> {
  kind: "range";
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** If true, the slider value is the *minimum*; only items >= it pass. */
  match: (item: T, value: number) => boolean;
}

export interface ToggleFilter<T> {
  kind: "toggle";
  id: string;
  label: string;
  match: (item: T, on: boolean) => boolean;
}

export interface ColumnDef<T> {
  id: string;
  label: string;
  align?: "right" | "center";
  cell: (item: T) => ReactNode;
}

export interface CsvColumnDef<T> {
  label: string;
  get: (item: T) => string | number | null | undefined;
}

export interface CatalogConfig<T> {
  /** Page heading + browser title. */
  title: string;
  /** Renders the "<n> of <m> match" subtitle. */
  subtitle?: (matched: number, total: number) => ReactNode;
  /** Data source. */
  useData: () => { items: T[] | null; loading: boolean; error: string | null };
  /** Stable per-item ID, used as React key and as the URL slug. */
  getId: (item: T) => string;
  /** Where the row link (and prev/next nav) sends the user. */
  detailUrl: (item: T) => string;
  /** Primary label shown in the leftmost table cell (the link target). */
  primaryLabel: (item: T) => string;
  /** Stable display sort applied after filtering. */
  sortBy?: (a: T, b: T) => number;
  filters: FilterDef<T>[];
  columns: ColumnDef<T>[];
  csv?: { filename: string; columns: CsvColumnDef<T>[] };
  /** Yellow "experimental" banner at the top of the sidebar. */
  experimentalNote?: string;
  /** Optional legend rendered next to the CSV button. */
  legend?: { color: "green" | "blue"; label: string }[];
}
