import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Calendar, DollarSign, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import CreditScoreCard from "@/components/leasing/CreditScoreCard";
import { creditScoringEngine, type CreditScore } from "@/services/leasing";

interface LeaseAsset {
  id: string; title: string; description?: string; lease_price_monthly: number;
  lease_price_weekly?: number; security_deposit: number; min_lease_duration_months: number;
  max_lease_duration_months: number; insurance_required?: boolean; insurance_monthly_cost?: number;
  lease_to_own?: boolean; lease_to_own_price?: number; lease_to_own_months?: number;
  maintenance_responsibility?: string; terms_and_conditions?: string; condition?: string; images?: string[];
}

interface LeaseApplicationFormProps {
  asset: LeaseAsset;
  productName: string;
  productImage?: string;
}

const LeaseApplicationForm: React.FC<LeaseApplicationFormProps> = ({ asset, productName, productImage }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [creditScore, setCreditScore] = useState<CreditScore | null>(null);
  const [leaseDuration, setLeaseDuration] = useState(asset.min_lease_duration_months);
  const [isLeaseToOwn, setIsLeaseToOwn] = useState(false);
  const [includeInsurance, setIncludeInsurance] = useState(asset.insurance_required || false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formData, setFormData] = useState({
    applicantName: "", applicantEmail: user?.email || "", applicantPhone: "",
    employmentStatus: "", monthlyIncome: 0, notes: "",
  });

  const monthlyPayment = asset.lease_price_monthly;
  const insuranceCost = includeInsurance ? (asset.insurance_monthly_cost || 0) : 0;
  const totalMonthly = monthlyPayment + insuranceCost;
  const duration = isLeaseToOwn && asset.lease_to_own_months ? asset.lease_to_own_months : leaseDuration;
  const totalContractValue = totalMonthly * duration;
  const canAfford = creditScore ? creditScoringEngine.canAffordLease(creditScore, totalMonthly, duration) : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast({ title: "Please log in", variant: "destructive" }); navigate("/login"); return; }

    setLoading(true);
    try {
      const { error } = await supabase.from("lease_applications").insert({
        user_id: user.id, asset_id: asset.id,
        lease_duration_months: duration, monthly_payment: totalMonthly,
        security_deposit: asset.security_deposit,
        applicant_name: formData.applicantName, applicant_email: formData.applicantEmail,
        applicant_phone: formData.applicantPhone, employment_status: formData.employmentStatus,
        monthly_income: formData.monthlyIncome,
        credit_score: creditScore?.score || null,
        notes: `${formData.notes}${isLeaseToOwn ? ' [LEASE-TO-OWN]' : ''}${includeInsurance ? ` [INSURANCE: R${insuranceCost}/mo]` : ''}`,
        status: "pending",
      });
      if (error) throw error;
      toast({ title: "Application submitted!", description: "Your lease application is under review." });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const durationOptions = [];
  for (let m = asset.min_lease_duration_months; m <= (asset.max_lease_duration_months || 24); m++) durationOptions.push(m);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-black tracking-tight mb-6">Lease Application</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Credit Score */}
          <CreditScoreCard onScoreLoaded={setCreditScore} />

          {creditScore && !canAfford && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Lease Value Exceeds Limit</p>
                  <p className="text-sm text-muted-foreground">This lease ({formatCurrency(totalContractValue)}) exceeds your max approved value of {formatCurrency(creditScore.max_lease_value)}. You can still apply for review.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {creditScore && canAfford && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-700">Pre-Qualified</p>
                  <p className="text-sm text-muted-foreground">Based on your 1145 credit score of {creditScore.score}, you're pre-qualified for this lease.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="border-0 ring-1 ring-border">
              <CardHeader><CardTitle className="text-lg">Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input required value={formData.applicantName} onChange={e => setFormData({ ...formData, applicantName: e.target.value })} placeholder="Your full name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input required type="email" value={formData.applicantEmail} onChange={e => setFormData({ ...formData, applicantEmail: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input required value={formData.applicantPhone} onChange={e => setFormData({ ...formData, applicantPhone: e.target.value })} placeholder="+27..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Employment Status *</Label>
                    <Select value={formData.employmentStatus} onValueChange={v => setFormData({ ...formData, employmentStatus: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employed">Employed</SelectItem>
                        <SelectItem value="self_employed">Self-Employed</SelectItem>
                        <SelectItem value="1145_driver">1145 Driver</SelectItem>
                        <SelectItem value="1145_merchant">1145 Merchant</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Monthly Income (R)</Label>
                  <Input type="number" min={0} value={formData.monthlyIncome || ""} onChange={e => setFormData({ ...formData, monthlyIncome: Number(e.target.value) })} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 ring-1 ring-border">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" />Lease Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!isLeaseToOwn && (
                  <div className="space-y-2">
                    <Label>Lease Duration</Label>
                    <Select value={String(leaseDuration)} onValueChange={v => setLeaseDuration(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{durationOptions.map(m => <SelectItem key={m} value={String(m)}>{m} months</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {asset.lease_to_own && (
                  <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                    <Checkbox checked={isLeaseToOwn} onCheckedChange={c => setIsLeaseToOwn(!!c)} id="leaseToOwn" />
                    <div>
                      <label htmlFor="leaseToOwn" className="font-medium cursor-pointer">Lease-to-Own Option</label>
                      <p className="text-sm text-muted-foreground mt-1">Own the asset after {asset.lease_to_own_months || leaseDuration} payments.</p>
                    </div>
                  </div>
                )}
                {(asset.insurance_required || asset.insurance_monthly_cost) && (
                  <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
                    <Checkbox checked={includeInsurance} onCheckedChange={c => setIncludeInsurance(!!c)} disabled={asset.insurance_required} id="insurance" />
                    <div>
                      <label htmlFor="insurance" className="font-medium cursor-pointer flex items-center gap-2">
                        <Shield className="h-4 w-4" />Asset Insurance {asset.insurance_required && <Badge variant="secondary">Required</Badge>}
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">{formatCurrency(asset.insurance_monthly_cost || 0)}/month — damage, theft, loss coverage</p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Additional Notes</Label>
                  <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={3} />
                </div>
              </CardContent>
            </Card>

            {asset.terms_and_conditions && (
              <Card className="border-0 ring-1 ring-border">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" />Terms & Conditions</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto mb-4">{asset.terms_and_conditions}</div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={agreedToTerms} onCheckedChange={c => setAgreedToTerms(!!c)} id="terms" />
                    <label htmlFor="terms" className="text-sm cursor-pointer">I agree to the terms and conditions</label>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button type="submit" className="w-full h-12 rounded-xl text-base" size="lg" disabled={loading || (asset.terms_and_conditions ? !agreedToTerms : false)}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Lease Application
            </Button>
          </form>
        </div>

        {/* Sidebar */}
        <div>
          <Card className="sticky top-24 border-0 ring-1 ring-border">
            <CardHeader><CardTitle className="text-lg">Lease Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {productImage && <img src={productImage} alt={productName} className="w-full h-40 object-cover rounded-lg" />}
              <h3 className="font-semibold">{productName}</h3>
              <Badge variant="outline" className="capitalize">{asset.condition?.replace("_", " ") || "New"}</Badge>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Monthly Lease</span><span className="font-medium">{formatCurrency(monthlyPayment)}</span></div>
                {includeInsurance && <div className="flex justify-between"><span>Insurance</span><span className="font-medium">{formatCurrency(insuranceCost)}</span></div>}
                <Separator />
                <div className="flex justify-between font-semibold"><span>Total Monthly</span><span>{formatCurrency(totalMonthly)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Duration</span><span>{duration} months</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Security Deposit</span><span>{formatCurrency(asset.security_deposit)}</span></div>
                <Separator />
                <div className="flex justify-between font-bold text-base"><span>Total Contract</span><span>{formatCurrency(totalContractValue + asset.security_deposit)}</span></div>
                {isLeaseToOwn && (
                  <div className="p-2 bg-primary/10 rounded text-center">
                    <span className="text-xs font-medium text-primary">Ownership after {asset.lease_to_own_months || leaseDuration} months</span>
                  </div>
                )}
              </div>
              {creditScore && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Your Credit Score</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-lg font-black ${creditScoringEngine.getScoreColor(creditScore.score)}`}>{creditScore.score}/850</span>
                      <Badge className={`${creditScoringEngine.getRiskDisplay(creditScore.risk_level).bg} ${creditScoringEngine.getRiskDisplay(creditScore.risk_level).text} border-0`}>
                        {creditScoringEngine.getRiskDisplay(creditScore.risk_level).label}
                      </Badge>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LeaseApplicationForm;
