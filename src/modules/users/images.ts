import sharp from "sharp";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_PIXELS,
} from "@/modules/users/validation";

export type ProcessedAvatarImage = {
  buffer: Buffer;
  contentType: "image/webp";
  extension: "webp";
};

export type ProcessAvatarImageResult =
  | { ok: true; data: ProcessedAvatarImage }
  | { ok: false; error: string };

const ALLOWED_DETECTED_FORMATS = new Set(["jpeg", "png", "webp"]);
const OUTPUT_SIZE = 400;

export async function processAvatarImage(file: File): Promise<ProcessAvatarImageResult> {
  // Size check happens before any decoding work — reject oversized payloads
  // as cheaply as possible so a hostile upload can't force expensive work.
  if (file.size <= 0) {
    return { ok: false, error: "The uploaded file is empty" };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: `Image must be ${Math.floor(AVATAR_MAX_BYTES / (1024 * 1024))}MB or smaller` };
  }

  let inputBuffer: Buffer;
  try {
    inputBuffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "Could not read the uploaded file" };
  }

  // Belt-and-braces: the browser-reported size should match the bytes we
  // actually received.
  if (inputBuffer.length !== file.size) {
    return { ok: false, error: "Upload was incomplete or corrupted" };
  }

  let format: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  try {
    // `failOn` intentionally left at its default (strictest) — sharp's own
    // docs recommend that for untrusted input. `limitInputPixels` overrides
    // sharp's built-in decompression-bomb guard with our own budget.
    const metadata = await sharp(inputBuffer, { limitInputPixels: AVATAR_MAX_PIXELS }).metadata();
    format = metadata.format;
    width = metadata.width;
    height = metadata.height;
  } catch {
    // One generic message for "not an image" / "corrupted" / "too many
    // pixels" — a malicious uploader shouldn't be able to fingerprint which.
    return { ok: false, error: "Could not read the image — it may be corrupted, too large, or an unsupported format" };
  }

  if (!format || !ALLOWED_DETECTED_FORMATS.has(format)) {
    return { ok: false, error: "Only JPEG, PNG, or WebP images are allowed" };
  }

  if (!width || !height || width > AVATAR_MAX_DIMENSION || height > AVATAR_MAX_DIMENSION) {
    return { ok: false, error: "Image dimensions are too large" };
  }

  try {
    const outputBuffer = await sharp(inputBuffer, { limitInputPixels: AVATAR_MAX_PIXELS })
      // Bakes in EXIF orientation as real pixels; the tag itself is then
      // dropped (we never call .withMetadata()).
      .rotate()
      // fit: "cover" + fixed width/height == center-crop to a 1:1 square,
      // then scale to exactly 400×400. withoutEnlargement is deliberately
      // omitted here (unlike eventCover.ts) — avatars must always end up
      // exactly 400×400 so every avatar in the app is a uniform size.
      .resize({
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 85 })
      .toBuffer();

    return {
      ok: true,
      data: { buffer: outputBuffer, contentType: "image/webp", extension: "webp" },
    };
  } catch {
    return { ok: false, error: "Could not process the uploaded image" };
  }
}
