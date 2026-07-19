import sharp from "sharp";
import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_MAX_PIXELS,
} from "@/lib/validation/eventCreation";

/**
 * Server-only. Never import this from a Client Component — it pulls in
 * `sharp`, which is a native module (see docs/FR/architecture.md: "Image
 * processing: sharp, server-side only").
 *
 * Validates an uploaded event-cover image and re-encodes it into a clean,
 * bounded WebP buffer. This is the ONLY thing that decides whether an
 * upload is really a JPEG/PNG/WebP — the browser-supplied `file.type` and
 * the original filename/extension are never trusted, since both are
 * trivially spoofable by the client. Detection is based on sharp/libvips
 * sniffing the actual file bytes.
 *
 * Re-encoding (rather than storing the original bytes) is deliberate and
 * covers several things at once:
 *  - Strips EXIF/ICC/XMP metadata (GPS tags, camera info, embedded
 *    comments) — sharp does not carry metadata through unless
 *    `.withMetadata()` is explicitly chained, which we don't do.
 *  - Neutralizes "polyglot" files (bytes that are simultaneously a valid
 *    image and valid HTML/JS/etc.) — the output is freshly generated
 *    pixel data, not a copy of the original bytes, so no leftover
 *    polyglot payload can survive into storage.
 *  - Normalizes output to a single format/content-type (WebP) regardless
 *    of which of the three accepted input formats was uploaded, so the
 *    rest of the app only ever deals with one cover-image content-type.
 *  - Bounds dimensions to a sane max, so a single huge upload can't blow
 *    out storage, bandwidth, or downstream `<Image>` rendering.
 */

export type ProcessedCoverImage = {
  buffer: Buffer;
  contentType: "image/webp";
  extension: "webp";
};

export type ProcessCoverImageResult =
  | { ok: true; data: ProcessedCoverImage }
  | { ok: false; error: string };

const ALLOWED_DETECTED_FORMATS = new Set(["jpeg", "png", "webp"]);

// Output is capped to a 16:9-ish bounding box — comfortably covers the
// aspect ratio used across the feed card / details card mockups, with no
// enlargement of smaller uploads.
const OUTPUT_MAX_WIDTH = 1600;
const OUTPUT_MAX_HEIGHT = 1600;

export async function processEventCoverImage(file: File): Promise<ProcessCoverImageResult> {
  // Size check happens before any decoding work — reject oversized payloads
  // as cheaply as possible so a hostile upload can't force expensive work.
  if (file.size <= 0) {
    return { ok: false, error: "The uploaded file is empty" };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, error: `Image must be ${Math.floor(IMAGE_MAX_BYTES / (1024 * 1024))}MB or smaller` };
  }

  let inputBuffer: Buffer;
  try {
    inputBuffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "Could not read the uploaded file" };
  }

  // Belt-and-braces: the browser-reported size should match the bytes we
  // actually received. A mismatch isn't exploitable by itself given the
  // check above already caps the real buffer, but it's a cheap signal of a
  // malformed/truncated upload worth rejecting outright.
  if (inputBuffer.length !== file.size) {
    return { ok: false, error: "Upload was incomplete or corrupted" };
  }

  let format: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  try {
    // `failOn` intentionally left at its default ("warning", the strictest
    // setting) — sharp's own docs recommend that default specifically for
    // untrusted input. `limitInputPixels` overrides sharp's already-present
    // decompression-bomb guard with our own (lower) budget.
    const metadata = await sharp(inputBuffer, { limitInputPixels: IMAGE_MAX_PIXELS }).metadata();
    format = metadata.format;
    width = metadata.width;
    height = metadata.height;
  } catch {
    // Covers: not an image at all, corrupted/truncated image data, or an
    // image that exceeds limitInputPixels (sharp throws for that too) —
    // deliberately one generic message for all three so a malicious
    // uploader can't use the error to fingerprint which check failed.
    return { ok: false, error: "Could not read the image — it may be corrupted, too large, or an unsupported format" };
  }

  if (!format || !ALLOWED_DETECTED_FORMATS.has(format)) {
    return { ok: false, error: "Only JPEG, PNG, or WebP images are allowed" };
  }

  if (
    !width ||
    !height ||
    width > IMAGE_MAX_DIMENSION ||
    height > IMAGE_MAX_DIMENSION
  ) {
    return { ok: false, error: "Image dimensions are too large" };
  }

  try {
    const outputBuffer = await sharp(inputBuffer, { limitInputPixels: IMAGE_MAX_PIXELS })
      // Bakes in the EXIF orientation as real pixels, then the EXIF tag
      // itself is dropped (we never call .withMetadata()).
      .rotate()
      .resize({
        width: OUTPUT_MAX_WIDTH,
        height: OUTPUT_MAX_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    return {
      ok: true,
      data: { buffer: outputBuffer, contentType: "image/webp", extension: "webp" },
    };
  } catch {
    return { ok: false, error: "Could not process the uploaded image" };
  }
}
