/**
 * Browser-only bandwidth optimization for image uploads.
 *
 * This is not a security boundary. The server still sniffs bytes, enforces
 * the decompression-bomb budget, strips EXIF, and re-encodes with sharp
 * (`modules/events/images.ts`, `modules/users/images.ts`). A failed
 * optimization must never become a failed publish — every error path
 * returns the original `file` unchanged.
 */

export type DownscaleOptions = {
  /** Longest edge in px. Events: 1600 (matches server OUTPUT_MAX_*). */
  maxEdge: number;
  /** 0–1. 0.9 leaves headroom for the server's WebP re-encode. */
  quality: number;
  /** Skip the re-encode when the file is already this small (and within maxEdge). */
  skipUnderBytes: number;
};

const JPEG_FALLBACK_QUALITY = 0.85;

export async function downscaleImageInBrowser(
  file: File,
  options: DownscaleOptions
): Promise<File> {
  try {
    const result = await tryDownscale(file, options);
    return result ?? file;
  } catch {
    return file;
  }
}

async function tryDownscale(file: File, options: DownscaleOptions): Promise<File | null> {
  if (file.size <= 0) return null;

  const source = await decodeImage(file);
  if (!source) return null;

  try {
    const width = source.width;
    const height = source.height;
    if (!width || !height) return null;

    const longestEdge = Math.max(width, height);
    if (file.size <= options.skipUnderBytes && longestEdge <= options.maxEdge) {
      return null;
    }

    const scale = Math.min(1, options.maxEdge / longestEdge);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    const blob = await encodeCanvas(canvas, options.quality);
    if (!blob) return null;

    const name = replaceExtension(file.name, blob.type);
    return new File([blob], name, { type: blob.type, lastModified: Date.now() });
  } finally {
    if ("close" in source) {
      source.close();
    }
  }
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        // Fall through to <img>.
      }
    }
  }

  return decodeWithImgElement(file);
}

function decodeWithImgElement(file: File): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined" || typeof URL === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const cleanup = () => URL.revokeObjectURL(url);

    img.onload = () => {
      const finish = () => {
        cleanup();
        resolve(img);
      };
      if (typeof img.decode === "function") {
        img.decode().then(finish).catch(() => {
          cleanup();
          resolve(null);
        });
      } else {
        finish();
      }
    };
    img.onerror = () => {
      cleanup();
      resolve(null);
    };
    img.src = url;
  });
}

async function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  if (typeof canvas.toBlob !== "function") return null;

  const webp = await canvasToBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;

  // Older Safari/Android builds silently produce PNG (or an empty type)
  // when asked for WebP, which can be *larger* than the original. JPEG
  // is already in ALLOWED_IMAGE_MIME, so the server accepts it.
  const jpeg = await canvasToBlob(canvas, "image/jpeg", JPEG_FALLBACK_QUALITY);
  if (jpeg && jpeg.type === "image/jpeg") return jpeg;

  return null;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob && blob.size > 0 ? blob : null), type, quality);
  });
}

function replaceExtension(filename: string, mime: string): string {
  const ext = mime === "image/webp" ? "webp" : "jpg";
  const trimmed = filename.trim();
  const base = trimmed.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${ext}`;
}
