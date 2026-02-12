import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

interface MerchantLoginFormData {
  email: string;
  password: string;
}

const MerchantLoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [localLoading, setLocalLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MerchantLoginFormData>();

  const onSubmit = async (data: MerchantLoginFormData) => {
    setLocalLoading(true);
    
    try {
      const result = await login(data.email, data.password);
      if (result?.redirectPath) {
        navigate(result.redirectPath);
      }
    } catch (error) {
      setLocalLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 shadow-md rounded-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            placeholder="merchant@example.com"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /\S+@\S+\.\S+/,
                message: "Please enter a valid email",
              },
            })}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register("password", { required: "Password is required" })}
          />
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || localLoading}>
          {isLoading || localLoading ? "Logging in..." : "Login as Merchant"}
        </Button>
      </form>
    </div>
  );
};

export default MerchantLoginForm;
