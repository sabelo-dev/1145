import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Trash2, 
  X, 
  Upload, 
  ChevronDown, 
  ChevronUp,
  Palette,
  Ruler,
  Package,
  Image as ImageIcon,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ColorImage {
  file?: File;
  url: string;
  position: number;
}

interface SizeVariant {
  id: string;
  size: string;
  quantity: number;
  sku: string;
  priceOverride?: number;
  useBasePrice: boolean;
}

interface ColorVariant {
  id: string;
  color: string;
  colorHex?: string;
  images: ColorImage[];
  sizes: SizeVariant[];
  isExpanded: boolean;
}

export interface StructuredVariation {
  id: string;
  color: string;
  colorHex?: string;
  size: string;
  quantity: number;
  sku: string;
  price: number;
  imageUrl?: string;
}

interface VariationBuilderProps {
  basePrice: number;
  variations: StructuredVariation[];
  onVariationsChange: (variations: StructuredVariation[]) => void;
}

// Common clothing sizes
const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const PRESET_SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

// Common colors with hex values
const PRESET_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Navy', hex: '#1a1a2e' },
  { name: 'Red', hex: '#e74c3c' },
  { name: 'Blue', hex: '#3498db' },
  { name: 'Green', hex: '#27ae60' },
  { name: 'Yellow', hex: '#f1c40f' },
  { name: 'Orange', hex: '#e67e22' },
  { name: 'Pink', hex: '#e91e63' },
  { name: 'Purple', hex: '#9b59b6' },
  { name: 'Grey', hex: '#95a5a6' },
  { name: 'Brown', hex: '#8b4513' },
  { name: 'Beige', hex: '#f5deb3' },
];

const VariationBuilder: React.FC<VariationBuilderProps> = ({
  basePrice,
  variations,
  onVariationsChange,
}) => {
  const [colorVariants, setColorVariants] = useState<ColorVariant[]>([]);
  const [sizePreset, setSizePreset] = useState<'clothing' | 'shoes' | 'custom'>('clothing');
  const [customSizes, setCustomSizes] = useState<string>('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Convert internal state to output variations whenever colorVariants changes
  React.useEffect(() => {
    const newVariations: StructuredVariation[] = [];
    
    colorVariants.forEach(colorVariant => {
      colorVariant.sizes.forEach(sizeVariant => {
        if (sizeVariant.quantity > 0 || sizeVariant.size) {
          newVariations.push({
            id: `${colorVariant.id}-${sizeVariant.id}`,
            color: colorVariant.color,
            colorHex: colorVariant.colorHex,
            size: sizeVariant.size,
            quantity: sizeVariant.quantity,
            sku: sizeVariant.sku,
            price: sizeVariant.useBasePrice ? basePrice : (sizeVariant.priceOverride || basePrice),
            imageUrl: colorVariant.images[0]?.url,
          });
        }
      });
    });
    
    onVariationsChange(newVariations);
  }, [colorVariants, basePrice, onVariationsChange]);

  const addColorVariant = (colorName?: string, colorHex?: string) => {
    const newColor: ColorVariant = {
      id: `color-${Date.now()}`,
      color: colorName || '',
      colorHex: colorHex || '',
      images: [],
      sizes: [],
      isExpanded: true,
    };
    setColorVariants(prev => [...prev, newColor]);
  };

  const removeColorVariant = (colorId: string) => {
    setColorVariants(prev => prev.filter(c => c.id !== colorId));
  };

  const updateColorVariant = (colorId: string, updates: Partial<ColorVariant>) => {
    setColorVariants(prev => 
      prev.map(c => c.id === colorId ? { ...c, ...updates } : c)
    );
  };

  const toggleColorExpanded = (colorId: string) => {
    setColorVariants(prev => 
      prev.map(c => c.id === colorId ? { ...c, isExpanded: !c.isExpanded } : c)
    );
  };

  const handleColorImageUpload = (colorId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newImages: ColorImage[] = newFiles.map((file, index) => ({
        file,
        url: URL.createObjectURL(file),
        position: index,
      }));
      
      setColorVariants(prev => 
        prev.map(c => c.id === colorId 
          ? { ...c, images: [...c.images, ...newImages] }
          : c
        )
      );
    }
  };

  const removeColorImage = (colorId: string, imageIndex: number) => {
    setColorVariants(prev => 
      prev.map(c => c.id === colorId 
        ? { ...c, images: c.images.filter((_, i) => i !== imageIndex) }
        : c
      )
    );
  };

  const addSizeToColor = (colorId: string, sizeName?: string) => {
    const newSize: SizeVariant = {
      id: `size-${Date.now()}-${Math.random()}`,
      size: sizeName || '',
      quantity: 0,
      sku: '',
      useBasePrice: true,
    };
    
    setColorVariants(prev => 
      prev.map(c => c.id === colorId 
        ? { ...c, sizes: [...c.sizes, newSize] }
        : c
      )
    );
  };

  const removeSizeFromColor = (colorId: string, sizeId: string) => {
    setColorVariants(prev => 
      prev.map(c => c.id === colorId 
        ? { ...c, sizes: c.sizes.filter(s => s.id !== sizeId) }
        : c
      )
    );
  };

  const updateSizeInColor = (colorId: string, sizeId: string, updates: Partial<SizeVariant>) => {
    setColorVariants(prev => 
      prev.map(c => c.id === colorId 
        ? { 
            ...c, 
            sizes: c.sizes.map(s => s.id === sizeId ? { ...s, ...updates } : s)
          }
        : c
      )
    );
  };

  const addAllSizesToColor = (colorId: string) => {
    const sizes = sizePreset === 'clothing' ? PRESET_SIZES 
      : sizePreset === 'shoes' ? PRESET_SHOE_SIZES
      : customSizes.split(',').map(s => s.trim()).filter(Boolean);
    
    const newSizes: SizeVariant[] = sizes.map((size, index) => ({
      id: `size-${Date.now()}-${index}`,
      size,
      quantity: 0,
      sku: '',
      useBasePrice: true,
    }));
    
    setColorVariants(prev => 
      prev.map(c => c.id === colorId 
        ? { ...c, sizes: [...c.sizes, ...newSizes] }
        : c
      )
    );
  };

  const getTotalStock = () => {
    return colorVariants.reduce((total, color) => 
      total + color.sizes.reduce((sizeTotal, size) => sizeTotal + size.quantity, 0), 0
    );
  };

  const getInStockVariations = () => {
    return colorVariants.reduce((total, color) => 
      total + color.sizes.filter(size => size.quantity > 0).length, 0
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Variation Builder
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add colors with images, then sizes under each color
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="font-bold text-lg">{colorVariants.length}</div>
            <div className="text-muted-foreground">Colors</div>
          </div>
          <Separator orientation="vertical" className="h-10" />
          <div className="text-center">
            <div className="font-bold text-lg">{getInStockVariations()}</div>
            <div className="text-muted-foreground">In Stock</div>
          </div>
          <Separator orientation="vertical" className="h-10" />
          <div className="text-center">
            <div className="font-bold text-lg">{getTotalStock()}</div>
            <div className="text-muted-foreground">Total Units</div>
          </div>
        </div>
      </div>

      {/* Size Preset Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Size Template
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sizePreset === 'clothing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSizePreset('clothing')}
            >
              Clothing (XS-3XL)
            </Button>
            <Button
              type="button"
              variant={sizePreset === 'shoes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSizePreset('shoes')}
            >
              Shoes (36-46)
            </Button>
            <Button
              type="button"
              variant={sizePreset === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSizePreset('custom')}
            >
              Custom
            </Button>
          </div>
          {sizePreset === 'custom' && (
            <div>
              <Label className="text-xs">Custom Sizes (comma-separated)</Label>
              <Input
                placeholder="e.g., One Size, Small, Medium, Large"
                value={customSizes}
                onChange={(e) => setCustomSizes(e.target.value)}
                className="mt-1"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {(sizePreset === 'clothing' ? PRESET_SIZES 
              : sizePreset === 'shoes' ? PRESET_SHOE_SIZES
              : customSizes.split(',').map(s => s.trim()).filter(Boolean)
            ).map(size => (
              <Badge key={size} variant="secondary" className="text-xs">
                {size}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Add Colors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Quick Add Colors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(color => {
              const isAdded = colorVariants.some(c => c.color.toLowerCase() === color.name.toLowerCase());
              return (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => !isAdded && addColorVariant(color.name, color.hex)}
                  disabled={isAdded}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all",
                    isAdded 
                      ? "opacity-50 cursor-not-allowed bg-muted" 
                      : "hover:border-primary hover:bg-primary/5 cursor-pointer"
                  )}
                >
                  <span 
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: color.hex }}
                  />
                  {color.name}
                  {isAdded && <Check className="h-3 w-3 text-green-500" />}
                </button>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addColorVariant()}
              className="rounded-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Custom Color
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Color Variants */}
      <div className="space-y-4">
        {colorVariants.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Palette className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h4 className="font-medium mb-1">No Colors Added</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Start by adding colors above. Each color can have its own images and sizes.
            </p>
          </div>
        ) : (
          colorVariants.map((colorVariant, colorIndex) => (
            <Card key={colorVariant.id} className="overflow-hidden">
              {/* Color Header */}
              <div 
                className="flex items-center justify-between p-4 bg-muted/50 cursor-pointer"
                onClick={() => toggleColorExpanded(colorVariant.id)}
              >
                <div className="flex items-center gap-3">
                  {colorVariant.colorHex ? (
                    <span 
                      className="w-8 h-8 rounded-full border-2"
                      style={{ backgroundColor: colorVariant.colorHex }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">
                      {colorVariant.color || `Color ${colorIndex + 1}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {colorVariant.sizes.length} sizes · {colorVariant.images.length} images · {colorVariant.sizes.reduce((t, s) => t + s.quantity, 0)} units
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeColorVariant(colorVariant.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                  {colorVariant.isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {colorVariant.isExpanded && (
                <CardContent className="pt-4 space-y-4">
                  {/* Color Name & Hex */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Color Name</Label>
                      <Input
                        placeholder="e.g., Midnight Blue"
                        value={colorVariant.color}
                        onChange={(e) => updateColorVariant(colorVariant.id, { color: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color Hex (optional)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={colorVariant.colorHex || '#000000'}
                          onChange={(e) => updateColorVariant(colorVariant.id, { colorHex: e.target.value })}
                          className="w-16 p-1 h-10"
                        />
                        <Input
                          placeholder="#000000"
                          value={colorVariant.colorHex || ''}
                          onChange={(e) => updateColorVariant(colorVariant.id, { colorHex: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Color Images */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Color Images
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current[colorVariant.id]?.click()}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload Images
                      </Button>
                      <input
                        ref={(el) => { fileInputRefs.current[colorVariant.id] = el; }}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleColorImageUpload(colorVariant.id, e)}
                      />
                    </div>
                    
                    {colorVariant.images.length === 0 ? (
                      <div 
                        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => fileInputRefs.current[colorVariant.id]?.click()}
                      >
                        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click to upload images for this color
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-6 gap-2">
                        {colorVariant.images.map((image, imgIndex) => (
                          <div key={imgIndex} className="relative group">
                            <img
                              src={image.url}
                              alt={`${colorVariant.color} ${imgIndex + 1}`}
                              className="w-full aspect-square object-cover rounded border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeColorImage(colorVariant.id, imgIndex)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            {imgIndex === 0 && (
                              <Badge className="absolute bottom-1 left-1 text-[10px] px-1">Main</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Sizes */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Sizes & Stock
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addAllSizesToColor(colorVariant.id)}
                        >
                          Add All Sizes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addSizeToColor(colorVariant.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Size
                        </Button>
                      </div>
                    </div>

                    {colorVariant.sizes.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                        No sizes added. Click "Add All Sizes" or "Add Size" above.
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Size</th>
                              <th className="text-left p-2 font-medium">Stock</th>
                              <th className="text-left p-2 font-medium">SKU</th>
                              <th className="text-left p-2 font-medium">Price</th>
                              <th className="w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {colorVariant.sizes.map((sizeVariant) => (
                              <tr key={sizeVariant.id} className="border-t">
                                <td className="p-2">
                                  <Input
                                    value={sizeVariant.size}
                                    onChange={(e) => updateSizeInColor(colorVariant.id, sizeVariant.id, { size: e.target.value })}
                                    placeholder="Size"
                                    className="h-8"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={sizeVariant.quantity}
                                    onChange={(e) => updateSizeInColor(colorVariant.id, sizeVariant.id, { quantity: parseInt(e.target.value) || 0 })}
                                    className="h-8 w-20"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    value={sizeVariant.sku}
                                    onChange={(e) => updateSizeInColor(colorVariant.id, sizeVariant.id, { sku: e.target.value })}
                                    placeholder="Auto"
                                    className="h-8"
                                  />
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={sizeVariant.useBasePrice}
                                      onCheckedChange={(checked) => updateSizeInColor(colorVariant.id, sizeVariant.id, { useBasePrice: !!checked })}
                                    />
                                    {sizeVariant.useBasePrice ? (
                                      <span className="text-muted-foreground">R{basePrice.toFixed(2)}</span>
                                    ) : (
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={sizeVariant.priceOverride || basePrice}
                                        onChange={(e) => updateSizeInColor(colorVariant.id, sizeVariant.id, { priceOverride: parseFloat(e.target.value) || 0 })}
                                        className="h-8 w-24"
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="p-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => removeSizeFromColor(colorVariant.id, sizeVariant.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Summary */}
      {colorVariants.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Variation Summary</div>
                <div className="text-sm text-muted-foreground">
                  {colorVariants.length} color{colorVariants.length !== 1 ? 's' : ''} × {' '}
                  {colorVariants.reduce((total, c) => total + c.sizes.length, 0)} size combinations
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{getTotalStock()}</div>
                <div className="text-sm text-muted-foreground">total units in stock</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VariationBuilder;
