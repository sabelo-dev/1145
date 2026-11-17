import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, ScanLine, XCircle, AlertTriangle, Camera } from "lucide-react";
import BarcodeScanner from "@/components/scanning/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { db, SHIPMENT_STATUS, type Shipment, type ShipmentStatus } from "../lib/db";
import { useHubs } from "../lib/queries";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { PageHeader, ShipmentStatusBadge } from "../components/common";

type Mode = "receive" | "handover" | "returned" | "lookup";

const MODES: Record<Mode, { label: string; help: string }> = {
  receive: { label: "Receive at hub", help: "Marks each parcel as at the selected hub. At its own pickup point it becomes ready to collect and the customer gets an SMS." },
  handover: { label: "Hand over to customer", help: "Scan the parcel, then enter the collection code from the customer's SMS." },
  returned: { label: "Returned to sender", help: "Closes parcels that are on their way back to the sender." },
  lookup: { label: "Look up only", help: "Shows status without changing anything." },
};

interface LogEntry {
  id: number;
  code: string;
  outcome: "ok" | "warn" | "error";
  message: string;
  status?: ShipmentStatus;
  at: Date;
}


/** Short beep so operators can scan without watching the screen. */
function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.3));
    osc.onended = () => ctx.close();
  } catch {
    /* audio unavailable */
  }
}

const ScanPage: React.FC = () => {
  const { can } = useLogisticsAuth();
  const qc = useQueryClient();
  const { data: hubs = [] } = useHubs();
  const [mode, setMode] = useState<Mode>(can("viewer") ? "lookup" : "receive");
  const [hubId, setHubId] = useState<string>(() => {
    try {
      return localStorage.getItem("lx-scan-hub") ?? "";
    } catch {
      return "";
    }
  });
  const [code, setCode] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [working, setWorking] = useState(false);
  const [pendingHandover, setPendingHandover] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [collector, setCollector] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const lastEntry = useRef<LogEntry | null>(null);
  const [camera, setCamera] = useState(false);

  useEffect(() => {
    try {
      if (hubId) localStorage.setItem("lx-scan-hub", hubId);
    } catch {
      /* storage unavailable */
    }
  }, [hubId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, hubId, working]);

  const push = (e: Omit<LogEntry, "id" | "at">) => {
    beep(e.outcome !== "error");
    const entry = { ...e, id: ++seq.current, at: new Date() };
    lastEntry.current = entry;
    setLog((l) => [entry, ...l].slice(0, 200));
  };

  const handle = async (raw: string) => {
    // Labels may encode a URL (…/track/LX…); take the last path segment.
    const value = raw.trim().split("/").pop()!.toUpperCase();
    if (!value) return;
    setWorking(true);
    try {
      if (mode === "receive") {
        if (!hubId) {
          push({ code: value, outcome: "error", message: "Choose a hub first" });
          return;
        }
        const { data: res, error: rpcErr } = await db.rpc("logistics_scan_piece", { p_code: value, p_hub_id: hubId });
        if (rpcErr) throw rpcErr;
        const r = res as { ok: boolean; error?: string; tracking_number?: string; piece_no?: number; pieces?: number; scanned_here?: number; complete?: boolean; status?: ShipmentStatus; recipient?: string; flagged?: boolean };
        if (!r.ok) {
          const msg =
            r.error === "scan_each_piece"
              ? `${r.pieces} pieces: scan each piece label (${r.tracking_number}-1 … -${r.pieces})`
              : r.error === "closed"
                ? `Already ${String(r.status).replace(/_/g, " ")}`
                : "Not found";
          push({ code: value, outcome: r.error === "scan_each_piece" ? "warn" : "error", message: msg, status: r.status });
          return;
        }
        push({
          code: value,
          outcome: r.complete ? (r.flagged ? "warn" : "ok") : "warn",
          message: r.pieces! > 1 ? `${r.recipient} · piece ${r.piece_no}/${r.pieces} · ${r.scanned_here}/${r.pieces} here${r.complete ? " ✓" : ""}` : `${r.recipient}`,
          status: r.status,
        });
        return;
      }

      // Piece labels (LX…-2) identify the shipment too.
      const { data, error } = await db.from("shipments").select("*").eq("tracking_number", value.replace(/-\d+$/, "")).maybeSingle();
      if (error) throw error;
      const s = data as Shipment | null;
      if (!s) {
        push({ code: value, outcome: "error", message: "Not found" });
        return;
      }

      if (mode === "handover") {
        if (s.status !== "ready_for_collection") {
          push({ code: value, outcome: "error", message: `Not ready to collect (${SHIPMENT_STATUS[s.status].label})`, status: s.status });
          return;
        }
        setPendingHandover(s.tracking_number);
        return;
      }

      if (mode === "lookup") {
        push({ code: value, outcome: "ok", message: `${s.recipient_name} · ${SHIPMENT_STATUS[s.status].label}`, status: s.status });
        return;
      }

      if (mode === "returned") {
        if (s.status !== "returning") {
          push({ code: value, outcome: "error", message: `Not marked for return (${SHIPMENT_STATUS[s.status].label})`, status: s.status });
          return;
        }
        const { error: upErr } = await db.from("shipments").update({ status: "returned" }).eq("id", s.id);
        if (upErr) throw upErr;
        push({ code: value, outcome: "ok", message: `Returned to ${s.sender_name}`, status: "returned" });
      }
    } catch (err) {
      push({ code: value, outcome: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setWorking(false);
      setCode("");
      qc.invalidateQueries({ queryKey: ["lx", "shipments"] });
    }
  };

  const release = async () => {
    if (!pendingHandover) return;
    setWorking(true);
    const { data, error } = await db.rpc("pudo_release", { p_tracking_number: pendingHandover, p_otp: otp, p_collector_name: collector || null });
    setWorking(false);
    const res = data as { ok?: boolean; error?: string; attempts_left?: number; recipient?: string; cod_amount?: number } | null;
    if (error || !res?.ok) {
      const msg =
        res?.error === "invalid_otp"
          ? `Wrong code · ${res.attempts_left} tries left`
          : res?.error === "otp_locked"
            ? "Locked after 5 wrong codes. Dispatch must reset it"
            : error?.message ?? res?.error ?? "Failed";
      push({ code: pendingHandover, outcome: "error", message: msg });
      if (res?.error !== "invalid_otp") setPendingHandover(null);
      setOtp("");
      return;
    }
    push({
      code: pendingHandover,
      outcome: "ok",
      message: `Handed to ${collector || res.recipient}${res.cod_amount ? ` · collect R ${Number(res.cod_amount).toFixed(2)} cash` : ""}`,
      status: "delivered",
    });
    setPendingHandover(null);
    setOtp("");
    setCollector("");
    qc.invalidateQueries({ queryKey: ["lx", "shipments"] });
  };

  const ok = log.filter((l) => l.outcome === "ok").length;
  const errors = log.filter((l) => l.outcome === "error").length;
  const canWrite = can("owner", "dispatcher", "hub_operator");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Scan station" description="Use a barcode scanner or type a tracking number and press Enter." />

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODES) as Mode[])
                .filter((m) => canWrite || m === "lookup")
                .map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODES[m].label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {mode === "receive" && (
            <Select value={hubId} onValueChange={setHubId}>
              <SelectTrigger>
                <SelectValue placeholder="Select hub" />
              </SelectTrigger>
              <SelectContent>
                {hubs.filter((h) => h.is_active).map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.code} · {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{MODES[mode].help}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!working) handle(code);
          }}
          className="relative"
        >
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={working || !!pendingHandover}
            autoComplete="off"
            spellCheck={false}
            placeholder="Scan or type LX…"
            className="h-14 pl-11 pr-14 text-lg font-mono uppercase"
          />
          <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setCamera(true)} aria-label="Scan with camera">
            <Camera className="h-5 w-5" />
          </Button>
        </form>
        <BarcodeScanner
          open={camera}
          continuous
          title={MODES[mode].label}
          onClose={() => setCamera(false)}
          onDetect={async (code) => {
            lastEntry.current = null;
            await handle(code);
            const e = lastEntry.current as LogEntry | null;
            if (mode === "handover") setCamera(false);
            return e ? { ok: e.outcome !== "error", message: `${e.code}: ${e.message}` } : undefined;
          }}
        />
        {pendingHandover && (
          <form
            className="rounded-lg border-2 border-primary p-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              release();
            }}
          >
            <p className="text-sm font-medium">
              Handover <span className="font-mono">{pendingHandover}</span>: ask for the code and check ID
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                autoFocus
                inputMode="numeric"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="Code"
                className="w-28 text-center tracking-widest"
              />
              <Input value={collector} onChange={(e) => setCollector(e.target.value)} placeholder="Collected by (name)" className="flex-1 min-w-40" />
              <Button type="submit" disabled={otp.length !== 4 || working}>
                Release
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPendingHandover(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
        <div className="flex items-center gap-4 text-sm">
          <span>
            <span className="font-semibold tabular-nums">{ok}</span> <span className="text-muted-foreground">ok</span>
          </span>
          <span>
            <span className={cn("font-semibold tabular-nums", errors && "text-red-600")}>{errors}</span> <span className="text-muted-foreground">errors</span>
          </span>
          {log.length > 0 && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setLog([])}>
              Clear session
            </Button>
          )}
        </div>
      </div>

      <ul className="mt-4 rounded-xl border bg-card divide-y">
        {log.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Scans will appear here.</li>}
        {log.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
            {l.outcome === "ok" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : l.outcome === "warn" ? (
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <span className="font-mono text-sm">{l.code}</span>
            <span className="text-sm text-muted-foreground truncate flex-1">{l.message}</span>
            {l.status && <ShipmentStatusBadge status={l.status} className="hidden sm:inline-flex" />}
            <span className="text-xs text-muted-foreground tabular-nums">{format(l.at, "HH:mm:ss")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ScanPage;
