import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { PAYFAST_PROCESS_URLS } from "@/lib/payments";

/**
 * Opened by the iOS / Android app in the system browser (lib/payments.ts):
 * posts the already-signed PayFast form carried in the URL hash. The hash is
 * never sent to the server. Only PayFast's process URL is accepted.
 */
const PayBridgePage: React.FC = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const [payload] = useState<{ action: string; fields: [string, string][] } | null>(() => {
    try {
      const raw = window.location.hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(escape(atob(raw + "=".repeat((4 - (raw.length % 4)) % 4))));
      const data = JSON.parse(json);
      if (!PAYFAST_PROCESS_URLS.includes(data?.action) || !Array.isArray(data?.fields)) return null;
      return { action: data.action, fields: data.fields.map(([k, v]: [string, unknown]) => [String(k), String(v ?? "")]) };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (payload) formRef.current?.submit();
  }, [payload]);

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-muted-foreground">This payment link is invalid or has expired. Please start the payment again in the 1145 app.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Taking you to PayFast…</p>
      <form ref={formRef} method="POST" action={payload.action}>
        {payload.fields.map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <noscript>
          <button type="submit">Continue to PayFast</button>
        </noscript>
      </form>
    </div>
  );
};

export default PayBridgePage;
