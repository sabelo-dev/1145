import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from "react";
import { CartItem, Cart } from "@/types";
import { useToast } from "@/components/ui/use-toast";

interface CartContextType {
  cart: Cart;
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  toggleCart: () => void;
  setCartOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Cart>(() => {
    const storedCart = localStorage.getItem("wweCart");
    return storedCart ? JSON.parse(storedCart) : { items: [], subtotal: 0 };
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { toast } = useToast();

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("wweCart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = useCallback((item: Omit<CartItem, "quantity">) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.items.findIndex(
        cartItem =>
          cartItem.productId === item.productId &&
          cartItem.variationId === item.variationId
      );

      let newItems;
      if (existingItemIndex > -1) {
        newItems = [...prevCart.items];
        newItems[existingItemIndex].quantity += 1;
      } else {
        newItems = [...prevCart.items, { ...item, quantity: 1 }];
      }

      const subtotal = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

      const displayName = item.variationAttributes
        ? `${item.name} (${Object.values(item.variationAttributes).join(', ')})`
        : item.name;

      toast({
        title: "Item Added",
        description: `${displayName} has been added to your cart.`,
      });

      return { items: newItems, subtotal };
    });
  }, [toast]);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prevCart => {
      const newItems = prevCart.items.filter(item => item.productId !== productId);
      const subtotal = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      return { items: newItems, subtotal };
    });

    toast({
      title: "Item Removed",
      description: "The item has been removed from your cart.",
    });
  }, [toast]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart => {
      const newItems = prevCart.items.map(item =>
        item.productId === productId ? { ...item, quantity } : item
      );
      const subtotal = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      return { items: newItems, subtotal };
    });
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart({ items: [], subtotal: 0 });
    toast({
      title: "Cart Cleared",
      description: "All items have been removed from your cart.",
    });
  }, [toast]);

  const toggleCart = useCallback(() => {
    setIsCartOpen(prev => !prev);
  }, []);

  const setCartOpen = useCallback((isOpen: boolean) => {
    setIsCartOpen(isOpen);
  }, []);

  const value = useMemo(() => ({
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    isCartOpen,
    setIsCartOpen,
    toggleCart,
    setCartOpen,
  }), [cart, addToCart, removeFromCart, updateQuantity, clearCart, isCartOpen, toggleCart, setCartOpen]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
