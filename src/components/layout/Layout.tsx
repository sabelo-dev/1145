import React, { memo } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

const Layout: React.FC = memo(() => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1" role="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
});

Layout.displayName = "Layout";

export default Layout;
