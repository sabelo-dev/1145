import React, { memo, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { rememberReferralCode } from "@/lib/referral";
import Header from "./Header";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";

const Layout: React.FC = memo(() => {
  const { search } = useLocation();

  // Shared links land on any page (e.g. /product/x?ref=CODE); keep the code for sign-up.
  useEffect(() => {
    rememberReferralCode(new URLSearchParams(search).get("ref"));
  }, [search]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      {/* Footer carries the bottom-nav offset (pb-nav) so content never hides behind it */}
      <main className="flex-1" role="main">
        <Outlet />
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  );
});

Layout.displayName = "Layout";

export default Layout;
