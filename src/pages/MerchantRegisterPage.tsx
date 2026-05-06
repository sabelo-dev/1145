
import RegisterMerchantForm from "@/components/merchant/RegisterMerchantForm";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";

const MerchantRegisterPage = () => {
  useFrameBreakout();
  return (
    <div className="container mx-auto py-12">
      <RegisterMerchantForm />
    </div>
  );
};

export default MerchantRegisterPage;
