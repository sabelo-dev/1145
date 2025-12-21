import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

interface AddressFormData {
  label: string;
  name: string;
  street: string;
  city: string;
  province: string;
  postal_code: string;
  phone: string;
  is_default: boolean;
}

interface Address {
  id: string;
  label: string;
  name: string;
  street: string;
  city: string;
  province: string;
  postal_code: string;
  phone: string | null;
  is_default: boolean;
}

interface AddressFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddressFormData) => Promise<void>;
  address?: Address | null;
  loading?: boolean;
}

const AddressFormDialog: React.FC<AddressFormDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  address,
  loading = false,
}) => {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<AddressFormData>({
    defaultValues: {
      label: "Home",
      name: "",
      street: "",
      city: "",
      province: "",
      postal_code: "",
      phone: "",
      is_default: false,
    },
  });

  const isDefault = watch("is_default");

  useEffect(() => {
    if (address) {
      reset({
        label: address.label,
        name: address.name,
        street: address.street,
        city: address.city,
        province: address.province,
        postal_code: address.postal_code,
        phone: address.phone || "",
        is_default: address.is_default,
      });
    } else {
      reset({
        label: "Home",
        name: "",
        street: "",
        city: "",
        province: "",
        postal_code: "",
        phone: "",
        is_default: false,
      });
    }
  }, [address, reset]);

  const handleFormSubmit = async (data: AddressFormData) => {
    await onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{address ? "Edit Address" : "Add New Address"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="label">Address Label</Label>
              <Input
                id="label"
                {...register("label", { required: "Label is required" })}
                placeholder="Home, Work, etc."
              />
              {errors.label && (
                <p className="text-sm text-destructive mt-1">{errors.label.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                {...register("name", { required: "Name is required" })}
                placeholder="John Doe"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              {...register("street", { required: "Street is required" })}
              placeholder="123 Main Street"
            />
            {errors.street && (
              <p className="text-sm text-destructive mt-1">{errors.street.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                {...register("city", { required: "City is required" })}
                placeholder="Cape Town"
              />
              {errors.city && (
                <p className="text-sm text-destructive mt-1">{errors.city.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="province">Province</Label>
              <Input
                id="province"
                {...register("province", { required: "Province is required" })}
                placeholder="Western Cape"
              />
              {errors.province && (
                <p className="text-sm text-destructive mt-1">{errors.province.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input
                id="postal_code"
                {...register("postal_code", { required: "Postal code is required" })}
                placeholder="8001"
              />
              {errors.postal_code && (
                <p className="text-sm text-destructive mt-1">{errors.postal_code.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="+27 123 456 7890"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_default"
              checked={isDefault}
              onCheckedChange={(checked) => setValue("is_default", checked as boolean)}
            />
            <Label htmlFor="is_default" className="cursor-pointer">
              Set as default address
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-wwe-navy hover:bg-wwe-navy/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {address ? "Update Address" : "Add Address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddressFormDialog;
