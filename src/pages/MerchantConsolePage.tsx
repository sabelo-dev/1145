import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MerchantOrderConsole from "@/components/merchant/dashboard/MerchantOrderConsole";
import ConsoleSignIn from "@/components/merchant/console/ConsoleSignIn";
import SEO from "@/components/SEO";
import { useConsoleApp } from "@/hooks/useConsoleApp";

/**
 * The order console as its own app ("1145 Orders"): at /merchant/console on
 * the web (installable), and as the whole of the Android orders app. It signs
 * people in itself so the installed app never leaves the console.
 */
const MerchantConsolePage = () => {
  const { user, isLoading } = useAuth();
  const app = useConsoleApp();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  return (
    <>
      <SEO title="1145 Orders" description="Order console for 1145 stores" />
      {user ? <MerchantOrderConsole standalone app={app} /> : <ConsoleSignIn />}
    </>
  );
};

export default MerchantConsolePage;
