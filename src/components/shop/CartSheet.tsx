import React from "react";
import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { GoldPriceDisplay } from "@/components/gold";

interface CartSheetProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const CartSheet: React.FC<CartSheetProps> = ({ isOpen, setIsOpen }) => {
  const { cart, removeFromCart, updateQuantity, clearCart } = useCart();
  const { user } = useAuth();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center">
            <ShoppingBag className="mr-2" size={18} />
            Your Shopping Cart ({cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} items)
          </SheetTitle>
        </SheetHeader>

        {cart?.items?.length > 0 ? (
          <>
            <div className="flex-1 overflow-y-auto py-4">
              <ul className="space-y-4">
                {cart.items.map((item) => (
                  <li key={item.productId} className="flex items-center py-2 border-b">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover object-center"
                      />
                    </div>
                    <div className="ml-4 flex-1">
                      <h3 className="text-sm font-medium">{item.name}</h3>
                      <div className="text-sm font-semibold mt-1">
                        <GoldPriceDisplay price={item.price} size="sm" />
                      </div>
                      
                      <div className="flex items-center mt-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="mx-2 text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="ml-2 p-1 text-gray-400 hover:text-gray-700"
                    >
                      <X size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between items-center font-semibold">
                <span>Subtotal</span>
                <GoldPriceDisplay price={cart.subtotal || 0} size="md" />
              </div>
              <p className="text-sm text-gray-500">Shipping and taxes calculated at checkout</p>
              <div className="space-y-2">
                {user ? (
                  <Link to="/checkout" onClick={() => setIsOpen(false)}>
                    <Button className="w-full bg-wwe-navy hover:bg-wwe-navy/90">
                      Checkout
                    </Button>
                  </Link>
                ) : (
                  <Link to="/login" onClick={() => setIsOpen(false)}>
                    <Button className="w-full bg-wwe-navy hover:bg-wwe-navy/90">
                      Sign In to Checkout
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => clearCart()}
                >
                  Clear Cart
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
            <ShoppingBag size={64} className="text-gray-300" />
            <h3 className="font-medium text-lg">Your cart is empty</h3>
            <p className="text-gray-500 text-center">Looks like you haven't added any products to your cart yet.</p>
            <Button
              onClick={() => setIsOpen(false)}
              className="mt-4 bg-wwe-navy hover:bg-wwe-navy/90"
            >
              Continue Shopping
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartSheet;
