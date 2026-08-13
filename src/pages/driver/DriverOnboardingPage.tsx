import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Stepper from "@/components/onboarding/Stepper";
import DocumentUpload from "@/components/onboarding/DocumentUpload";
import SelfieCapture from "@/components/onboarding/SelfieCapture";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";

const STEPS = ["Personal", "ID document", "Driver's licence", "Vehicle", "Selfie", "Banking & agreements"];

const SA_BANKS = [
  "ABSA", "Capitec", "First National Bank", "Nedbank", "Standard Bank",
  "African Bank", "TymeBank", "Discovery Bank", "Bank Zero", "Investec",
];

const kycSchema = z.object({
  fullLegalName: z.string().trim().min(3).max(120),
  phone: z.string().trim().min(9).max(20),
  dateOfBirth: z.string().refine((d) => {
    const dob = new Date(d);
    const min = new Date();
    min.setFullYear(min.getFullYear() - 18);
    return dob <= min;
  }, "You must be 18 or older"),
  streetAddress: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(4).max(10),
  idNumber: z.string().trim().min(6).max(20),
  licenseNumber: z.string().trim().min(4).max(20),
  licenseExpiry: z.string().refine((d) => new Date(d) > new Date(), "Licence must not be expired"),
  vehicleType: z.string(),
  vehicleMake: z.string().trim().min(2).max(40),
  vehicleModel: z.string().trim().min(1).max(40),
  vehicleYear: z.string().regex(/^\d{4}$/),
  vehicleColor: z.string().trim().min(3).max(30),
  vehicleRegistration: z.string().trim().min(4).max(20),
  bankName: z.string().min(2),
  bankAccountLast4: z.string().regex(/^\d{4}$/, "Enter the last 4 digits"),
  taxNumber: z.string().optional(),
});

type FormState = z.infer<typeof kycSchema> & {
  idFront?: string;
  idBack?: string;
  licenseFront?: string;
  licenseBack?: string;
  vehiclePhoto?: string;
  vehicleRegDoc?: string;
  vehicleInsurance?: string;
  vehicleRoadworthy?: string;
  selfie?: { path: string; hash: string };
  codeOfConduct: boolean;
  backgroundCheck: boolean;
  ficDeclaration: boolean;
};

const initial: FormState = {
  fullLegalName: "",
  phone: "",
  dateOfBirth: "",
  streetAddress: "",
  city: "",
  province: "",
  postalCode: "",
  idNumber: "",
  licenseNumber: "",
  licenseExpiry: "",
  vehicleType: "car",
  vehicleMake: "",
  vehicleModel: "",
  vehicleYear: "",
  vehicleColor: "",
  vehicleRegistration: "",
  bankName: "",
  bankAccountLast4: "",
  taxNumber: "",
  codeOfConduct: false,
  backgroundCheck: false,
  ficDeclaration: false,
};

const DriverOnboardingPage: React.FC = () => {
  const { user, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [fingerprint, setFingerprint] = useState<string>("");

  useEffect(() => {
    getDeviceFingerprint().then(setFingerprint);
  }, []);

  useEffect(() => {
    if (!user) return;
    // Preload if driver already started
    (async () => {
      const { data } = await supabase
        .from("driver_kyc")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setForm((f) => ({
          ...f,
          fullLegalName: data.full_legal_name || "",
          phone: (user as any).phone || f.phone,
          dateOfBirth: data.date_of_birth || "",
          streetAddress: data.street_address || "",
          city: data.city || "",
          province: data.province || "",
          postalCode: data.postal_code || "",
          idNumber: data.id_number || "",
          licenseNumber: data.license_number || "",
          licenseExpiry: data.license_expiry || "",
          bankName: data.bank_name || "",
          bankAccountLast4: data.bank_account_last4 || "",
          taxNumber: data.tax_number || "",
        }));
      }
    })();
  }, [user]);

  const set = (k: keyof FormState, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const folder = useMemo(() => (user ? `${user.id}` : ""), [user]);

  if (!user) {
    return <div className="p-8">Please log in.</div>;
  }

  const canNext = (): string | null => {
    switch (step) {
      case 0:
        if (!form.fullLegalName || !form.phone || !form.dateOfBirth) return "Fill all required fields.";
        if (!form.streetAddress || !form.city || !form.province || !form.postalCode)
          return "Complete residential address.";
        const dob = new Date(form.dateOfBirth);
        const min = new Date();
        min.setFullYear(min.getFullYear() - 18);
        if (dob > min) return "You must be 18 or older to drive.";
        return null;
      case 1:
        if (!form.idNumber) return "ID number is required.";
        if (!form.idFront) return "Upload the front of your ID.";
        return null;
      case 2:
        if (!form.licenseNumber || !form.licenseExpiry) return "Enter licence details.";
        if (new Date(form.licenseExpiry) <= new Date()) return "Your licence has expired.";
        if (!form.licenseFront || !form.licenseBack) return "Upload both sides of your licence.";
        return null;
      case 3:
        if (!form.vehicleMake || !form.vehicleModel || !form.vehicleYear || !form.vehicleColor || !form.vehicleRegistration)
          return "Complete vehicle details.";
        if (!form.vehiclePhoto) return "Upload a vehicle photo.";
        if (!form.vehicleRegDoc) return "Upload vehicle registration papers.";
        if (!form.vehicleInsurance) return "Upload proof of insurance.";
        return null;
      case 4:
        if (!form.selfie?.path || !form.selfie?.hash) return "Please capture a selfie.";
        return null;
      case 5:
        if (!form.bankName || !form.bankAccountLast4) return "Provide banking details.";
        if (!form.codeOfConduct || !form.backgroundCheck || !form.ficDeclaration)
          return "You must accept all agreements to submit.";
        return null;
    }
    return null;
  };

  const next = () => {
    const err = canNext();
    if (err) {
      toast({ variant: "destructive", title: "Please review", description: err });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    const err = canNext();
    if (err) {
      toast({ variant: "destructive", title: "Please review", description: err });
      return;
    }
    try {
      kycSchema.parse(form);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Validation failed", description: e.errors?.[0]?.message ?? "Check inputs" });
      return;
    }
    setSubmitting(true);
    try {
      // Uniqueness pre-check for id / licence / plate / selfie hash
      const [byId, byLic, byPlate, bySelfie] = await Promise.all([
        supabase.from("driver_kyc").select("user_id").ilike("id_number", form.idNumber).neq("user_id", user.id).maybeSingle(),
        supabase.from("driver_kyc").select("user_id").ilike("license_number", form.licenseNumber).neq("user_id", user.id).maybeSingle(),
        supabase.from("drivers").select("user_id").ilike("vehicle_registration", form.vehicleRegistration).neq("user_id", user.id).maybeSingle(),
        supabase.from("driver_kyc").select("user_id").eq("selfie_hash", form.selfie!.hash).neq("user_id", user.id).maybeSingle(),
      ]);
      if (byId.data || byLic.data || byPlate.data || bySelfie.data) {
        toast({
          variant: "destructive",
          title: "Duplicate detected",
          description:
            "One of your ID number, licence number, plate, or selfie is already linked to another driver account. Contact support if this is an error.",
        });
        setSubmitting(false);
        return;
      }

      // Upsert driver_kyc
      const { error: kycErr } = await supabase.from("driver_kyc").upsert(
        {
          user_id: user.id,
          full_legal_name: form.fullLegalName,
          date_of_birth: form.dateOfBirth,
          id_number: form.idNumber,
          id_document_front_url: form.idFront!,
          id_document_back_url: form.idBack,
          license_number: form.licenseNumber,
          license_expiry: form.licenseExpiry,
          license_front_url: form.licenseFront!,
          license_back_url: form.licenseBack!,
          street_address: form.streetAddress,
          city: form.city,
          province: form.province,
          postal_code: form.postalCode,
          country: "South Africa",
          vehicle_photo_url: form.vehiclePhoto,
          vehicle_registration_doc_url: form.vehicleRegDoc,
          vehicle_insurance_url: form.vehicleInsurance,
          vehicle_roadworthy_url: form.vehicleRoadworthy,
          selfie_url: form.selfie!.path,
          selfie_hash: form.selfie!.hash,
          bank_name: form.bankName,
          bank_account_last4: form.bankAccountLast4,
          tax_number: form.taxNumber,
          background_check_consent: form.backgroundCheck,
          code_of_conduct_accepted: form.codeOfConduct,
          fic_declaration_accepted: form.ficDeclaration,
          device_fingerprint: fingerprint,
          verification_status: "pending",
        },
        { onConflict: "user_id" }
      );
      if (kycErr) throw kycErr;

      // Upsert drivers row
      const { error: drvErr } = await supabase
        .from("drivers")
        .upsert(
          {
            user_id: user.id,
            name: form.fullLegalName,
            phone: form.phone,
            vehicle_type: form.vehicleType,
            license_number: form.licenseNumber,
            vehicle_registration: form.vehicleRegistration,
            vehicle_make: form.vehicleMake,
            vehicle_model: form.vehicleModel,
            vehicle_year: parseInt(form.vehicleYear, 10),
            vehicle_color: form.vehicleColor,
            vehicle_photo_url: form.vehiclePhoto,
            status: "pending",
            onboarding_completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (drvErr) throw drvErr;

      // Ensure driver role
      await supabase.from("user_roles").upsert({ user_id: user.id, role: "driver" }, { onConflict: "user_id,role" });

      await refreshUserProfile();
      toast({
        title: "Application submitted",
        description: "Your driver KYC is under review. We'll notify you within 24–48 hours.",
      });
      navigate("/driver/dashboard", { replace: true });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Submission failed", description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <SEO title="Driver onboarding · 1145" description="Complete KYC to start driving with 1145." />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Driver onboarding</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Anti-fraud checks: ID, licence, selfie, vehicle & background consent.
          </p>
        </div>

        <Stepper steps={STEPS} current={step} />

        <Card>
          <CardHeader>
            <CardTitle>Step {step + 1}: {STEPS[step]}</CardTitle>
            <CardDescription>
              {step === 0 && "Tell us who you are. Use the name and address on your government ID."}
              {step === 1 && "Upload a clear photo of your government-issued ID. Blurry documents are rejected."}
              {step === 2 && "Your driver's licence must be valid for the vehicle class you plan to drive."}
              {step === 3 && "Vehicle details must match your registration papers. Insurance is mandatory."}
              {step === 4 && "A live selfie confirms you match the ID. It's stored encrypted."}
              {step === 5 && "Payout account and mandatory agreements."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Full legal name *</Label>
                  <Input value={form.fullLegalName} onChange={(e) => set("fullLegalName", e.target.value)} />
                </div>
                <div>
                  <Label>Mobile number *</Label>
                  <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+27..." />
                </div>
                <div>
                  <Label>Date of birth *</Label>
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Street address *</Label>
                  <Input value={form.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div>
                  <Label>Province *</Label>
                  <Input value={form.province} onChange={(e) => set("province", e.target.value)} />
                </div>
                <div>
                  <Label>Postal code *</Label>
                  <Input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label>SA ID / passport number *</Label>
                  <Input value={form.idNumber} onChange={(e) => set("idNumber", e.target.value)} />
                </div>
                <DocumentUpload
                  label="ID document — front *"
                  bucket="driver-kyc"
                  folder={`${folder}/id-front`}
                  value={form.idFront}
                  onChange={(v) => set("idFront", v)}
                />
                <DocumentUpload
                  label="ID document — back (optional for passport)"
                  bucket="driver-kyc"
                  folder={`${folder}/id-back`}
                  value={form.idBack}
                  onChange={(v) => set("idBack", v)}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Licence number *</Label>
                    <Input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} />
                  </div>
                  <div>
                    <Label>Licence expiry *</Label>
                    <Input type="date" value={form.licenseExpiry} onChange={(e) => set("licenseExpiry", e.target.value)} />
                  </div>
                </div>
                <DocumentUpload label="Licence — front *" bucket="driver-kyc" folder={`${folder}/lic-front`} value={form.licenseFront} onChange={(v) => set("licenseFront", v)} />
                <DocumentUpload label="Licence — back *" bucket="driver-kyc" folder={`${folder}/lic-back`} value={form.licenseBack} onChange={(v) => set("licenseBack", v)} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Vehicle type *</Label>
                    <Select value={form.vehicleType} onValueChange={(v) => set("vehicleType", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="motorcycle">Motorcycle</SelectItem>
                        <SelectItem value="bicycle">Bicycle</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Registration plate *</Label>
                    <Input value={form.vehicleRegistration} onChange={(e) => set("vehicleRegistration", e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <Label>Make *</Label>
                    <Input value={form.vehicleMake} onChange={(e) => set("vehicleMake", e.target.value)} />
                  </div>
                  <div>
                    <Label>Model *</Label>
                    <Input value={form.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} />
                  </div>
                  <div>
                    <Label>Year *</Label>
                    <Input value={form.vehicleYear} onChange={(e) => set("vehicleYear", e.target.value)} placeholder="2020" />
                  </div>
                  <div>
                    <Label>Colour *</Label>
                    <Input value={form.vehicleColor} onChange={(e) => set("vehicleColor", e.target.value)} />
                  </div>
                </div>
                <DocumentUpload label="Vehicle photo *" bucket="driver-kyc" folder={`${folder}/vehicle`} value={form.vehiclePhoto} onChange={(v) => set("vehiclePhoto", v)} />
                <DocumentUpload label="Vehicle registration papers *" bucket="driver-kyc" folder={`${folder}/vehicle-reg`} value={form.vehicleRegDoc} onChange={(v) => set("vehicleRegDoc", v)} />
                <DocumentUpload label="Insurance certificate *" bucket="driver-kyc" folder={`${folder}/insurance`} value={form.vehicleInsurance} onChange={(v) => set("vehicleInsurance", v)} />
                <DocumentUpload label="Roadworthy certificate (recommended)" bucket="driver-kyc" folder={`${folder}/roadworthy`} value={form.vehicleRoadworthy} onChange={(v) => set("vehicleRoadworthy", v)} />
              </div>
            )}

            {step === 4 && (
              <SelfieCapture
                bucket="driver-kyc"
                folder={`${folder}/selfie`}
                captured={form.selfie}
                onCaptured={(s) => set("selfie", s.path ? s : undefined)}
              />
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Bank *</Label>
                    <Select value={form.bankName} onValueChange={(v) => set("bankName", v)}>
                      <SelectTrigger><SelectValue placeholder="Choose bank" /></SelectTrigger>
                      <SelectContent>
                        {SA_BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Account — last 4 digits *</Label>
                    <Input maxLength={4} value={form.bankAccountLast4} onChange={(e) => set("bankAccountLast4", e.target.value.replace(/\D/g, ""))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Tax number (optional)</Label>
                    <Input value={form.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} />
                  </div>
                </div>

                <div className="rounded-lg border p-4 bg-gold/10 border-gold/10 flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm">
                    Providing false information is fraud and will result in permanent ban plus reporting to authorities.
                    Your submission is logged with device fingerprint and IP for audit.
                  </p>
                </div>

                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={form.codeOfConduct} onCheckedChange={(v) => set("codeOfConduct", v === true)} />
                  <span>I accept the 1145 driver <a className="underline" href="/terms" target="_blank">Code of Conduct</a> and ride-safety rules.</span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={form.backgroundCheck} onCheckedChange={(v) => set("backgroundCheck", v === true)} />
                  <span>I consent to a criminal background check and licence validity check with the relevant authorities.</span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={form.ficDeclaration} onCheckedChange={(v) => set("ficDeclaration", v === true)} />
                  <span>I confirm all information is accurate and complies with FIC (Financial Intelligence Centre) requirements.</span>
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" onClick={back} disabled={step === 0 || submitting}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Submit for review
            </Button>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DriverOnboardingPage;
