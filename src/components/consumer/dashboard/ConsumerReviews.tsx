
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, Edit, Trash2, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Review {
  id: string;
  product_id: string;
  productName: string;
  productImage: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  vendor: string;
  status: string;
}

const ConsumerReviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState("");
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) fetchReviews();
  }, [user?.id]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("reviews")
        .select(`*, products (name, slug, stores (name))`)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const productIds = data?.map(r => r.product_id) || [];
      const { data: images } = await supabase
        .from("product_images")
        .select("product_id, image_url")
        .in("product_id", productIds)
        .eq("position", 0);

      const imageMap = new Map(images?.map(img => [img.product_id, img.image_url]));

      setReviews(
        (data || []).map(review => ({
          id: review.id,
          product_id: review.product_id,
          productName: review.products?.name || "Unknown Product",
          productImage: imageMap.get(review.product_id) || "/placeholder.svg",
          rating: review.rating,
          title: review.comment?.split(".")[0] || "",
          comment: review.comment || "",
          date: new Date(review.created_at).toLocaleDateString(),
          vendor: review.products?.stores?.name || "Unknown Store",
          status: "published",
        }))
      );
    } catch (error) {
      console.error("Error fetching reviews:", error);
      toast({ title: "Error", description: "Failed to load reviews", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    try {
      const { error } = await supabase.from("reviews").delete().eq("id", reviewId).eq("user_id", user?.id);
      if (error) throw error;
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      toast({ title: "Review deleted" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete review" });
    }
  };

  const handleEditReview = (review: Review) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditComment(review.comment);
  };

  const handleSaveEdit = async () => {
    if (!editingReview) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("reviews")
        .update({ rating: editRating, comment: editComment })
        .eq("id", editingReview.id)
        .eq("user_id", user?.id);
      if (error) throw error;
      toast({ title: "Review updated" });
      setEditingReview(null);
      fetchReviews();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to update review" });
    } finally {
      setSaving(false);
    }
  };

  const renderStars = (rating: number, interactive = false, onSelect?: (r: number) => void) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} ${interactive ? "cursor-pointer hover:text-yellow-400" : ""}`}
          onClick={() => interactive && onSelect?.(star)}
        />
      ))}
    </div>
  );

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Star className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No reviews yet</h3>
          <p className="text-muted-foreground text-center">Your submitted reviews will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          <span className="text-lg font-medium">My Reviews</span>
        </div>
        <span className="text-sm text-muted-foreground">{reviews.length} reviews written</span>
      </div>

      <div className="grid gap-4">
        {reviews.map(review => (
          <Card key={review.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <img src={review.productImage} alt={review.productName} className="w-16 h-16 object-cover rounded" />
                  <div>
                    <CardTitle className="text-lg">{review.productName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{review.vendor}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(review.rating)}
                      <span className="text-sm text-muted-foreground">• {review.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" /> View</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Review Details</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <img src={review.productImage} alt={review.productName} className="w-16 h-16 object-cover rounded" />
                          <div>
                            <h3 className="font-medium">{review.productName}</h3>
                            <p className="text-sm text-muted-foreground">{review.vendor}</p>
                            {renderStars(review.rating)}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" size="sm" onClick={() => handleEditReview(review)}>
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteReview(review.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Review Dialog */}
      <Dialog open={!!editingReview} onOpenChange={() => setEditingReview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Review</DialogTitle></DialogHeader>
          {editingReview && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img src={editingReview.productImage} alt={editingReview.productName} className="w-16 h-16 object-cover rounded" />
                <div>
                  <h3 className="font-medium">{editingReview.productName}</h3>
                  <p className="text-sm text-muted-foreground">{editingReview.vendor}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Rating</label>
                {renderStars(editRating, true, setEditRating)}
              </div>
              <div>
                <label className="text-sm font-medium">Comment</label>
                <Textarea value={editComment} onChange={e => setEditComment(e.target.value)} rows={4} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Update Review
                </Button>
                <Button variant="outline" onClick={() => setEditingReview(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsumerReviews;
