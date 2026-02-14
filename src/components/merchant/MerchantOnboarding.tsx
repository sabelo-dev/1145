import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { applyPlatformMarkup } from "@/utils/pricingMarkup";
import OnboardingProgress from "./onboarding/OnboardingProgress";
import StepAccountCreation from "./onboarding/StepAccountCreation";
import StepBusinessInfo, { BusinessInfoValues } from "./onboarding/StepBusinessInfo";
import StepKYC from "./onboarding/StepKYC";
import StepStoreSetup, { StoreSetupValues } from "./onboarding/StepStoreSetup";
import StepPaymentTax, { PaymentTaxValues } from "./onboarding/StepPaymentTax";
import StepFirstProduct, { FirstProductValues } from "./onboarding/StepFirstProduct";
import StepReviewActivation from "./onboarding/StepReviewActivation";

const STEPS = [
  { id: 1, name: "Account Creation", shortName: "Account" },
  { id: 2, name: "Business Information", shortName: "Business" },
  { id: 3, name: "Identity & Compliance", shortName: "KYC" },
  { id: 4, name: "Store Setup", shortName: "Store" },
  { id: 5, name: "Payment & Tax", shortName: "Payment" },
  { id: 6, name: "First Product", shortName: "Product" },
  { id: 7, name: "Review & Activation", shortName: "Activate" },
];

const STATUS_TO_STEP: Record<string, number> = {
  PENDING_PROFILE: 1,
  PENDING_KYC: 2,
  KYC_PENDING_REVIEW: 4, // Skip ahead, KYC submitted
  KYC_APPROVED: 4,
  KYC_REJECTED: 3, // Go back to KYC
  PROFILE_COMPLETED: 5,
  FIRST_PRODUCT_CREATED: 7,
  ACTIVE: 7,
};

const MerchantOnboarding: React.FC = () => {
  const { toast } = useToast();
  const { user, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [vendorData, setVendorData] = useState<any>(null);
  const [isActivated, setIsActivated] = useState(false);

  // KYC state
  const [kycDocuments, setKycDocuments] = useState<Record<string, string>>({});
  const [bankDetails, setBankDetails] = useState({
    accountHolder: "", accountNumber: "", routingCode: "",
  });

  // Store state
  const [shippingRegions, setShippingRegions] = useState<string[]>([]);
  const [shippingMethods, setShippingMethods] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<string | null>(null);

  // Product state
  const [productImage, setProductImage] = useState<string | null>(null);

  // Initialize vendor
  useEffect(() => {
    if (!user) {
      setPageLoading(false);
      return;
    }
    initVendor();
  }, [user]);

  const initVendor = async () => {
    if (!user) return;
    try {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (vendor) {
        setVendorData(vendor);
        // Resume from saved status
        const savedStep = STATUS_TO_STEP[vendor.onboarding_status] || 1;
        setStep(savedStep);
        if (vendor.onboarding_status === "ACTIVE") setIsActivated(true);

        // Load bank details if saved
        if (vendor.bank_account_holder) {
          setBankDetails({
            accountHolder: vendor.bank_account_holder || "",
            accountNumber: vendor.bank_account_number || "",
            routingCode: vendor.bank_routing_code || "",
          });
        }
        if (vendor.shipping_regions) setShippingRegions(vendor.shipping_regions);
        if (vendor.shipping_methods) setShippingMethods(vendor.shipping_methods);

        // Load KYC docs
        const { data: docs } = await supabase
          .from("merchant_kyc_documents")
          .select("document_type, document_url")
          .eq("vendor_id", vendor.id);
        if (docs) {
          const docMap: Record<string, string> = {};
          docs.forEach((d: any) => { docMap[d.document_type] = d.document_url; });
          setKycDocuments(docMap);
        }
      } else {
        // Create vendor record
        const { data: newVendor, error } = await supabase
          .from("vendors")
          .insert({
            user_id: user.id,
            business_name: user.name || "New Merchant",
            status: "pending",
            onboarding_status: "PENDING_PROFILE",
          })
          .select()
          .single();
        if (error) throw error;
        setVendorData(newVendor);
      }
    } catch (error) {
      console.error("Error initializing vendor:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load onboarding." });
    } finally {
      setPageLoading(false);
    }
  };

  const updateOnboardingStatus = async (status: string) => {
    if (!vendorData) return;
    const { error } = await supabase
      .from("vendors")
      .update({ onboarding_status: status })
      .eq("id", vendorData.id);
    if (error) throw error;
    setVendorData((prev: any) => ({ ...prev, onboarding_status: status }));
  };

  // Step 2: Save business info
  const handleBusinessInfo = async (data: BusinessInfoValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("vendors")
        .update({
          legal_business_name: data.legalBusinessName,
          business_name: data.legalBusinessName,
          business_type: data.businessType,
          tax_id: data.taxId || null,
          business_address: data.businessAddress,
          business_phone: data.businessPhone,
          onboarding_status: "PENDING_KYC",
        })
        .eq("id", vendorData.id);
      if (error) throw error;
      setVendorData((prev: any) => ({ ...prev, onboarding_status: "PENDING_KYC" }));
      setStep(3);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Upload KYC document
  const handleKYCUpload = async (file: File, type: string) => {
    if (!vendorData) return;
    // For now simulate upload with blob URL. In production use Supabase storage.
    const documentUrl = URL.createObjectURL(file);
    const { error } = await supabase
      .from("merchant_kyc_documents")
      .upsert({
        vendor_id: vendorData.id,
        document_type: type,
        document_url: documentUrl,
        file_name: file.name,
        status: "pending",
      }, { onConflict: "vendor_id,document_type" });

    if (error) {
      // If upsert fails due to no unique constraint, try insert
      await supabase.from("merchant_kyc_documents").insert({
        vendor_id: vendorData.id,
        document_type: type,
        document_url: documentUrl,
        file_name: file.name,
        status: "pending",
      });
    }

    setKycDocuments((prev) => ({ ...prev, [type]: documentUrl }));
    toast({ title: "Uploaded", description: `${type} uploaded successfully.` });
  };

  // Step 3: Submit KYC
  const handleKYCSubmit = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("vendors")
        .update({
          bank_account_holder: bankDetails.accountHolder,
          bank_account_number: bankDetails.accountNumber,
          bank_routing_code: bankDetails.routingCode,
          onboarding_status: "KYC_PENDING_REVIEW",
        })
        .eq("id", vendorData.id);
      if (error) throw error;
      setVendorData((prev: any) => ({ ...prev, onboarding_status: "KYC_PENDING_REVIEW" }));
      toast({ title: "KYC Submitted", description: "Your documents are under review. You can continue setting up your store." });
      setStep(4);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // File upload helper (simulated)
  const handleFileUpload = async (file: File, setter: (url: string) => void) => {
    const url = URL.createObjectURL(file);
    setter(url);
  };

  // Step 4: Save store
  const handleStoreSetup = async (data: StoreSetupValues) => {
    if (!vendorData) return;
    setIsLoading(true);
    try {
      let slug = data.storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      // Check slug uniqueness
      const { data: existing } = await supabase.from("stores").select("slug").eq("slug", slug).maybeSingle();
      if (existing) slug = `${slug}-${Math.floor(Math.random() * 10000)}`;

      const { error } = await supabase.from("stores").insert({
        vendor_id: vendorData.id,
        name: data.storeName,
        slug,
        description: data.storeDescription,
        return_policy: data.returnPolicy || null,
      });
      if (error) throw error;

      // Update vendor with shipping info
      await supabase.from("vendors").update({
        shipping_regions: shippingRegions,
        shipping_methods: shippingMethods,
        return_policy: data.returnPolicy || null,
        onboarding_status: "PROFILE_COMPLETED",
      }).eq("id", vendorData.id);

      setVendorData((prev: any) => ({ ...prev, onboarding_status: "PROFILE_COMPLETED" }));
      setStep(5);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 5: Payment & tax
  const handlePaymentTax = async (data: PaymentTaxValues) => {
    if (!vendorData) return;
    setIsLoading(true);
    try {
      await supabase.from("vendors").update({
        vat_registered: data.vatRegistered,
        vat_number: data.vatNumber || null,
        fee_agreement_accepted: data.feeAgreement,
        payout_schedule: data.payoutSchedule,
      }).eq("id", vendorData.id);
      setStep(6);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 6: Create first product
  const handleFirstProduct = async (data: FirstProductValues) => {
    if (!vendorData) return;
    setIsLoading(true);
    try {
      // Get store
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("vendor_id", vendorData.id)
        .maybeSingle();

      if (!store) throw new Error("Store not found. Please go back and create your store.");

      const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const { error } = await supabase.from("products").insert({
        store_id: store.id,
        name: data.title,
        slug: `${slug}-${Date.now()}`,
        description: data.description,
        price: applyPlatformMarkup(parseFloat(data.price), vendorData?.custom_markup_percentage),
        quantity: parseInt(data.quantity),
        category: data.category,
        sku: data.sku || null,
        status: "pending",
      });
      if (error) throw error;

      await updateOnboardingStatus("FIRST_PRODUCT_CREATED");
      setStep(7);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 7: Activate
  const handleActivate = async () => {
    setIsLoading(true);
    try {
      await supabase.from("vendors").update({
        status: "approved",
        onboarding_status: "ACTIVE",
        onboarding_completed_at: new Date().toISOString(),
      }).eq("id", vendorData.id);
      setIsActivated(true);
      await refreshUserProfile();
      toast({ title: "Store Activated!", description: "You can now start selling." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Build activation checklist
  const checklist = [
    { label: "Email verified", completed: !!user },
    { label: "Business information completed", completed: ["PENDING_KYC", "KYC_PENDING_REVIEW", "KYC_APPROVED", "KYC_REJECTED", "PROFILE_COMPLETED", "FIRST_PRODUCT_CREATED", "ACTIVE"].includes(vendorData?.onboarding_status || "") },
    { label: "KYC documents submitted", completed: ["KYC_PENDING_REVIEW", "KYC_APPROVED", "PROFILE_COMPLETED", "FIRST_PRODUCT_CREATED", "ACTIVE"].includes(vendorData?.onboarding_status || "") },
    { label: "Bank account on file", completed: !!vendorData?.bank_account_holder },
    { label: "Store configured", completed: ["PROFILE_COMPLETED", "FIRST_PRODUCT_CREATED", "ACTIVE"].includes(vendorData?.onboarding_status || "") },
    { label: "At least 1 product created", completed: ["FIRST_PRODUCT_CREATED", "ACTIVE"].includes(vendorData?.onboarding_status || "") },
  ];
  const allComplete = checklist.every(c => c.completed);

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-2xl mx-auto py-12 text-center">
        <p className="text-muted-foreground">Please log in to continue onboarding.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto py-8 px-4 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Merchant Onboarding</h1>
          <p className="text-muted-foreground">Complete all steps to activate your store</p>
        </div>

        <OnboardingProgress steps={STEPS} currentStep={step} />

        {step === 1 && (
          <StepAccountCreation
            email={user.email}
            isVerified={true}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepBusinessInfo
            defaultValues={{
              legalBusinessName: vendorData?.legal_business_name || vendorData?.business_name || "",
              businessType: vendorData?.business_type || "",
              taxId: vendorData?.tax_id || "",
              businessAddress: vendorData?.business_address || "",
              businessPhone: vendorData?.business_phone || "",
            }}
            onNext={handleBusinessInfo}
            onBack={() => setStep(1)}
            isLoading={isLoading}
          />
        )}

        {step === 3 && (
          <StepKYC
            documents={kycDocuments}
            bankDetails={bankDetails}
            onUpload={handleKYCUpload}
            onBankDetailsChange={setBankDetails}
            onNext={handleKYCSubmit}
            onBack={() => setStep(2)}
            isLoading={isLoading}
            kycStatus={vendorData?.onboarding_status}
          />
        )}

        {step === 4 && (
          <StepStoreSetup
            defaultValues={{
              storeName: "",
              storeDescription: "",
              returnPolicy: vendorData?.return_policy || "",
            }}
            selectedRegions={shippingRegions}
            selectedMethods={shippingMethods}
            logoFile={logoFile}
            bannerFile={bannerFile}
            onRegionsChange={setShippingRegions}
            onMethodsChange={setShippingMethods}
            onLogoUpload={(f) => handleFileUpload(f, setLogoFile)}
            onBannerUpload={(f) => handleFileUpload(f, setBannerFile)}
            onNext={handleStoreSetup}
            onBack={() => setStep(3)}
            isLoading={isLoading}
          />
        )}

        {step === 5 && (
          <StepPaymentTax
            commissionRate={vendorData?.commission_rate || 15}
            defaultValues={{
              vatRegistered: vendorData?.vat_registered || false,
              vatNumber: vendorData?.vat_number || "",
              feeAgreement: vendorData?.fee_agreement_accepted || false,
              payoutSchedule: vendorData?.payout_schedule || "weekly",
            }}
            onNext={handlePaymentTax}
            onBack={() => setStep(4)}
            isLoading={isLoading}
          />
        )}

        {step === 6 && (
          <StepFirstProduct
            productImage={productImage}
            onImageUpload={(f) => handleFileUpload(f, setProductImage)}
            onNext={handleFirstProduct}
            onBack={() => setStep(5)}
            isLoading={isLoading}
          />
        )}

        {step === 7 && (
          <StepReviewActivation
            checklist={checklist}
            allComplete={allComplete}
            onActivate={handleActivate}
            isLoading={isLoading}
            isActivated={isActivated}
          />
        )}
      </div>
    </div>
  );
};

export default MerchantOnboarding;
