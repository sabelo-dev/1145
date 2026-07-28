import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Stepper from "@/components/onboarding/Stepper";
import { cn } from "@/lib/utils";

const STEPS = ["Identity", "Niche & audience", "Social profiles", "Payout"];

const NICHES = ["Fashion", "Beauty", "Tech", "Food", "Travel", "Fitness", "Lifestyle", "Gaming", "Finance", "Parenting"];
const PLATFORMS = ["instagram", "tiktok", "twitter", "youtube", "facebook"] as const;

const schema = z.object({
  displayName: z.string().trim().min(2).max(60),
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9._]+$/i, "Letters, numbers, . or _"),
  bio: z.string().trim().max(280).optional(),
  firstName: z.string().trim().min(2).max(40),
  lastName: z.string().trim().min(2).max(40),
  phone: z.string().trim().min(9).max(20),
  country: z.string().min(2),
});

interface SocialLink { platform: string; handle: string; url: string; }

const InfluencerOnboardingPage: React.FC = () => {
  const { user, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    bio: "",
    firstName: "",
    lastName: "",
    phone: "",
    country: "South Africa",
    niches: [] as string[],
    audienceBand: "1k-10k",
    payoutMethod: "bank",
    bankName: "",
    bankAccountLast4: "",
    ucoinPayout: false,
    ftcAccepted: false,
    termsAccepted: false,
  });
  const [socials, setSocials] = useState<SocialLink[]>([{ platform: "instagram", handle: "", url: "" }]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("influencer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setForm((f) => ({
          ...f,
          displayName: data.display_name || "",
          username: data.username || "",
          bio: data.bio || "",
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          phone: data.phone || "",
          country: data.country || "South Africa",
        }));
      }
    })();
  }, [user]);

  if (!user) return <div className="p-8">Please log in.</div>;

  const toggleNiche = (n: string) =>
    setForm((f) => ({
      ...f,
      niches: f.niches.includes(n) ? f.niches.filter((x) => x !== n) : [...f.niches, n],
    }));

  const canNext = (): string | null => {
    switch (step) {
      case 0:
        if (!form.displayName || !form.username) return "Display name and username are required.";
        if (!/^[a-z0-9._]+$/i.test(form.username)) return "Username can only contain letters, numbers, . and _";
        return null;
      case 1:
        if (!form.firstName || !form.lastName || !form.phone) return "Please complete your contact details.";
        if (form.niches.length === 0) return "Choose at least one niche.";
        return null;
      case 2:
        if (!socials.some((s) => s.handle.trim())) return "Add at least one social profile.";
        return null;
      case 3:
        if (form.payoutMethod === "bank" && (!form.bankName || !form.bankAccountLast4)) return "Provide bank details.";
        if (!form.ftcAccepted || !form.termsAccepted) return "Accept the disclosures to continue.";
        return null;
    }
    return null;
  };

  const next = () => {
    const err = canNext();
    if (err) return toast({ variant: "destructive", title: "Please review", description: err });
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    const err = canNext();
    if (err) return toast({ variant: "destructive", title: "Please review", description: err });
    try {
      schema.parse(form);
    } catch (e: any) {
      return toast({ variant: "destructive", title: "Validation failed", description: e.errors?.[0]?.message });
    }
    setSubmitting(true);
    try {
      // Username uniqueness
      const { data: existing } = await supabase
        .from("influencer_profiles")
        .select("user_id")
        .ilike("username", form.username)
        .neq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        setSubmitting(false);
        return toast({ variant: "destructive", title: "Username taken", description: "Pick another username." });
      }

      const { error: profErr } = await supabase.from("influencer_profiles").upsert(
        {
          user_id: user.id,
          display_name: form.displayName,
          username: form.username.toLowerCase(),
          bio: form.bio,
          first_name: form.firstName,
          last_name: form.lastName,
          phone: form.phone,
          country: form.country,
          onboarding_completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (profErr) throw profErr;

      // Save social accounts (manual entries — go into pending verification queue)
      const rows = socials
        .filter((s) => s.handle.trim())
        .map((s) => ({
          user_id: user.id,
          platform: s.platform,
          handle: s.handle.trim().replace(/^@/, ""),
          profile_url: s.url || null,
          is_verified: false,
        }));
      if (rows.length > 0) {
        await supabase.from("social_accounts").upsert(rows as any, { onConflict: "user_id,platform" });
      }

      // Ensure influencer role
      await supabase.from("user_roles").upsert({ user_id: user.id, role: "influencer" }, { onConflict: "user_id,role" });

      await refreshUserProfile();
      toast({ title: "You're in!", description: "Welcome to the 1145 creator programme." });
      navigate("/influencer/dashboard", { replace: true });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Failed to save", description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <SEO title="Influencer onboarding · 1145" description="Set up your creator profile on 1145." />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6" /> Creator onboarding
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tell us about your brand so we can match you with paid campaigns.
          </p>
        </div>

        <Stepper steps={STEPS} current={step} />

        <Card>
          <CardHeader>
            <CardTitle>Step {step + 1}: {STEPS[step]}</CardTitle>
            <CardDescription>
              {step === 0 && "Choose how creators and brands will see you."}
              {step === 1 && "Help us route the right campaigns to you."}
              {step === 2 && "Add the socials where you post — you can verify with OAuth later."}
              {step === 3 && "Where should we pay your earnings?"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Display name *</Label>
                  <Input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
                </div>
                <div>
                  <Label>Username *</Label>
                  <Input value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="jane.doe" />
                </div>
                <div className="md:col-span-2">
                  <Label>Short bio</Label>
                  <Textarea rows={3} maxLength={280} value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="What do you post about?" />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>First name *</Label>
                    <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                  </div>
                  <div>
                    <Label>Last name *</Label>
                    <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                  </div>
                  <div>
                    <Label>Mobile number *</Label>
                    <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+27..." />
                  </div>
                  <div>
                    <Label>Country *</Label>
                    <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Audience size</Label>
                  <Select value={form.audienceBand} onValueChange={(v) => set("audienceBand", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="<1k">Under 1k</SelectItem>
                      <SelectItem value="1k-10k">1k – 10k</SelectItem>
                      <SelectItem value="10k-100k">10k – 100k</SelectItem>
                      <SelectItem value="100k-1m">100k – 1m</SelectItem>
                      <SelectItem value=">1m">1m+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Primary niches * (pick 1–3)</Label>
                  <div className="flex flex-wrap gap-2">
                    {NICHES.map((n) => {
                      const active = form.niches.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => toggleNiche(n)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm border transition-colors",
                            active
                              ? "bg-foreground text-background border-foreground"
                              : "bg-background hover:bg-accent"
                          )}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                {socials.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Label>Platform</Label>
                      <Select value={s.platform} onValueChange={(v) => setSocials((arr) => arr.map((x, j) => j === i ? { ...x, platform: v } : x))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label>Handle</Label>
                      <Input value={s.handle} onChange={(e) => setSocials((arr) => arr.map((x, j) => j === i ? { ...x, handle: e.target.value } : x))} placeholder="@handle" />
                    </div>
                    <div className="col-span-5">
                      <Label>Profile URL</Label>
                      <Input value={s.url} onChange={(e) => setSocials((arr) => arr.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://..." />
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSocials((s) => [...s, { platform: "instagram", handle: "", url: "" }])}>
                    Add another
                  </Button>
                  {socials.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSocials((s) => s.slice(0, -1))}>
                      Remove last
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Manual entries are marked unverified until you connect via OAuth from the dashboard.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label>Payout method *</Label>
                  <Select value={form.payoutMethod} onValueChange={(v) => set("payoutMethod", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">SA bank account</SelectItem>
                      <SelectItem value="ucoin">1145 UCoin wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.payoutMethod === "bank" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Bank *</Label>
                      <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
                    </div>
                    <div>
                      <Label>Account — last 4 digits *</Label>
                      <Input maxLength={4} value={form.bankAccountLast4} onChange={(e) => set("bankAccountLast4", e.target.value.replace(/\D/g, ""))} />
                    </div>
                  </div>
                )}
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={form.ftcAccepted} onCheckedChange={(v) => set("ftcAccepted", v === true)} />
                  <span>I will disclose paid partnerships using #ad or platform-native tags on every sponsored post.</span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={form.termsAccepted} onCheckedChange={(v) => set("termsAccepted", v === true)} />
                  <span>I accept the 1145 <a className="underline" href="/terms" target="_blank">Creator Terms</a> and confirm all information provided is accurate.</span>
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
              Finish setup
            </Button>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default InfluencerOnboardingPage;
