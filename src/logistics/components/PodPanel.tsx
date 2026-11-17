import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, MapPin, Package, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "../lib/db";

interface Pod {
  available: boolean;
  delivered_at?: string;
  method?: string;
  received_by?: string | null;
  otp_verified?: boolean;
  photo_path?: string | null;
  signature_path?: string | null;
  pieces_scanned?: number | null;
  pieces_total?: number | null;
  counted_by_hand?: boolean;
  lat?: number | null;
  lng?: number | null;
  collection_point?: string | null;
  redacted?: boolean;
}

const METHOD: Record<string, string> = {
  otp: "One-time code",
  photo: "Photo",
  signature: "Signature",
  name: "Name recorded",
  collection_point: "Collected at pickup point",
};

/** Proof of delivery: who, when, how, where, plus photo/signature (signed, 10 min). */
const PodPanel: React.FC<{ shipmentId: string }> = ({ shipmentId }) => {
  const { data: pod } = useQuery({
    queryKey: ["pod", shipmentId],
    queryFn: async () => {
      const { data, error } = await db.rpc("logistics_pod", { p_shipment_id: shipmentId });
      if (error) throw error;
      return data as Pod;
    },
  });
  const { data: urls } = useQuery({
    queryKey: ["pod-files", shipmentId, pod?.photo_path, pod?.signature_path],
    enabled: !!pod?.available && !!(pod.photo_path || pod.signature_path),
    queryFn: async () => {
      const sign = async (path?: string | null) =>
        path ? (await supabase.storage.from("delivery-proofs").createSignedUrl(path, 600)).data?.signedUrl ?? null : null;
      return { photo: await sign(pod!.photo_path), signature: await sign(pod!.signature_path) };
    },
    staleTime: 8 * 60_000,
  });

  if (!pod?.available) return null;

  return (
    <section className="rounded-lg border p-3 space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Proof of delivery
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">When</dt>
        <dd>{pod.delivered_at ? format(new Date(pod.delivered_at), "EEE d MMM yyyy, HH:mm") : "—"}</dd>
        <dt className="text-muted-foreground">Received by</dt>
        <dd>{pod.received_by ?? (pod.redacted ? "Removed (retention)" : "—")}</dd>
        <dt className="text-muted-foreground">Method</dt>
        <dd className="flex items-center gap-1">
          {METHOD[pod.method ?? "name"] ?? pod.method}
          {pod.otp_verified && pod.method !== "collection_point" && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="Code verified" />}
        </dd>
        {pod.collection_point && (
          <>
            <dt className="text-muted-foreground">Point</dt>
            <dd>{pod.collection_point}</dd>
          </>
        )}
        {pod.pieces_total ? (
          <>
            <dt className="text-muted-foreground">Boxes</dt>
            <dd className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              {pod.pieces_scanned != null ? `${pod.pieces_scanned}/${pod.pieces_total} scanned` : `${pod.pieces_total}`}
              {pod.counted_by_hand && <span className="text-xs text-amber-700"> · counted by hand</span>}
            </dd>
          </>
        ) : null}
        {pod.lat != null && pod.lng != null && (
          <>
            <dt className="text-muted-foreground">Location</dt>
            <dd>
              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`https://www.google.com/maps?q=${pod.lat},${pod.lng}`} target="_blank" rel="noopener noreferrer">
                <MapPin className="h-3.5 w-3.5" /> GPS at handover
              </a>
            </dd>
          </>
        )}
      </dl>
      {(urls?.photo || urls?.signature) && (
        <div className="flex gap-2 pt-1">
          {urls.photo && (
            <a href={urls.photo} target="_blank" rel="noopener noreferrer">
              <img src={urls.photo} alt="Delivery photo" className="h-24 w-24 rounded-md border object-cover" />
            </a>
          )}
          {urls.signature && (
            <a href={urls.signature} target="_blank" rel="noopener noreferrer">
              <img src={urls.signature} alt="Recipient signature" className="h-24 w-40 rounded-md border bg-white object-contain" />
            </a>
          )}
        </div>
      )}
    </section>
  );
};

export default PodPanel;
