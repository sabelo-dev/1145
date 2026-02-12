import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, X } from "lucide-react";

interface ProductViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  product: any;
}

const ProductViewModal: React.FC<ProductViewModalProps> = ({
  isOpen,
  onClose,
  onEdit,
  product
}) => {
  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <DialogTitle className="text-2xl">{product.name}</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Product
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Images */}
          {product.product_images && product.product_images.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Images</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {product.product_images.map((image: any, index: number) => (
                  <img
                    key={image.id}
                    src={image.image_url}
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Product Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Basic Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="text-sm">{product.name}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">SKU</label>
                    <p className="text-sm">{product.sku || 'N/A'}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{product.category}</Badge>
                      {product.subcategory && (
                        <Badge variant="outline">{product.subcategory}</Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <Badge 
                        variant={
                          product.status === "approved" || product.status === "active" ? "default" :
                          product.status === "rejected" ? "destructive" :
                          "outline"
                        }
                      >
                        {product.status === "approved" ? "Active" : product.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Pricing & Inventory</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Price</label>
                    <p className="text-lg font-semibold">R{parseFloat(product.price).toFixed(2)}</p>
                  </div>

                  {product.compare_at_price && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Compare At Price</label>
                      <p className="text-sm line-through text-muted-foreground">
                        R{parseFloat(product.compare_at_price).toFixed(2)}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Quantity in Stock</label>
                    <p className="text-sm">
                      {product.quantity} units
                      {product.quantity === 0 && (
                        <Badge variant="destructive" className="ml-2">Out of Stock</Badge>
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Rating</label>
                    <p className="text-sm">
                      {product.rating ? `${product.rating}/5` : 'No ratings yet'}
                      {product.review_count > 0 && ` (${product.review_count} reviews)`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{product.description}</p>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <label className="font-medium">Created</label>
                <p>{new Date(product.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="font-medium">Last Updated</label>
                <p>{new Date(product.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductViewModal;