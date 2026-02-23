import { useState, useEffect } from "react";
import { resolveCustomDomain } from "@/services/products";

/**
 * Hook that detects if the current hostname is a custom domain
 * and resolves it to a store slug for rendering the correct storefront.
 * 
 * This is the core of the single-source-of-truth architecture:
 * - Custom domains are just alternate access points
 * - All data comes from the same database tables
 * - No duplication, no separate CMS, no manual sync
 */
export const useCustomDomainResolver = () => {
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [resolvedStoreSlug, setResolvedStoreSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolve = async () => {
      const hostname = window.location.hostname;

      // Skip resolution for known platform hostnames
      const platformHosts = [
        "localhost",
        "127.0.0.1",
        "lovable.app",
        "lovableproject.com",
        "lovable.dev",
        "1145lifestyle.com",
        "www.1145lifestyle.com",
      ];

      const isPlatform = platformHosts.some(
        (h) => hostname === h || hostname.endsWith(`.${h}`)
      );

      if (isPlatform) {
        setIsCustomDomain(false);
        setLoading(false);
        return;
      }

      // This hostname might be a merchant's custom domain
      try {
        const slug = await resolveCustomDomain(hostname);
        if (slug) {
          setIsCustomDomain(true);
          setResolvedStoreSlug(slug);
        } else {
          setIsCustomDomain(false);
        }
      } catch {
        setIsCustomDomain(false);
      } finally {
        setLoading(false);
      }
    };

    resolve();
  }, []);

  return { isCustomDomain, resolvedStoreSlug, loading };
};
