import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Dashboard tab state that lives in the URL (?tab=orders), so a page refresh,
 * a shared link, or the back button keeps the user on the same tab.
 * The default tab is omitted from the URL to keep links clean.
 */
export function useUrlTab(defaultTab: string, param = "tab") {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get(param) || defaultTab;

  const setTab = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === defaultTab) params.delete(param);
          else params.set(param, next);
          return params;
        },
        { replace: true },
      );
    },
    [defaultTab, param, setSearchParams],
  );

  return [tab, setTab] as const;
}
