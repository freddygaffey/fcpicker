import { useEffect, useState } from "react";
import type { Board, BoardsPayload, Rangefinder, RangefindersPayload } from "./types";

let cache: Board[] | null = null;
let inflight: Promise<Board[]> | null = null;

function load(): Promise<Board[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch("/boards.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<BoardsPayload>;
    })
    .then((p) => {
      cache = p.boards;
      return cache;
    });
  return inflight;
}

export function useBoards() {
  const [boards, setBoards] = useState<Board[] | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    load().then(setBoards).catch((e) => setError(String(e)));
  }, []);

  return { boards, error, loading: !boards && !error };
}

type HwdefImagesPayload = {
  base_url: string;
  boards: { slug: string; is_autopilot: boolean; images: string[] }[];
};

export type BoardImages = { baseUrl: string; images: string[] };

let imagesCache: HwdefImagesPayload | null = null;
let imagesInflight: Promise<HwdefImagesPayload> | null = null;

function loadImages(): Promise<HwdefImagesPayload> {
  if (imagesCache) return Promise.resolve(imagesCache);
  if (imagesInflight) return imagesInflight;
  imagesInflight = fetch("/hwdef-images.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<HwdefImagesPayload>;
    })
    .then((p) => {
      imagesCache = p;
      return p;
    });
  return imagesInflight;
}

export function useBoardImages(slug: string): BoardImages | null {
  const [state, setState] = useState<BoardImages | null>(() => lookupImages(slug, imagesCache));

  useEffect(() => {
    let cancelled = false;
    loadImages()
      .then((p) => {
        if (!cancelled) setState(lookupImages(slug, p));
      })
      .catch(() => {
        if (!cancelled) setState({ baseUrl: "", images: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}

function lookupImages(slug: string, p: HwdefImagesPayload | null): BoardImages | null {
  if (!p) return null;
  const entry = p.boards.find((b) => b.slug === slug);
  return { baseUrl: p.base_url, images: entry?.images ?? [] };
}

let rfCache: Rangefinder[] | null = null;
let rfInflight: Promise<Rangefinder[]> | null = null;

function loadRangefinders(): Promise<Rangefinder[]> {
  if (rfCache) return Promise.resolve(rfCache);
  if (rfInflight) return rfInflight;
  rfInflight = fetch("/rangefinders.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<RangefindersPayload>;
    })
    .then((p) => {
      rfCache = p.rangefinders;
      return rfCache;
    });
  return rfInflight;
}

export function useRangefinders() {
  const [items, setItems] = useState<Rangefinder[] | null>(rfCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rfCache) return;
    loadRangefinders().then(setItems).catch((e) => setError(String(e)));
  }, []);

  return { rangefinders: items, error, loading: !items && !error };
}

export function mcuFamilyLabel(family: string | null): string {
  if (!family) return "Unknown";
  if (family.startsWith("STM32H7")) return "STM32 H7";
  if (family.startsWith("STM32F7")) return "STM32 F7";
  if (family.startsWith("STM32F4")) return "STM32 F4";
  if (family.startsWith("STM32G4")) return "STM32 G4";
  if (family.startsWith("STM32L4")) return "STM32 L4";
  return family;
}
