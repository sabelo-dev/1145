import MerchantOrderConsole from "@/components/merchant/dashboard/MerchantOrderConsole";
import SEO from "@/components/SEO";

/** Full-screen order console for a store tablet. Owners and staff sign in with their own accounts. */
const MerchantConsolePage = () => (
  <>
    <SEO title="Order console" />
    <MerchantOrderConsole standalone />
  </>
);

export default MerchantConsolePage;
