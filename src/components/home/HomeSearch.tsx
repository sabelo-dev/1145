import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, TrendingUp, LayoutGrid, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAllProducts, fetchCategories } from "@/services/products";
import { popularSearches } from "@/content/home";
import { track } from "@/lib/analytics";
import type { Category, Product } from "@/types";

type Suggestion =
  | { kind: "search"; label: string }
  | { kind: "category"; label: string; slug: string }
  | { kind: "product"; label: string; slug: string };

const MAX_PRODUCTS = 5;

/**
 * Search with category chips and live suggestions. Catalogue and categories
 * load on first focus, so the box costs nothing until someone uses it.
 */
const HomeSearch: React.FC<{ inverse?: boolean; className?: string }> = ({ inverse = false, className }) => {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const loaded = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = () => {
    if (loaded.current) return;
    loaded.current = true;
    fetchCategories(true).then(setCategories).catch(() => {});
    fetchAllProducts().then(setProducts).catch(() => {});
  };

  // Close when focus or a tap leaves the search.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [
        ...popularSearches.map((label) => ({ kind: "search" as const, label })),
        ...categories.slice(0, 6).map((c) => ({ kind: "category" as const, label: c.name, slug: c.slug })),
      ];
    }
    const cats = categories
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((c) => ({ kind: "category" as const, label: c.name, slug: c.slug }));
    const prods = products
      .filter((p) => p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q))
      .slice(0, MAX_PRODUCTS)
      .map((p) => ({ kind: "product" as const, label: p.name, slug: p.slug }));
    return [{ kind: "search" as const, label: query.trim() }, ...cats, ...prods];
  }, [query, categories, products]);

  const go = (s: Suggestion) => {
    setOpen(false);
    if (s.kind === "category") {
      track("category_click", { category: s.label, placement: "search" });
      navigate(`/category/${s.slug}`);
    } else if (s.kind === "product") {
      track("search", { query: query.trim(), result: "product" });
      navigate(`/product/${s.slug}`);
    } else {
      track("search", { query: s.label });
      navigate(`/shop?search=${encodeURIComponent(s.label)}`);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && suggestions[active]) return go(suggestions[active]);
    if (query.trim()) go({ kind: "search", label: query.trim() });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Escape") { setOpen(false); setActive(-1); }
  };

  const icon = (s: Suggestion) =>
    s.kind === "category" ? LayoutGrid : s.kind === "product" ? Package : query ? Search : TrendingUp;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <form role="search" onSubmit={onSubmit}>
        <label htmlFor={`${listId}-input`} className="sr-only">Search products, brands and categories</label>
        <div className="relative">
          <Search aria-hidden className={cn("pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2", inverse ? "text-white/60" : "text-text-secondary")} />
          <input
            id={`${listId}-input`}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            placeholder="Search hoodies, headphones, brands…"
            value={query}
            onFocus={() => { load(); setOpen(true); }}
            onChange={(e) => { setQuery(e.target.value); setActive(-1); setOpen(true); }}
            onKeyDown={onKeyDown}
            className={cn(
              "h-14 w-full rounded-2xl pl-12 pr-28 text-base transition-colors focus:outline-none",
              inverse
                ? "border border-white/15 bg-white/10 text-white placeholder:text-white/55 focus:border-cyan focus:bg-white/15"
                : "border border-border bg-card text-foreground placeholder:text-text-secondary focus:border-brand",
            )}
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            Search
          </button>
        </div>
      </form>

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-float"
        >
          {!query && <li role="presentation" className="eyebrow px-3 pb-1 pt-2 text-text-secondary">Popular searches & categories</li>}
          {suggestions.map((s, i) => {
            const Icon = icon(s);
            return (
              <li
                key={`${s.kind}-${s.label}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => go(s)}
                className={cn(
                  "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-3 text-sm",
                  i === active ? "bg-surface-selected" : "hover:bg-surface-hover",
                )}
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0 text-text-secondary" />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="shrink-0 text-xs text-text-secondary">
                  {s.kind === "category" ? "Category" : s.kind === "product" ? "Product" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default HomeSearch;
