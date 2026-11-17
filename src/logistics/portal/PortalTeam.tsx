import React from "react";
import { PageHeader } from "../components/common";
import AccountTeam from "../components/AccountTeam";
import { usePortal } from "./PortalApp";

const PortalTeam: React.FC = () => {
  const { account } = usePortal();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Team" description="People who can book and track deliveries for this account." />
      <AccountTeam accountId={account.id} />
    </div>
  );
};

export default PortalTeam;
