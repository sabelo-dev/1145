import { supabase } from "./client";

export interface UploadFileToStorageOptions {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
  cacheControl?: string;
}

export interface UploadFileToStorageResult {
  publicUrl: string;
  path: string;
}

export const uploadFileToStorage = async ({
  bucket,
  path,
  file,
  upsert = false,
  cacheControl,
}: UploadFileToStorageOptions): Promise<UploadFileToStorageResult> => {
  const fileExt = file.name.split(".").pop() || "bin";
  const normalizedPath = path.endsWith(`.${fileExt}`) ? path : `${path}.${fileExt}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(normalizedPath, file, {
      upsert,
      cacheControl,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedPath);
  if (!data?.publicUrl) {
    throw new Error("Failed to generate public URL for uploaded file.");
  }

  return { publicUrl: data.publicUrl, path: normalizedPath };
};
