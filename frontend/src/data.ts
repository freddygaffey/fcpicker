import { useEffect, useState } from "react";
import type { Board, BoardsPayload } from "./types";

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
    if (cache) {
      setBoards(cache);
      return;
    }
    load().then(setBoards).catch((e) => setError(String(e)));
  }, []);

  return { boards, error, loading: !boards && !error };
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
