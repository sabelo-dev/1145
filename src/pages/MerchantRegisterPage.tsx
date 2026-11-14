
import { Navigate } from "react-router-dom";
import RegisterMerchantForm from "@/components/merchant/RegisterMerchantForm";
import { useAuth } from "@/contexts/AuthContext";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";

/** Where a signed-out visitor goes: create a merchant account, then store onboarding. */
const MERCHANT_SIGNUP_PATH = "/register?role=merchant&redirect=%2Fmerchant%2Fonboarding";

const MerchantRegisterPage = () => {
  useFrameBreakout();
  const { user, isLoading } = useAuth();
  // Signed-out visitors used to fill in the form, then land on a plain sign-up
  // that dropped the merchant role. They now create a merchant account first.
  if (isLoading) return null;
  if (!user) return <Navigate to={MERCHANT_SIGNUP_PATH} replace />;
  return (
    <div className="container mx-auto py-12">
      <RegisterMerchantForm />
    </div>
  );
};

export default MerchantRegisterPage;
