import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls the window (and main scroll containers) to the top whenever
 * the route pathname changes, so a fresh page always loads from the top.
 */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Defer to next frame so lazy-loaded route content is mounted first
    const id = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
