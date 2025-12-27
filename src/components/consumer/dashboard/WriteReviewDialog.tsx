import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Package, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface OrderProduct {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
  product_id?: string;
}

interface WriteReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  products: OrderProduct[];
  onReviewSubmitted?: () => void;
}

interface ProductReview {
  product_id: string;
  rating: number;
  comment: string;
  submitted: boolean;
}

const WriteReviewDialog: React.FC<WriteReviewDialogProps> = ({
  open,
  onOpenChange,
  orderId,
  products,
  onReviewSubmitted,
}) => {
  const [productReviews, setProductReviews] = useState<ProductReview[]>([]);
  const [existingReviews, setExistingReviews] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open && products.length > 0) {
      fetchExistingReviews();
      initializeReviews();
    }
  }, [open, products]);

  const fetchExistingReviews = async () => {
    if (!user) return;
    
    const productIds = products.map(p => p.product_id || p.id);
    const { data } = await supabase
      .from('reviews')
      .select('product_id')
      .eq('user_id', user.id)
      .eq('order_id', orderId)
      .in('product_id', productIds);

    if (data) {
      setExistingReviews(new Set(data.map(r => r.product_id)));
    }
  };

  const initializeReviews = () => {
    setProductReviews(
      products.map((product) => ({
        product_id: product.product_id || product.id,
        rating: 0,
        comment: "",
        submitted: false,
      }))
    );
    setCurrentProductIndex(0);
  };

  const updateReview = (index: number, field: "rating" | "comment", value: number | string) => {
    setProductReviews((prev) =>
      prev.map((review, i) =>
        i === index ? { ...review, [field]: value } : review
      )
    );
  };

  const submitReview = async (index: number) => {
    const review = productReviews[index];
    const product = products[index];

    if (review.rating === 0) {
      toast({
        variant: "destructive",
        title: "Rating Required",
        description: "Please select a star rating before submitting.",
      });
      return;
    }

    if (!user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        user_id: user.id,
        product_id: review.product_id,
        order_id: orderId,
        rating: review.rating,
        comment: review.comment || null,
      });

      if (error) throw error;

      setProductReviews((prev) =>
        prev.map((r, i) => (i === index ? { ...r, submitted: true } : r))
      );

      toast({
        title: "Review Submitted",
        description: `Thank you for reviewing ${product.name}!`,
      });

      // Move to next unreviewed product
      const nextUnreviewed = productReviews.findIndex(
        (r, i) => i > index && !r.submitted && !existingReviews.has(r.product_id)
      );
      if (nextUnreviewed !== -1) {
        setCurrentProductIndex(nextUnreviewed);
      }

      onReviewSubmitted?.();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit review. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number, onSelect: (rating: number) => void) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onSelect(star)}
          className="p-1 transition-transform hover:scale-110"
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30 hover:text-yellow-400/50"
            }`}
          />
        </button>
      ))}
    </div>
  );

  const unreviewedProducts = products.filter(
    (p) => !existingReviews.has(p.product_id || p.id)
  );

  const allReviewed = unreviewedProducts.every((_, index) => {
    const review = productReviews.find(
      (r) => r.product_id === (unreviewedProducts[index]?.product_id || unreviewedProducts[index]?.id)
    );
    return review?.submitted || existingReviews.has(unreviewedProducts[index]?.product_id || unreviewedProducts[index]?.id);
  });

  if (unreviewedProducts.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>All Products Reviewed</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-muted-foreground">
              You've already reviewed all products from this order.
            </p>
            <Button className="mt-4" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const currentProduct = unreviewedProducts[currentProductIndex] || unreviewedProducts[0];
  const currentReviewIndex = products.findIndex(
    (p) => (p.product_id || p.id) === (currentProduct?.product_id || currentProduct?.id)
  );
  const currentReview = productReviews[currentReviewIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-400" />
            Write a Review
          </DialogTitle>
        </DialogHeader>

        {unreviewedProducts.length > 1 && (
          <div className="flex items-center gap-2 pb-2 border-b">
            <span className="text-sm text-muted-foreground">
              Product {currentProductIndex + 1} of {unreviewedProducts.length}
            </span>
            <div className="flex-1 flex gap-1">
              {unreviewedProducts.map((_, idx) => {
                const review = productReviews.find(
                  (r) => r.product_id === (unreviewedProducts[idx]?.product_id || unreviewedProducts[idx]?.id)
                );
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentProductIndex(idx)}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      review?.submitted
                        ? "bg-green-500"
                        : idx === currentProductIndex
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {currentProduct && currentReview && (
          <div className="space-y-5">
            {/* Product Info */}
            <div className="flex gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {currentProduct.image_url ? (
                  <img
                    src={currentProduct.image_url}
                    alt={currentProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{currentProduct.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Qty: {currentProduct.quantity} × R{currentProduct.price.toFixed(2)}
                </p>
              </div>
            </div>

            {currentReview.submitted ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="font-medium">Review Submitted!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Thank you for your feedback.
                </p>
              </div>
            ) : (
              <>
                {/* Rating */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your Rating</label>
                  <div className="flex items-center gap-3">
                    {renderStars(currentReview.rating, (rating) =>
                      updateReview(currentReviewIndex, "rating", rating)
                    )}
                    {currentReview.rating > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {currentReview.rating === 1 && "Poor"}
                        {currentReview.rating === 2 && "Fair"}
                        {currentReview.rating === 3 && "Good"}
                        {currentReview.rating === 4 && "Very Good"}
                        {currentReview.rating === 5 && "Excellent"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comment */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Your Review{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Textarea
                    placeholder="Share your experience with this product..."
                    value={currentReview.comment}
                    onChange={(e) =>
                      updateReview(currentReviewIndex, "comment", e.target.value)
                    }
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => submitReview(currentReviewIndex)}
                    disabled={submitting || currentReview.rating === 0}
                  >
                    {submitting ? "Submitting..." : "Submit Review"}
                  </Button>
                </div>
              </>
            )}

            {/* Navigation for multiple products */}
            {unreviewedProducts.length > 1 && currentReview.submitted && (
              <div className="flex justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentProductIndex((i) => Math.max(0, i - 1))}
                  disabled={currentProductIndex === 0}
                >
                  Previous
                </Button>
                {currentProductIndex < unreviewedProducts.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      setCurrentProductIndex((i) =>
                        Math.min(unreviewedProducts.length - 1, i + 1)
                      )
                    }
                  >
                    Next Product
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => onOpenChange(false)}>
                    Done
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WriteReviewDialog;
