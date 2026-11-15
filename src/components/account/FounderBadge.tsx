import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { getMyFoundersPass, type FoundersPass } from "@/services/foundersPass";

/**
 * The signed-in user's Founders Pass number, as a row for the profile's
 * Account Status card. Renders nothing for people without a pass.
 */
const FounderBadge: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [pass, setPass] = useState<FoundersPass | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setPass(null);
      return;
    }
    getMyFoundersPass(userId).then((found) => {
      if (!cancelled) setPass(found);
    });
    return () => { cancelled = true; };
  }, [userId]);

  if (!pass) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h4 className="font-medium">Founders Pass</h4>
        <p className="text-sm text-muted-foreground">
          One of the first members of 1145. <Link to="/founders" className="underline">View your pass</Link>
        </p>
      </div>
      <Badge className="gap-1 whitespace-nowrap tabular-nums">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
        Founder No. {String(pass.pass_number).padStart(4, "0")}
      </Badge>
    </div>
  );
};

export default FounderBadge;
