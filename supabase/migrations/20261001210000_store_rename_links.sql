-- Renaming a store must not break its links.
--
-- Store links are /store/{slug}. The slug used to stay behind when a merchant
-- renamed the store (or, when it was edited, the old address simply stopped
-- existing), so shared links and cached product cards hit "Store Not Found".
--
-- * When the name changes, the slug follows it, as long as the slug was
--   following the name already (a custom Store URL is left alone).
-- * Every slug a store has had is remembered, and resolve_store_slug() maps an
--   old address to the current one so the storefront can redirect.

CREATE TABLE IF NOT EXISTS public.store_slug_history (
  old_slug text PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_slug_history_store ON public.store_slug_history(store_id);

-- Read only through resolve_store_slug(); no direct client access.
ALTER TABLE public.store_slug_history ENABLE ROW LEVEL SECURITY;

-- Same rule the app uses when it creates a store.
CREATE OR REPLACE FUNCTION public.slugify_store_name(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.sync_store_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_base text;
  v_base text;
  v_slug text;
  v_n integer := 1;
BEGIN
  -- Name changed and the caller did not pick a URL itself.
  -- The official store keeps its address: the app links to it by slug
  -- (OFFICIAL_STORE_SLUG in src/lib/officialStore.ts).
  IF NEW.name IS DISTINCT FROM OLD.name
     AND NEW.slug IS NOT DISTINCT FROM OLD.slug
     AND OLD.slug IS NOT NULL
     AND OLD.slug <> 'xixlv' THEN
    v_old_base := public.slugify_store_name(OLD.name);
    v_base := public.slugify_store_name(NEW.name);

    IF v_old_base <> '' AND v_base <> '' AND v_base <> v_old_base
       AND (OLD.slug = v_old_base OR OLD.slug ~ ('^' || v_old_base || '-[0-9]+$')) THEN
      v_slug := v_base;
      -- Never take another store's current or former address.
      WHILE EXISTS (SELECT 1 FROM public.stores WHERE slug = v_slug AND id <> NEW.id)
         OR EXISTS (SELECT 1 FROM public.store_slug_history WHERE old_slug = v_slug AND store_id <> NEW.id) LOOP
        v_n := v_n + 1;
        v_slug := v_base || '-' || v_n;
      END LOOP;
      NEW.slug := v_slug;
    END IF;
  END IF;

  IF NEW.slug IS DISTINCT FROM OLD.slug AND OLD.slug IS NOT NULL THEN
    -- A live slug always wins over a remembered one.
    DELETE FROM public.store_slug_history WHERE old_slug = NEW.slug;
    INSERT INTO public.store_slug_history (old_slug, store_id)
    VALUES (OLD.slug, NEW.id)
    ON CONFLICT (old_slug) DO UPDATE SET store_id = EXCLUDED.store_id, created_at = now();
  END IF;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.sync_store_slug() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_store_slug ON public.stores;
CREATE TRIGGER trg_sync_store_slug
  BEFORE UPDATE OF name, slug ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.sync_store_slug();

-- Current slug for a current or former store address; NULL if it never existed.
CREATE OR REPLACE FUNCTION public.resolve_store_slug(p_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT s.slug FROM public.stores s WHERE s.slug = lower(trim(p_slug))),
    (SELECT s.slug
       FROM public.store_slug_history h
       JOIN public.stores s ON s.id = h.store_id
      WHERE h.old_slug = lower(trim(p_slug)))
  );
$$;
GRANT EXECUTE ON FUNCTION public.resolve_store_slug(text) TO anon, authenticated;

-- The official store was /store/marketplace before it was renamed to XIXLV;
-- links shared under the old address keep working.
INSERT INTO public.store_slug_history (old_slug, store_id)
SELECT 'marketplace', s.id FROM public.stores s
 WHERE s.slug = 'xixlv'
   AND NOT EXISTS (SELECT 1 FROM public.stores WHERE slug = 'marketplace')
ON CONFLICT (old_slug) DO NOTHING;
