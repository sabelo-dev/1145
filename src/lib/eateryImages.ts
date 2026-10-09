import { supabase } from "@/integrations/supabase/client";

const BUCKET = "eatery-images";
/** Longest side after resizing. Menu photos are shown small; this keeps uploads light on mobile data. */
const MAX_SIDE = 1400;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/** For the file picker. Phone cameras that save HEIC are converted to JPEG by the browser when picked. */
export const EATERY_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

/** Shrinks a photo to at most MAX_SIDE pixels and re-encodes it as JPEG. Falls back to the original if the browser can't. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    // Already small and light: keep it exactly as it is.
    if (scale === 1 && file.size <= 600 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG has no transparency: put transparent PNGs on white rather than black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/**
 * Uploads a photo for an eatery (menu item, logo or cover) and returns its public address.
 * Files go in the signed-in user's own folder; the storage rules allow nothing else.
 */
export async function uploadEateryImage(userId: string, file: File, kind: "menu" | "logo" | "cover"): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size > 20 * 1024 * 1024) throw new Error("That photo is too large. Choose one under 20 MB.");

  const image = await shrink(file);
  if (image.size > MAX_UPLOAD_BYTES) throw new Error("That photo is too large even after resizing. Try a smaller one.");

  const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${kind}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, image, {
    contentType: image.type || "image/jpeg",
    cacheControl: "31536000", // the name is unique, so it can be cached for a year
    upsert: false,
  });
  if (error) {
    throw new Error(/bucket/i.test(error.message)
      ? "Photo uploads aren't switched on yet. Paste a photo link instead, or try again later."
      : `Couldn't upload the photo: ${error.message}`);
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
