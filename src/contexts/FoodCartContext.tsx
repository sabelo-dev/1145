import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Eatery, MenuItem } from "@/types/food";

/** What the basket needs to remember about its eatery. */
export type BasketEatery = Pick<Eatery, "id" | "slug" | "name" | "delivery_fee" | "min_order">;

export interface BasketLine {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface FoodCartContextType {
  eatery: BasketEatery | null;
  lines: BasketLine[];
  itemCount: number;
  subtotal: number;
  /**
   * Adds one of the item. A basket holds one eatery at a time: if it already
   * has items from another eatery this returns false and changes nothing —
   * ask the customer, then call `startNewBasket`.
   */
  addItem: (eatery: BasketEatery, item: MenuItem) => boolean;
  startNewBasket: (eatery: BasketEatery, item: MenuItem) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  clear: () => void;
}

const STORAGE_KEY = "1145.food-basket";
const MAX_PER_ITEM = 20;

type Basket = { eatery: BasketEatery | null; lines: BasketLine[] };
const EMPTY: Basket = { eatery: null, lines: [] };

const readBasket = (): Basket => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.eatery?.id && Array.isArray(saved.lines)) return saved as Basket;
  } catch {
    // unreadable basket: start empty
  }
  return EMPTY;
};

const lineFor = (item: MenuItem): BasketLine => ({ menuItemId: item.id, name: item.name, price: item.price, quantity: 1 });
const slim = ({ id, slug, name, delivery_fee, min_order }: BasketEatery): BasketEatery => ({ id, slug, name, delivery_fee, min_order });

const FoodCartContext = createContext<FoodCartContextType | undefined>(undefined);

export const FoodCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [basket, setBasket] = useState<Basket>(readBasket);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
    } catch {
      // storage unavailable: the basket still works for this visit
    }
  }, [basket]);

  const addItem = useCallback((eatery: BasketEatery, item: MenuItem) => {
    if (basket.eatery && basket.eatery.id !== eatery.id && basket.lines.length > 0) return false;
    setBasket((prev) => {
      const existing = prev.lines.find((l) => l.menuItemId === item.id);
      const lines = existing
        ? prev.lines.map((l) => (l.menuItemId === item.id ? { ...l, quantity: Math.min(l.quantity + 1, MAX_PER_ITEM) } : l))
        : [...prev.lines, lineFor(item)];
      return { eatery: slim(eatery), lines };
    });
    return true;
  }, [basket.eatery, basket.lines.length]);

  const startNewBasket = useCallback((eatery: BasketEatery, item: MenuItem) => {
    setBasket({ eatery: slim(eatery), lines: [lineFor(item)] });
  }, []);

  const setQuantity = useCallback((menuItemId: string, quantity: number) => {
    setBasket((prev) => {
      const lines = prev.lines
        .map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: Math.min(Math.floor(quantity), MAX_PER_ITEM) } : l))
        .filter((l) => l.quantity > 0);
      return lines.length ? { ...prev, lines } : EMPTY;
    });
  }, []);

  const clear = useCallback(() => setBasket(EMPTY), []);

  const value = useMemo(() => ({
    eatery: basket.eatery,
    lines: basket.lines,
    itemCount: basket.lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal: Math.round(basket.lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100) / 100,
    addItem,
    startNewBasket,
    setQuantity,
    clear,
  }), [basket, addItem, startNewBasket, setQuantity, clear]);

  return <FoodCartContext.Provider value={value}>{children}</FoodCartContext.Provider>;
};

export function useFoodCart() {
  const context = useContext(FoodCartContext);
  if (!context) throw new Error("useFoodCart must be used within a FoodCartProvider");
  return context;
}
