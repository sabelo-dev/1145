import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { plausiblePageview } from "@/lib/plausible";

/** Sends a Plausible pageview on every route change (the app has no page loads after the first). */
const PageviewTracker = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    plausiblePageview();
  }, [pathname, search]);
  return null;
};

export default PageviewTracker;
