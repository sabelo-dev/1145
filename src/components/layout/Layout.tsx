import React, { memo } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";

const Layout: React.FC = memo(() => {
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
