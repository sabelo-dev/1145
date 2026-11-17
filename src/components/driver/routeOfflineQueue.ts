/**
 * Offline queue for route-run actions. When the driver loses signal, stop
 * updates are stored locally (with the time they really happened) and replayed
 * in order once the connection is back. The server validates every replayed
 * action exactly as if it were live (ownership, OTP, stop state).
 */
import { db } from "@/logistics/lib/db";

const KEY = "1145-route-offline-queue";

export interface QueuedStopAction {
  id: string;
  stopId: string;
  routeId: string;
  sequence: number;
  action: "arrive" | "complete" | "fail" | "skip";
  params: Record<string, unknown>;
  queuedAt: string;
}

export function readQueue(): QueuedStopAction[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedStopAction[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full or unavailable: nothing else we can do offline */
  }
}

export function enqueue(item: Omit<QueuedStopAction, "id" | "queuedAt">): QueuedStopAction {
  const full: QueuedStopAction = { ...item, id: crypto.randomUUID(), queuedAt: new Date().toISOString() };
  writeQueue([...readQueue(), full]);
  return full;
}

export function isNetworkError(err: { message?: string } | null | undefined): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request failed") || m.includes("load failed");
}

export interface FlushResult {
  synced: number;
  rejected: Array<{ item: QueuedStopAction; reason: string }>;
  remaining: number;
}

let flushing: Promise<FlushResult> | null = null;

/** Replay queued actions in order. Stops at the first network failure. */
export function flushQueue(): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { synced: 0, rejected: [], remaining: 0 };
    let items = readQueue();
    while (items.length) {
      const [item, ...rest] = items;
      const { data, error } = await db.rpc("driver_update_stop", item.params);
      if (error && isNetworkError(error)) break;
      const res = data as { ok?: boolean; error?: string } | null;
      if (error) result.rejected.push({ item, reason: error.message });
      else if (!res?.ok) result.rejected.push({ item, reason: res?.error ?? "rejected" });
      else result.synced++;
      items = rest;
      writeQueue(items);
    }
    result.remaining = items.length;
    return result;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
