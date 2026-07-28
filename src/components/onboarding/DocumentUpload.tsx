import React, { useRef, useState } from "react";
import { Upload, FileCheck2, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  bucket: string;
  folder: string; // e.g. `${userId}/id-front`
  value?: string; // stored path
  onChange: (path: string | undefined) => void;
  accept?: string;
  maxMb?: number;
}

const DocumentUpload: React.FC<Props> = ({
  label,
  bucket,
  folder,
  value,
  onChange,
  accept = "image/*,application/pdf",
  maxMb = 5,
}) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > maxMb * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: `Max ${maxMb} MB` });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${folder}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      onChange(path);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border-2 border-dashed p-4 transition-colors",
          value ? "border-emerald-500/60 bg-emerald-500/5" : "border-border bg-muted/30"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {value ? (
            <FileCheck2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm truncate">
            {value ? value.split("/").pop() : `Upload ${label.toLowerCase()} (max ${maxMb} MB)`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {value && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(undefined)}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant={value ? "outline" : "default"}
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : value ? "Replace" : "Choose file"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    </div>
  );
};

export default DocumentUpload;
