import React, { memo } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";

const Layout: React.FC = memo(() => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {/* pb-20 on mobile reserves room for the fixed bottom nav (56px + safe-area) */}
      <main className="flex-1 pb-20 md:pb-0" role="main">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
});

Layout.displayName = "Layout";

export default Layout;
