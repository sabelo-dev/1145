import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Upload, Download, Wand2, Loader2, CheckCircle2 } from "lucide-react";
import { jsPDF } from "jspdf";

const BUCKET = "lease-agreements";

interface LeaseContract {
  id: string;
  contract_number: string;
  user_id: string;
  asset_id: string;
  monthly_payment: number;
  security_deposit: number | null;
  start_date: string;
  end_date: string;
  is_lease_to_own?: boolean | null;
  contract_document_url?: string | null;
  e_signature_url?: string | null;
  signed_at?: string | null;
}

interface Props {
  contract: LeaseContract;
  /** "owner" = asset provider/vendor, "lessee" = consumer */
  role: "owner" | "lessee";
  onChanged?: () => void;
}

const fileFromPath = (url?: string | null) => {
  if (!url) return null;
  try {
    // Storage path is `<bucket>/<contract_id>/<folder>/<file>`; we stored full URL
    const parts = url.split(`/${BUCKET}/`);
    return parts[1] || null;
  } catch {
    return null;
  }
};

const openSigned = async (path: string, download = false) => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 10, download ? { download: true } : undefined);
  if (error || !data?.signedUrl) throw error ?? new Error("Failed to sign URL");
  window.open(data.signedUrl, "_blank", "noopener");
};

const LeaseAgreementManager: React.FC<Props> = ({ contract, role, onChanged }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"upload" | "sign" | "generate" | null>(null);
  const [assetTitle, setAssetTitle] = useState<string>("");
  const [lesseeName, setLesseeName] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [asset, profile] = await Promise.all([
        supabase.from("leaseable_assets").select("title").eq("id", contract.asset_id).maybeSingle(),
        supabase.from("profiles").select("name, email").eq("id", contract.user_id).maybeSingle(),
      ]);
      setAssetTitle(asset.data?.title || "Leased asset");
      setLesseeName(profile.data?.name || profile.data?.email || "Lessee");
    })();
  }, [open, contract.asset_id, contract.user_id]);

  const ownerPath = fileFromPath(contract.contract_document_url);
  const signedPath = fileFromPath(contract.e_signature_url);

  const persistUrl = async (field: "contract_document_url" | "e_signature_url", url: string) => {
    const patch: { contract_document_url?: string; e_signature_url?: string; signed_at?: string } = {};
    patch[field] = url;
    if (field === "e_signature_url") patch.signed_at = new Date().toISOString();
    const { error } = await supabase.from("lease_contracts").update(patch).eq("id", contract.id);
    if (error) throw error;
  };


  const uploadFile = async (file: File, kind: "agreement" | "signed") => {
    if (file.type !== "application/pdf") {
      toast({ variant: "destructive", title: "PDF only", description: "Please upload a PDF file." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Max 10 MB." });
      return;
    }
    setBusy(kind === "agreement" ? "upload" : "sign");
    try {
      const path = `${contract.id}/${kind}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: "application/pdf", upsert: false,
      });
      if (error) throw error;
      const url = `${BUCKET}/${path}`;
      await persistUrl(kind === "agreement" ? "contract_document_url" : "e_signature_url", url);
      toast({ title: kind === "agreement" ? "Agreement uploaded" : "Signed copy uploaded" });
      onChanged?.();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setBusy(null);
    }
  };

  const generateAgreement = async () => {
    setBusy("generate");
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const marginX = 48;
      let y = 60;
      const line = (text: string, size = 11, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, 500);
        doc.text(lines, marginX, y);
        y += lines.length * (size + 4);
      };

      line("LEASE AGREEMENT", 18, true);
      y += 8;
      line(`Contract Number: ${contract.contract_number}`, 11, true);
      line(`Date: ${new Date().toLocaleDateString()}`);
      y += 8;

      line("1. Parties", 13, true);
      line(`Lessor (Asset Owner): the party listing "${assetTitle}" on the 1145 Lifestyle platform.`);
      line(`Lessee: ${lesseeName}.`);
      y += 4;

      line("2. Asset", 13, true);
      line(`The Lessor leases the following asset to the Lessee: ${assetTitle}.`);
      y += 4;

      line("3. Term", 13, true);
      line(`Start Date: ${new Date(contract.start_date).toLocaleDateString()}`);
      line(`End Date: ${new Date(contract.end_date).toLocaleDateString()}`);
      if (contract.is_lease_to_own) line("Structure: Lease-to-own — ownership transfers on completion of all payments.");
      y += 4;

      line("4. Payments", 13, true);
      line(`Monthly Payment: R ${Number(contract.monthly_payment).toLocaleString()}`);
      if (contract.security_deposit) line(`Security Deposit: R ${Number(contract.security_deposit).toLocaleString()}`);
      y += 4;

      line("5. Responsibilities", 13, true);
      line("The Lessee shall use the asset with reasonable care and return it in the condition received, fair wear and tear excepted. The Lessee shall not sub-lease, sell, or transfer the asset without written consent from the Lessor.");
      y += 4;

      line("6. Default", 13, true);
      line("Failure to pay any amount when due for more than 7 days constitutes default. The Lessor may terminate this agreement, recover the asset, and retain the security deposit toward outstanding amounts.");
      y += 4;

      line("7. Governing Law", 13, true);
      line("This agreement is governed by the laws of the Republic of South Africa.");
      y += 24;

      line("Signatures", 13, true);
      line("Lessor: ______________________________   Date: ______________");
      y += 4;
      line("Lessee: ______________________________   Date: ______________");

      const blob = doc.output("blob");
      const file = new File([blob], `${contract.contract_number}-agreement.pdf`, { type: "application/pdf" });
      await uploadFile(file, "agreement");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Generation failed", description: err.message });
      setBusy(null);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4 mr-1.5" /> Agreement
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lease Agreement — {contract.contract_number}</DialogTitle>
            <DialogDescription>
              {role === "owner"
                ? "Generate or upload the lease agreement, then share it with the lessee for signature."
                : "Download the lease agreement, sign it, then upload the signed copy."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Owner-side: agreement */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Lease Agreement (unsigned)</p>
                  <p className="text-xs text-muted-foreground">
                    {ownerPath ? "Uploaded — available for the lessee." : "Not yet uploaded."}
                  </p>
                </div>
                {ownerPath && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              </div>

              <div className="flex flex-wrap gap-2">
                {ownerPath && (
                  <Button size="sm" variant="secondary" className="rounded-lg" onClick={() => openSigned(ownerPath, true).catch(e => toast({ variant: "destructive", title: "Download failed", description: e.message }))}>
                    <Download className="h-4 w-4 mr-1.5" /> Download
                  </Button>
                )}
                {role === "owner" && (
                  <>
                    <Button size="sm" variant="outline" className="rounded-lg" disabled={busy !== null} onClick={generateAgreement}>
                      {busy === "generate" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
                      Generate PDF
                    </Button>
                    <label className="inline-flex">
                      <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "agreement")} />
                      <Button asChild size="sm" variant="outline" className="rounded-lg" disabled={busy !== null}>
                        <span>{busy === "upload" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />} Upload PDF</span>
                      </Button>
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Lessee-side: signed copy */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Signed Agreement</p>
                  <p className="text-xs text-muted-foreground">
                    {signedPath
                      ? `Signed on ${contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : "—"}.`
                      : "Not yet signed by lessee."}
                  </p>
                </div>
                {signedPath && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              </div>

              <div className="flex flex-wrap gap-2">
                {signedPath && (
                  <Button size="sm" variant="secondary" className="rounded-lg" onClick={() => openSigned(signedPath, true).catch(e => toast({ variant: "destructive", title: "Download failed", description: e.message }))}>
                    <Download className="h-4 w-4 mr-1.5" /> Download signed
                  </Button>
                )}
                {role === "lessee" && (
                  <label className="inline-flex">
                    <input type="file" accept="application/pdf" hidden disabled={!ownerPath} onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "signed")} />
                    <Button asChild size="sm" className="rounded-lg" disabled={busy !== null || !ownerPath}>
                      <span>{busy === "sign" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />} Upload signed PDF</span>
                    </Button>
                  </label>
                )}
              </div>
              {role === "lessee" && !ownerPath && (
                <p className="text-xs text-muted-foreground">Waiting for the asset owner to upload the agreement.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LeaseAgreementManager;
