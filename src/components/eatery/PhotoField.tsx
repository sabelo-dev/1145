import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { EATERY_IMAGE_ACCEPT, uploadEateryImage } from "@/lib/eateryImages";
import { cn } from "@/lib/utils";

interface PhotoFieldProps {
  id: string;
  label: string;
  /** The photo's address, or "" for none. */
  value: string;
  onChange: (url: string) => void;
  kind: "menu" | "logo" | "cover";
  hint?: string;
  /** Preview shape: square for menu items and logos, wide for covers. */
  shape?: "square" | "wide";
  /** Lets the parent block saving while a photo is still uploading. */
  onBusyChange?: (busy: boolean) => void;
}

/** A photo you can upload from your device (or camera on a phone), with a paste-a-link fallback. */
const PhotoField: React.FC<PhotoFieldProps> = ({ id, label, value, onChange, kind, hint, shape = "square", onBusyChange }) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file || !user) return;
    setError(null);
    setUploading(true);
    onBusyChange?.(true);
    try {
      onChange(await uploadEateryImage(user.id, file, kind));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo. Please try again.");
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  };

  return (
    <div>
      <Label htmlFor={`${id}-file`}>{label}</Label>
      <div className="mt-1.5 flex items-start gap-3">
        <div className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-muted text-text-secondary",
          shape === "wide" ? "h-20 w-36" : "h-20 w-20",
        )}>
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            : value ? <img src={value} alt="Current photo" className="h-full w-full object-cover" />
              : <ImagePlus className="h-6 w-6" aria-hidden />}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef} id={`${id}-file`} type="file" accept={EATERY_IMAGE_ACCEPT} className="sr-only"
              aria-describedby={`${id}-help`}
              onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; void pick(file); }}
            />
            <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
              {uploading ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
            </Button>
            {value && !uploading && (
              <Button type="button" variant="ghost" onClick={() => { onChange(""); setError(null); }}>
                <Trash2 aria-hidden /> Remove
              </Button>
            )}
          </div>
          <p id={`${id}-help`} className="text-xs text-text-secondary">
            {hint ? `${hint} ` : ""}JPEG, PNG or WebP. Large photos are resized automatically.{" "}
            {!showLink && (
              <button type="button" className="min-h-0 font-medium text-foreground underline underline-offset-4" onClick={() => setShowLink(true)}>
                Use a link instead
              </button>
            )}
          </p>
          {showLink && (
            <Input
              id={`${id}-link`} type="url" inputMode="url" placeholder="https://…" aria-label={`${label}: photo link`}
              value={value} onChange={(e) => onChange(e.target.value)} className="h-11"
            />
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default PhotoField;
