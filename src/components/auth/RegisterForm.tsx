import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Gift, CheckCircle } from "lucide-react";
import { registerSchema, RegisterFormValues } from "@/types/auth";
import RegisterFormFields from "./register/RegisterFormFields";
import AccountTypeSelection from "./register/AccountTypeSelection";
import TermsAndConditions from "./register/TermsAndConditions";
import SocialLoginButtons from "./register/SocialLoginButtons";
import { supabase } from "@/integrations/supabase/client";

const RegisterForm: React.FC = () => {
  const { register: registerUser, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as any;
  
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '');
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [checkingReferral, setCheckingReferral] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: state?.businessName || "",
      email: "",
      password: "",
      confirmPassword: "",
      role: state?.role || "consumer",
      terms: false,
    },
  });

  // Validate referral code
  useEffect(() => {
    const validateReferralCode = async () => {
      if (!referralCode || referralCode.length < 6) {
        setReferralValid(null);
        return;
      }

      setCheckingReferral(true);
      const { data, error } = await supabase
        .from('user_referral_codes')
        .select('code')
        .eq('code', referralCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      setReferralValid(!error && !!data);
      setCheckingReferral(false);
    };

    const debounce = setTimeout(validateReferralCode, 500);
    return () => clearTimeout(debounce);
  }, [referralCode]);

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      const result = await registerUser(values.email, values.password, values.name, values.role);
      
      // Process referral after successful registration
      if (result.redirectPath && referralCode && referralValid) {
        // Get the newly created user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.rpc('process_referral_signup', {
            p_referred_id: user.id,
            p_referral_code: referralCode.toUpperCase()
          });
        }
      }
      
      if (result.redirectPath) {
        navigate(result.redirectPath);
      }
    } catch (error) {
      console.error(error);
      // Error is handled in the AuthContext
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 p-6 bg-white rounded-lg shadow-md">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Create an Account</h1>
        <p className="text-gray-600 mt-2">Join 1145 Lifestyle for the best shopping experience</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <RegisterFormFields control={form.control} />
          <AccountTypeSelection control={form.control} />
          
          {/* Referral Code Field */}
          <div className="space-y-2">
            <FormLabel className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" />
              Referral Code (Optional)
            </FormLabel>
            <div className="relative">
              <Input
                placeholder="Enter referral code"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className={`font-mono uppercase ${
                  referralValid === true ? 'border-green-500 pr-10' : 
                  referralValid === false ? 'border-red-500' : ''
                }`}
              />
              {checkingReferral && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!checkingReferral && referralValid === true && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              )}
            </div>
            {referralValid === true && (
              <p className="text-xs text-green-600">Valid referral code! UCoin rewards will be auto-credited on signup.</p>
            )}
            {referralValid === false && referralCode.length >= 6 && (
              <p className="text-xs text-red-600">Invalid or expired referral code</p>
            )}
          </div>
          
          <TermsAndConditions control={form.control} />

          <Button type="submit" className="w-full bg-wwe-navy hover:bg-wwe-navy/90" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      </Form>

      <SocialLoginButtons />

      <div className="text-center mt-6">
        <p className="text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="text-wwe-navy hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;
