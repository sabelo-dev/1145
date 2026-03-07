import React from "react";
import FleetManagement from "@/components/fleet/FleetManagement";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FleetDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Fleet Management</h1>
      </header>
      <main className="p-6 max-w-7xl mx-auto">
        <FleetManagement />
      </main>
    </div>
  );
};

export default FleetDashboardPage;
