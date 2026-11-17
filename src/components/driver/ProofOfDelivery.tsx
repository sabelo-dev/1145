import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Camera,
  KeyRound,
  PenTool,
  CheckCircle,
  Package,
  MapPin,
  Clock,
  Upload,
  X,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProofOfDeliveryProps {
  job: {
    id: string;
    order_id: string | null;
    delivery_address: any;
    earnings: number | null;
  };
  onDelivered: () => void;
}

type ProofType = "photo" | "otp" | "signature";

const ProofOfDelivery: React.FC<ProofOfDeliveryProps> = ({ job, onDelivered }) => {
  const [selectedProof, setSelectedProof] = useState<ProofType>("photo");
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const { toast } = useToast();

  // What the server requires for this job (OTP lives on the linked shipment,
  // which drivers can't read directly — it is verified server-side).
  const [requirements, setRequirements] = useState<{ require_otp: boolean; otp_available: boolean } | null>(null);
  useEffect(() => {
    if (!dialogOpen) return;
    supabase.rpc("driver_job_requirements" as never, { p_job_id: job.id } as never).then(({ data }) => {
      const r = data as { require_otp: boolean; otp_available: boolean } | null;
      setRequirements(r ?? { require_otp: false, otp_available: false });
      if (r?.require_otp) setSelectedProof("otp");
    });
  }, [dialogOpen, job.id]);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOtpVerification = async () => {
    if (!/^\d{4}$/.test(otp)) {
      toast({ variant: "destructive", title: "Enter the 4-digit code", description: "Ask the recipient for the code in their SMS." });
      return;
    }
    await completeDelivery("otp");
  };

  const handleSignatureSubmit = async () => {
    if (!signature) {
      toast({
        variant: "destructive",
        title: "Signature Required",
        description: "Please capture the customer's signature.",
      });
      return;
    }
    await completeDelivery("signature");
  };

  const handlePhotoSubmit = async () => {
    if (!photo) {
      toast({
        variant: "destructive",
        title: "Photo Required",
        description: "Please take a photo of the delivered package.",
      });
      return;
    }
    await completeDelivery("photo");
  };

  // Upload a captured data URL (photo or signature) to the private proofs bucket.
  const uploadProof = async (dataUrl: string, kind: "photo" | "signature"): Promise<string> => {
    const { data: auth } = await supabase.auth.getUser();
    const blob = await (await fetch(dataUrl)).blob();
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${auth.user?.id}/jobs/${job.id}-${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("delivery-proofs").upload(path, blob, { contentType: blob.type || "image/jpeg" });
    if (error) throw error;
    return path;
  };

  const completeDelivery = async (proofType: ProofType) => {
    setIsSubmitting(true);

    try {
      const proof: Record<string, string> = {};
      if (proofType === "photo" && photo) proof.photo_path = await uploadProof(photo, "photo");
      if (proofType === "signature" && signature) proof.signature_path = await uploadProof(signature, "signature");

      // Server checks the driver owns the job and, for OTP, that the code matches.
      const { data: result, error } = await supabase.rpc("driver_complete_job" as never, {
        p_job_id: job.id,
        p_method: proofType,
        p_otp: proofType === "otp" ? otp : null,
        p_proof: proof,
      } as never);

      if (error) {
        const msg = error.message || "";
        if (msg.includes("invalid_otp")) throw new Error("That code doesn't match. Ask the recipient to check their SMS.");
        if (msg.includes("otp_required")) throw new Error("This parcel needs the recipient's OTP.");
        if (msg.includes("otp_not_available")) throw new Error("No OTP was issued for this delivery. Use a photo or signature.");
        throw error;
      }
      const res = result as { ok?: boolean; error?: string; attempts_left?: number } | null;
      if (res && res.ok === false) {
        if (res.error === "otp_locked") throw new Error("Too many wrong codes. This parcel is locked, so call dispatch to reset the code.");
        throw new Error(`That code doesn't match. ${res.attempts_left ?? 0} tries left.`);
      }

      toast({
        title: "Delivery Completed!",
        description: `R${job.earnings?.toFixed(2) || "0.00"} has been added to your earnings.`,
      });
      setDialogOpen(false);
      onDelivered();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't complete delivery",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }

    setIsSubmitting(false);
  };

  // Canvas signature handling
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ("touches" in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setSignature(null);
  };

  const formatAddress = (address: any) => {
    if (!address) return "Address not available";
    if (typeof address === "string") return address;
    return `${address.street || ""}, ${address.city || ""}`.trim();
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button className="w-full bg-green-600 hover:bg-green-700">
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete Delivery
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Proof of Delivery
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Delivery Info */}
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{formatAddress(job.delivery_address)}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-green-600">
                  R{job.earnings?.toFixed(2) || "0.00"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Proof Type Selection */}
          {requirements?.require_otp && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
              <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
              This parcel needs the recipient's 4-digit code from their SMS. Photo or signature alone won't complete it.
            </div>
          )}
          <Tabs value={selectedProof} onValueChange={(v) => setSelectedProof(v as ProofType)}>
            <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-3">
              <TabsTrigger value="photo" className="flex gap-1">
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Photo</span>
              </TabsTrigger>
              <TabsTrigger value="otp" className="flex gap-1">
                <KeyRound className="h-4 w-4" />
                <span className="hidden sm:inline">OTP</span>
              </TabsTrigger>
              <TabsTrigger value="signature" className="flex gap-1">
                <PenTool className="h-4 w-4" />
                <span className="hidden sm:inline">Sign</span>
              </TabsTrigger>
            </TabsList>

            {/* Photo Proof */}
            <TabsContent value="photo" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Take a photo showing the delivered package at the customer's location.
              </p>
              
              {photo ? (
                <div className="relative">
                  <img
                    src={photo}
                    alt="Delivery proof"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => setPhoto(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Camera className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground mt-2">
                    Tap to take photo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoCapture}
                  />
                </label>
              )}

              <Button
                className="w-full"
                onClick={handlePhotoSubmit}
                disabled={!photo || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Photo Proof"}
              </Button>
            </TabsContent>

            {/* OTP Proof */}
            <TabsContent value="otp" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ask the customer for their 4-digit delivery OTP.
              </p>

              <div className="space-y-2">
                <Label htmlFor="delivery-otp">Customer OTP</Label>
                <Input
                  id="delivery-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleOtpVerification}
                disabled={otp.length !== 4 || isSubmitting}
              >
                {isSubmitting ? "Verifying..." : "Verify OTP"}
              </Button>
            </TabsContent>

            {/* Signature Proof */}
            <TabsContent value="signature" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Have the customer sign below to confirm delivery.
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Customer Signature</Label>
                  {signature && (
                    <Button variant="ghost" size="sm" onClick={clearSignature}>
                      Clear
                    </Button>
                  )}
                </div>
                <div className="border-2 rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={350}
                    height={150}
                    className="w-full touch-none cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSignatureSubmit}
                disabled={!signature || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Signature"}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Help */}
          <div className="flex items-start gap-2 p-3 bg-gold/10 dark:bg-gold/15 rounded-lg">
            <AlertCircle className="h-4 w-4 text-gold mt-0.5" />
            <p className="text-sm text-gold dark:text-gold">
              Cannot deliver? Contact support for assistance with failed deliveries.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProofOfDelivery;
