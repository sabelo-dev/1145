import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X, Plus, Trash2, GripVertical } from "lucide-react";
import { z } from "zod";
import { fetchCategories, fetchSubcategoriesByCategory } from "@/services/products";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  description: z.string().optional(),
  price: z.number().min(0.01, "Price must be greater than 0"),
  compareAtPrice: z.number().optional(),
  sku: z.string().optional(),
  quantity: z.number().min(0, "Quantity cannot be negative"),
  category: z.string().min(1, "Category is required"),
  subcategories: z.array(z.string()).optional(),
  productType: z.enum(['simple', 'variable', 'downloadable']),
});

const variationSchema = z.object({
  id: z.string(),
  attributes: z.record(z.string()),
  price: z.number().min(0.01, "Price must be greater than 0"),
  quantity: z.number().min(0, "Quantity cannot be negative"),
  sku: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface AttributeWithImage {
  name: string;
  value: string;
  image?: ImageWithPreview;
}

interface ProductVariation {
  id?: string;
  attributes: AttributeWithImage[];
  price: number;
  quantity: number;
  sku?: string;
  images?: ImageWithPreview[];
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: any;
  mode: "add" | "edit";
}

interface ImageWithPreview {
  file?: File;
  url: string;
  id?: string;
  position: number;
}

interface DownloadableFile {
  id?: string;
  file?: File;
  fileName: string;
  fileUrl?: string;
  fileSize?: number;
  downloadLimit?: number;
}

// Sortable Image Component
const SortableImageItem = ({ image, index, onRemove }: { 
  image: ImageWithPreview; 
  index: number; 
  onRemove: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `image-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="relative">
        <img
          src={image.url}
          alt="Product"
          className="w-full h-20 object-cover rounded border"
        />
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 bg-black/50 text-white p-1 rounded cursor-grab hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-3 w-3" />
        </div>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
  mode
}) => {
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    price: 0,
    compareAtPrice: undefined,
    sku: "",
    quantity: 0,
    category: "",
    subcategories: [],
    productType: 'simple',
  });
  
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [images, setImages] = useState<ImageWithPreview[]>([]);
  const [downloadableFiles, setDownloadableFiles] = useState<DownloadableFile[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Bulk variation generation
  const [attributeTypes, setAttributeTypes] = useState<Array<{ name: string; values: string[] }>>([]);
  const [showBulkGenerator, setShowBulkGenerator] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load ALL categories directly from database (vendor needs to see all categories)
  useEffect(() => {
    const loadCategories = async () => {
      try {
        console.log('Fetching categories for vendor product form...');
        // Fetch directly from database to ensure we get ALL active categories
        const { data: categoriesData, error } = await supabase
          .from('categories')
          .select(`
            id,
            name,
            slug,
            image_url
          `)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) {
          console.error('Error loading categories:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load categories.",
          });
          setCategories([]);
        } else {
          console.log('Categories loaded:', categoriesData);
          setCategories(categoriesData || []);
        }
      } catch (error) {
        console.error('Unexpected error loading categories:', error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };
    
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen, toast]);

  // Update subcategories when category changes
  useEffect(() => {
    const loadSubcategories = async () => {
      if (formData.category) {
        const selectedCategory = categories.find(cat => cat.name === formData.category);
        if (selectedCategory) {
          const subs = await fetchSubcategoriesByCategory(selectedCategory.id);
          setSubcategories(subs);
          
          // Reset subcategories if current selections are not valid for new category
          if (formData.subcategories && formData.subcategories.length > 0) {
            const validSubcategories = formData.subcategories.filter(
              (subcat: string) => subs.some((sub: any) => sub.name === subcat)
            );
            setFormData(prev => ({ ...prev, subcategories: validSubcategories }));
          }
        }
      } else {
        setSubcategories([]);
        setFormData(prev => ({ ...prev, subcategories: [] }));
      }
    };

    loadSubcategories();
  }, [formData.category, categories]);

  useEffect(() => {
    if (product && mode === "edit") {
      // Parse subcategories - it might be stored as comma-separated string or array
      let subcategoriesArray: string[] = [];
      if (product.subcategory) {
        if (Array.isArray(product.subcategory)) {
          subcategoriesArray = product.subcategory;
        } else if (typeof product.subcategory === 'string') {
          subcategoriesArray = product.subcategory.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: parseFloat(product.price) || 0,
        compareAtPrice: product.compare_at_price ? parseFloat(product.compare_at_price) : undefined,
        sku: product.sku || "",
        quantity: product.quantity || 0,
        category: product.category || "",
        subcategories: subcategoriesArray,
        productType: product.product_type || 'simple',
      });
      
      // Load existing images
      const existingImages: ImageWithPreview[] = (product.product_images || []).map((img: any, index: number) => ({
        url: img.image_url,
        id: img.id,
        position: index,
      }));
      setImages(existingImages);

      // Load existing variations (if any)
      // This would require fetching from product_variations table
      // For now, we'll start with empty variations
      setVariations([]);
    } else {
      // Reset form for add mode
      setFormData({
        name: "",
        description: "",
        price: 0,
        compareAtPrice: undefined,
        sku: "",
        quantity: 0,
        category: "",
        subcategories: [],
        productType: 'simple',
      });
      setImages([]);
      setVariations([]);
      setDownloadableFiles([]);
    }
    setErrors({});
  }, [product, mode, isOpen]);

  const handleInputChange = (field: keyof ProductFormData, value: string | number | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const toggleSubcategory = (subcategoryName: string) => {
    setFormData(prev => {
      const currentSubcategories = prev.subcategories || [];
      const isSelected = currentSubcategories.includes(subcategoryName);
      
      return {
        ...prev,
        subcategories: isSelected
          ? currentSubcategories.filter(s => s !== subcategoryName)
          : [...currentSubcategories, subcategoryName]
      };
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newImages: ImageWithPreview[] = newFiles.map((file, index) => ({
        file,
        url: URL.createObjectURL(file),
        position: images.length + index,
      }));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = async (index: number) => {
    const image = images[index];
    
    // If it's an existing image, delete from database
    if (image.id) {
      try {
        const { error } = await supabase
          .from('product_images')
          .delete()
          .eq('id', image.id);

        if (error) throw error;

        toast({
          title: "Image Removed",
          description: "Product image has been removed successfully.",
        });
      } catch (error) {
        console.error('Error removing image:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to remove image.",
        });
        return;
      }
    }

    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item, index) => `image-${index}` === active.id);
        const newIndex = items.findIndex((item, index) => `image-${index}` === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Variation management functions
  const addVariation = () => {
    const newVariation: ProductVariation = {
      id: `temp-${Date.now()}`,
      attributes: [],
      price: formData.price,
      quantity: 0,
      sku: "",
      images: [],
    };
    setVariations(prev => [...prev, newVariation]);
  };

  const removeVariation = (index: number) => {
    setVariations(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariation = (index: number, field: keyof ProductVariation, value: any) => {
    setVariations(prev => 
      prev.map((variation, i) => 
        i === index ? { ...variation, [field]: value } : variation
      )
    );
  };

  // Downloadable file management
  const addDownloadableFile = () => {
    setDownloadableFiles(prev => [...prev, { fileName: '', downloadLimit: undefined }]);
  };

  const removeDownloadableFile = (index: number) => {
    setDownloadableFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateDownloadableFile = (index: number, field: keyof DownloadableFile, value: any) => {
    setDownloadableFiles(prev =>
      prev.map((file, i) =>
        i === index ? { ...file, [field]: value } : file
      )
    );
  };

  const handleDownloadableFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDownloadableFiles(prev =>
        prev.map((downloadFile, i) =>
          i === index
            ? {
                ...downloadFile,
                file,
                fileName: file.name,
                fileSize: file.size,
              }
            : downloadFile
        )
      );
    }
  };

  const addVariationAttribute = (variationIndex: number) => {
    setVariations(prev => 
      prev.map((variation, i) => 
        i === variationIndex 
          ? { 
              ...variation, 
              attributes: [...variation.attributes, { name: '', value: '', image: undefined }]
            } 
          : variation
      )
    );
  };

  const updateVariationAttribute = (variationIndex: number, attrIndex: number, field: keyof AttributeWithImage, value: any) => {
    setVariations(prev => 
      prev.map((variation, i) => 
        i === variationIndex 
          ? {
              ...variation,
              attributes: variation.attributes.map((attr, ai) =>
                ai === attrIndex ? { ...attr, [field]: value } : attr
              )
            }
          : variation
      )
    );
  };

  const removeVariationAttribute = (variationIndex: number, attrIndex: number) => {
    setVariations(prev => 
      prev.map((variation, i) => 
        i === variationIndex 
          ? { 
              ...variation, 
              attributes: variation.attributes.filter((_, ai) => ai !== attrIndex)
            } 
          : variation
      )
    );
  };

  const handleAttributeImageChange = (variationIndex: number, attrIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newImage: ImageWithPreview = {
        file,
        url: URL.createObjectURL(file),
        position: 0,
      };
      updateVariationAttribute(variationIndex, attrIndex, 'image', newImage);
    }
  };

  const removeAttributeImage = (variationIndex: number, attrIndex: number) => {
    updateVariationAttribute(variationIndex, attrIndex, 'image', undefined);
  };

  const handleVariationImageChange = (variationIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newImages: ImageWithPreview[] = newFiles.map((file, index) => ({
        file,
        url: URL.createObjectURL(file),
        position: (variations[variationIndex].images?.length || 0) + index,
      }));
      
      const updatedVariations = [...variations];
      updatedVariations[variationIndex] = {
        ...updatedVariations[variationIndex],
        images: [...(updatedVariations[variationIndex].images || []), ...newImages]
      };
      setVariations(updatedVariations);
    }
  };

  const removeVariationImage = (variationIndex: number, imageIndex: number) => {
    const updatedVariations = [...variations];
    const currentImages = updatedVariations[variationIndex].images || [];
    updatedVariations[variationIndex] = {
      ...updatedVariations[variationIndex],
      images: currentImages.filter((_, index) => index !== imageIndex)
    };
    setVariations(updatedVariations);
  };

  // Bulk variation generation functions
  const addAttributeType = () => {
    setAttributeTypes(prev => [...prev, { name: '', values: [] }]);
  };

  const removeAttributeType = (index: number) => {
    setAttributeTypes(prev => prev.filter((_, i) => i !== index));
  };

  const updateAttributeTypeName = (index: number, name: string) => {
    setAttributeTypes(prev => 
      prev.map((type, i) => i === index ? { ...type, name } : type)
    );
  };

  const updateAttributeTypeValues = (index: number, valuesString: string) => {
    const values = valuesString.split(',').map(v => v.trim()).filter(Boolean);
    setAttributeTypes(prev => 
      prev.map((type, i) => i === index ? { ...type, values } : type)
    );
  };

  const generateVariations = () => {
    // Filter out empty attribute types
    const validAttributes = attributeTypes.filter(
      type => type.name && type.values.length > 0
    );

    if (validAttributes.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please add at least one attribute type with values.",
      });
      return;
    }

    // Generate all combinations
    const generateCombinations = (attrs: typeof validAttributes): Array<Record<string, string>> => {
      if (attrs.length === 0) return [{}];
      
      const [first, ...rest] = attrs;
      const restCombinations = generateCombinations(rest);
      
      const combinations: Array<Record<string, string>> = [];
      for (const value of first.values) {
        for (const combo of restCombinations) {
          combinations.push({ [first.name]: value, ...combo });
        }
      }
      
      return combinations;
    };

    const combinations = generateCombinations(validAttributes);
    
    // Create variations from combinations
    const newVariations: ProductVariation[] = combinations.map((combo, index) => ({
      id: `generated-${Date.now()}-${index}`,
      attributes: Object.entries(combo).map(([name, value]) => ({ name, value })),
      price: formData.price,
      quantity: 0,
      sku: "",
      images: [],
    }));

    setVariations(newVariations);
    setShowBulkGenerator(false);
    setAttributeTypes([]);
    
    toast({
      title: "Variations Generated",
      description: `Created ${newVariations.length} variations from your attribute combinations.`,
    });
  };

  const uploadImages = async (productId: string) => {
    const uploadPromises = images
      .filter(img => img.file) // Only upload new files
      .map(async (image, index) => {
        const fileExt = image.file!.name.split('.').pop();
        const fileName = `${productId}/${Date.now()}-${index}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(fileName, image.file!);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        // Save image record to database
        await supabase
          .from('product_images')
          .insert({
            product_id: productId,
            image_url: publicUrl,
            position: image.position,
          });
      });

    await Promise.all(uploadPromises);
  };

  const saveVariations = async (productId: string) => {
    if (variations.length === 0) return;

    // Delete existing variations if in edit mode
    if (mode === "edit") {
      await supabase
        .from('product_variations')
        .delete()
        .eq('product_id', productId);
    }

    // Create variations and handle their images
    for (const variation of variations) {
      if (variation.attributes.length > 0) {
        // Convert attributes array to object for storage and upload attribute images
        const attributesObject: Record<string, string> = {};
        const attributeImageUrls: Record<string, string> = {};
        
        for (const attr of variation.attributes) {
          if (attr.name && attr.value) {
            attributesObject[attr.name] = attr.value;
            
            // Upload attribute image if exists
            if (attr.image?.file) {
              const fileExt = attr.image.file.name.split('.').pop();
              const fileName = `attribute-images/${Date.now()}-${Math.random()}.${fileExt}`;
              
              const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, attr.image.file);

              if (!uploadError) {
                const { data: urlData } = supabase.storage
                  .from('product-images')
                  .getPublicUrl(fileName);
                
                attributeImageUrls[attr.name] = urlData.publicUrl;
              }
            }
          }
        }

        const { data: variationResult, error: variationError } = await supabase
          .from('product_variations')
          .insert({
            product_id: productId,
            attributes: { ...attributesObject, _images: attributeImageUrls },
            price: variation.price,
            quantity: variation.quantity,
            sku: variation.sku
          })
          .select()
          .single();

        if (variationError) {
          console.error('Error creating variation:', variationError);
          continue;
        }

        // Handle variation gallery images
        if (variation.images && variation.images.length > 0) {
          for (let i = 0; i < variation.images.length; i++) {
            const image = variation.images[i];
            if (image.file) {
              const fileExt = image.file.name.split('.').pop();
              const fileName = `variation-images/${Date.now()}-${Math.random()}.${fileExt}`;
              const filePath = fileName;

              const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, image.file);

              if (uploadError) {
                console.error('Error uploading variation image:', uploadError);
                continue;
              }

              const { data: urlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

              // Save variation image record
              const { error: imageError } = await supabase
                .from('variation_images')
                .insert({
                  variation_id: variationResult.id,
                  image_url: urlData.publicUrl,
                  position: i
                });

              if (imageError) {
                console.error('Error saving variation image:', imageError);
              }
            }
          }
        }
      }
    }
  };

  const uploadDownloadableFiles = async (productId: string) => {
    for (const downloadFile of downloadableFiles) {
      if (downloadFile.file) {
        const fileExt = downloadFile.file.name.split('.').pop();
        const fileName = `downloadable-files/${Date.now()}-${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, downloadFile.file);

        if (uploadError) {
          console.error('Error uploading downloadable file:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        // Save downloadable file record
        const { error: fileError } = await supabase
          .from('downloadable_files')
          .insert({
            product_id: productId,
            file_name: downloadFile.fileName,
            file_url: urlData.publicUrl,
            file_size: downloadFile.fileSize,
            download_limit: downloadFile.downloadLimit,
          });

        if (fileError) {
          console.error('Error saving downloadable file:', fileError);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      // Validate form data
      const validatedData = productSchema.parse(formData);

      // Get vendor's store and info
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('id, business_name, stores(id)')
        .eq('user_id', user?.id)
        .single();

      if (vendorError) {
        throw new Error("Vendor profile not found. Please complete vendor registration first.");
      }

      let storeId = vendorData?.stores?.[0]?.id;

      // If no store exists, create one automatically
      if (!storeId) {
        const storeName = vendorData.business_name || 'My Store';
        const baseSlug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const uniqueSlug = `${baseSlug}-${Date.now()}`;

        const { data: newStore, error: storeError } = await supabase
          .from('stores')
          .insert({
            vendor_id: vendorData.id,
            name: storeName,
            slug: uniqueSlug,
            description: `Welcome to ${storeName}`,
          })
          .select('id')
          .single();

        if (storeError) {
          console.error('Error creating store:', storeError);
          throw new Error("Failed to create store. Please try again.");
        }

        storeId = newStore.id;
        toast({
          title: "Store Created",
          description: "A store has been automatically created for you.",
        });
      }

      if (mode === "add") {
        // Create new product with vendor tracking
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            store_id: storeId,
            name: validatedData.name,
            slug: validatedData.name.toLowerCase().replace(/\s+/g, '-'),
            description: validatedData.description,
            price: validatedData.price,
            compare_at_price: validatedData.compareAtPrice,
            sku: validatedData.sku,
            quantity: validatedData.quantity,
            category: validatedData.category,
            subcategory: validatedData.subcategories?.join(', ') || null,
            product_type: validatedData.productType,
            status: 'pending'
          })
          .select()
          .single();

        if (productError) throw productError;

        // Upload images, save variations, and handle downloadable files
        const tasks = [uploadImages(newProduct.id)];
        
        if (validatedData.productType === 'variable') {
          tasks.push(saveVariations(newProduct.id));
        }
        
        if (validatedData.productType === 'downloadable') {
          tasks.push(uploadDownloadableFiles(newProduct.id));
        }
        
        await Promise.all(tasks);

        toast({
          title: "Product Created",
          description: `Your product has been created by ${vendorData.business_name} and is pending approval.`,
        });
      } else {
        // Update existing product
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: validatedData.name,
            slug: validatedData.name.toLowerCase().replace(/\s+/g, '-'),
            description: validatedData.description,
            price: validatedData.price,
            compare_at_price: validatedData.compareAtPrice,
            sku: validatedData.sku,
            quantity: validatedData.quantity,
            category: validatedData.category,
            subcategory: validatedData.subcategories?.join(', ') || null,
            product_type: validatedData.productType,
          })
          .eq('id', product.id);

        if (updateError) throw updateError;

        // Upload new images, save variations, and handle downloadable files
        const tasks = [uploadImages(product.id)];
        
        if (validatedData.productType === 'variable') {
          tasks.push(saveVariations(product.id));
        }
        
        if (validatedData.productType === 'downloadable') {
          tasks.push(uploadDownloadableFiles(product.id));
        }
        
        await Promise.all(tasks);

        toast({
          title: "Product Updated",
          description: "Your product has been updated successfully.",
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving product:', error);
      
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0]] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to save product.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add New Product" : "Edit Product"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Type Selection */}
          <div className="space-y-2 border-b pb-4">
            <Label htmlFor="productType" className="text-base font-semibold">Product Type *</Label>
            <Select 
              value={formData.productType} 
              onValueChange={(value: 'simple' | 'variable' | 'downloadable') => handleInputChange("productType", value)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select product type" />
              </SelectTrigger>
              <SelectContent className="bg-background dark:bg-popover border border-border shadow-lg z-[9999]">
                <SelectItem value="simple" className="bg-background dark:bg-popover hover:bg-accent">
                  <div className="space-y-0.5">
                    <div className="font-semibold">Simple Product</div>
                    <div className="text-xs text-muted-foreground">Single SKU, fixed price, no variations</div>
                  </div>
                </SelectItem>
                <SelectItem value="variable" className="bg-background dark:bg-popover hover:bg-accent">
                  <div className="space-y-0.5">
                    <div className="font-semibold">Variable Product</div>
                    <div className="text-xs text-muted-foreground">Multiple variations (sizes, colors, etc.)</div>
                  </div>
                </SelectItem>
                <SelectItem value="downloadable" className="bg-background dark:bg-popover hover:bg-accent">
                  <div className="space-y-0.5">
                    <div className="font-semibold">Downloadable Product</div>
                    <div className="text-xs text-muted-foreground">Digital product with file downloads</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.productType && <p className="text-sm text-destructive">{errors.productType}</p>}
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter product name"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => handleInputChange("category", value)}
                disabled={loadingCategories}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={loadingCategories ? "Loading..." : "Select category"} />
                </SelectTrigger>
                <SelectContent className="bg-background dark:bg-popover border border-border shadow-lg z-[9999]">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name} className="bg-background dark:bg-popover hover:bg-accent">
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label>Subcategories (Select all that apply)</Label>
              {!formData.category ? (
                <p className="text-sm text-muted-foreground">Select a category first</p>
              ) : subcategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subcategories available</p>
              ) : (
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto bg-background">
                  {subcategories.map((subcategory) => (
                    <div key={subcategory.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`subcategory-${subcategory.id}`}
                        checked={formData.subcategories?.includes(subcategory.name) || false}
                        onCheckedChange={() => toggleSubcategory(subcategory.name)}
                      />
                      <label
                        htmlFor={`subcategory-${subcategory.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {subcategory.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {formData.subcategories && formData.subcategories.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Selected: {formData.subcategories.join(', ')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleInputChange("sku", e.target.value)}
                placeholder="Enter SKU (optional)"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter product description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (R) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => handleInputChange("price", parseFloat(e.target.value) || 0)}
              />
              {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="compareAtPrice">Compare At Price (R)</Label>
              <Input
                id="compareAtPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.compareAtPrice || ""}
                onChange={(e) => handleInputChange("compareAtPrice", parseFloat(e.target.value) || undefined)}
              />
            </div>

            {formData.productType !== 'downloadable' && (
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange("quantity", parseInt(e.target.value) || 0)}
                />
                {errors.quantity && <p className="text-sm text-destructive">{errors.quantity}</p>}
              </div>
            )}
          </div>

          {/* Product Variations - Only for Variable Products */}
          {formData.productType === 'variable' && (
            <div className="space-y-4 border-t pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-lg font-semibold">Product Variations</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add variations like sizes, colors, or styles. Each variation can have its own price, quantity, and images.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    onClick={() => setShowBulkGenerator(!showBulkGenerator)} 
                    variant="outline" 
                    size="sm"
                  >
                    {showBulkGenerator ? "Manual Mode" : "Bulk Generate"}
                  </Button>
                  <Button type="button" onClick={addVariation} variant="default" size="sm" className="shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Single
                  </Button>
                </div>
              </div>

              {/* Bulk Variation Generator */}
              {showBulkGenerator && (
                <div className="border-2 border-primary/20 rounded-lg p-6 space-y-4 bg-primary/5">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Bulk Variation Generator</h4>
                    <p className="text-sm text-muted-foreground">
                      Define attribute types and their values. We'll automatically create all combinations for you.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {attributeTypes.map((type, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-3 bg-background">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <Label className="text-sm">Attribute Name</Label>
                            <Input
                              placeholder="e.g., Color, Size, Material"
                              value={type.name}
                              onChange={(e) => updateAttributeTypeName(index, e.target.value)}
                            />
                          </div>
                          <div className="flex-[2] space-y-2">
                            <Label className="text-sm">Values (comma-separated)</Label>
                            <Input
                              placeholder="e.g., Red, Blue, Green"
                              value={type.values.join(', ')}
                              onChange={(e) => updateAttributeTypeValues(index, e.target.value)}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAttributeType(index)}
                            className="mt-7"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {type.values.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {type.values.map((value, vIndex) => (
                              <span key={vIndex} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                                {value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <Button
                      type="button"
                      onClick={addAttributeType}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Attribute Type
                    </Button>
                  </div>

                  {attributeTypes.length > 0 && (
                    <div className="pt-4 border-t space-y-2">
                      <div className="text-sm text-muted-foreground">
                        This will create{' '}
                        <span className="font-semibold text-foreground">
                          {attributeTypes.reduce((acc, type) => acc * (type.values.length || 1), 1)}
                        </span>{' '}
                        variation(s)
                      </div>
                      <Button
                        type="button"
                        onClick={generateVariations}
                        className="w-full"
                      >
                        Generate All Variations
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {variations.length === 0 && !showBulkGenerator && (
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No variations yet. Use "Bulk Generate" for multiple combinations or "Add Single" for individual variations.
                  </p>
                </div>
              )}
            </div>
            
            {variations.map((variation, variationIndex) => (
              <div key={variation.id} className="border-2 rounded-lg p-6 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-base">Variation {variationIndex + 1}</h4>
                    <p className="text-xs text-muted-foreground">
                      Define attributes like "Color: Red" or "Size: Large"
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeVariation(variationIndex)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>

                {/* Variation Attributes */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Attributes</Label>
                    <span className="text-xs text-muted-foreground">
                      Example: Color → Red, Size → Large
                    </span>
                  </div>
                  <div className="space-y-3">
                    {variation.attributes.map((attr, attrIndex) => (
                      <div key={attrIndex} className="border rounded p-3 space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Attribute name (e.g., Color)"
                            value={attr.name}
                            onChange={(e) => updateVariationAttribute(variationIndex, attrIndex, 'name', e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Attribute value (e.g., Red)"
                            value={attr.value}
                            onChange={(e) => updateVariationAttribute(variationIndex, attrIndex, 'value', e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeVariationAttribute(variationIndex, attrIndex)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* Attribute Image */}
                        <div className="space-y-2">
                          <Label className="text-sm">Attribute Image (optional)</Label>
                          <div className="flex gap-2 items-start">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleAttributeImageChange(variationIndex, attrIndex, e)}
                              className="flex-1"
                            />
                            {attr.image && (
                              <div className="relative">
                                <img
                                  src={attr.image.url}
                                  alt={`${attr.name} ${attr.value}`}
                                  className="w-16 h-16 object-cover rounded border"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0"
                                  onClick={() => removeAttributeImage(variationIndex, attrIndex)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addVariationAttribute(variationIndex)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Attribute
                    </Button>
                  </div>
                </div>

                {/* Variation Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Price (R)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={variation.price}
                      onChange={(e) => updateVariation(variationIndex, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={variation.quantity}
                      onChange={(e) => updateVariation(variationIndex, 'quantity', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input
                      value={variation.sku}
                      onChange={(e) => updateVariation(variationIndex, 'sku', e.target.value)}
                      placeholder="Variation SKU"
                    />
                  </div>
                </div>

                {/* Variation Gallery */}
                <div className="space-y-2">
                  <Label>Variation Gallery (Multiple Images)</Label>
                  <p className="text-sm text-muted-foreground">Add multiple images showcasing this variation</p>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleVariationImageChange(variationIndex, e)}
                      className="mb-4"
                    />
                    
                    {variation.images && variation.images.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {variation.images.map((image, imgIndex) => (
                          <div key={imgIndex} className="relative group">
                            <img
                              src={image.url}
                              alt={`Variation ${variationIndex + 1} gallery ${imgIndex + 1}`}
                              className="w-full h-24 object-cover rounded border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeVariationImage(variationIndex, imgIndex)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}

          {/* Downloadable Files - Only for Downloadable Products */}
          {formData.productType === 'downloadable' && (
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-lg font-semibold">Downloadable Files</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add files that customers can download after purchase
                  </p>
                </div>
                <Button type="button" onClick={addDownloadableFile} variant="default" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add File
                </Button>
              </div>

              {downloadableFiles.length === 0 && (
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No downloadable files yet. Click "Add File" to add files for download.
                  </p>
                </div>
              )}

              {downloadableFiles.map((file, index) => (
                <div key={index} className="border-2 rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">File {index + 1}</h4>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeDownloadableFile(index)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>File Name *</Label>
                      <Input
                        placeholder="e.g., eBook.pdf"
                        value={file.fileName}
                        onChange={(e) => updateDownloadableFile(index, 'fileName', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Download Limit (optional)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Leave empty for unlimited"
                        value={file.downloadLimit || ''}
                        onChange={(e) => updateDownloadableFile(index, 'downloadLimit', parseInt(e.target.value) || undefined)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Upload File *</Label>
                    <Input
                      type="file"
                      onChange={(e) => handleDownloadableFileChange(index, e)}
                      accept="*/*"
                    />
                    {file.file && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {file.fileName} ({(file.fileSize! / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Image Gallery */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Product Images</Label>
            
            <div className="space-y-2">
              <Label htmlFor="images">Add Images</Label>
              <Input
                id="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>

            {images.length > 0 && (
              <div className="space-y-2">
                <Label>Image Gallery (Drag to reorder)</Label>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={images.map((_, index) => `image-${index}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="grid grid-cols-4 gap-4">
                      {images.map((image, index) => (
                        <SortableImageItem
                          key={`image-${index}`}
                          image={image}
                          index={index}
                          onRemove={() => removeImage(index)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "add" ? "Create Product" : "Update Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFormModal;