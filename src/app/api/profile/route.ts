import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { processAvatarImage } from "@/lib/images/avatar";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { profileFieldsSchema, AVATAR_MAX_BYTES } from "@/lib/validation/profile";

// This route can handle a multipart avatar upload — force the Node.js
// runtime (not Edge), which `sharp` requires anyway.
export const runtime = "nodejs";

/**
 * REQUIRED INFRA:
 *
 * 1. A Storage bucket named `avatars` (Storage policies live in the
 *    `storage` schema, separate from docs/db/rls-policies.md). Provision
 *    once, same shape as the `event-covers` bucket (src/app/api/events/route.ts):
 *    - Public read (avatars are shown on public-facing profile pages).
 *    - INSERT policy restricted to `authenticated`, scoped to the user's
 *      own folder:
 *        (bucket_id = 'avatars')
 *        and (auth.uid()::text = (storage.foldername(name))[1])
 *    - No UPDATE policy needed — this route always writes a fresh,
 *      randomly-named object and deletes the old one itself afterward.
 *
 * 2. `public.users` RLS — already confirmed in docs/db/rls-policies.md:
 *    "Users can update own profile" (UPDATE, using + check
 *    `(select auth.uid()) = user_id`), which is exactly what this route
 *    relies on — no further policy work needed here.
 */
const STORAGE_BUCKET = "avatars";

// Rough ceiling for the whole multipart request (image + text fields +
// multipart framing overhead). Cheap pre-check on declared Content-Length;
// the authoritative size check still happens in processAvatarImage.
const MAX_REQUEST_BYTES = AVATAR_MAX_BYTES + 32 * 1024;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Best-effort same-origin check as defense-in-depth against CSRF — mirrors
 * src/app/api/events/route.ts.
 */
function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

// Extracts the storage object path from a previously-uploaded avatar's
// public URL, but only when it actually lives in our own `avatars` bucket
// and under this user's own folder — never trust/derive a delete target
// from anything else (e.g. a Google OAuth avatar URL, or another bucket).
function ownAvatarObjectPath(avatarUrl: string | null, userId: string): string | null {
  if (!avatarUrl) return null;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/${userId}/`;
  const idx = avatarUrl.indexOf(marker);
  if (idx === -1) return null;
  return avatarUrl.slice(idx + "/storage/v1/object/public/".length + STORAGE_BUCKET.length + 1);
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Request rejected.", 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return jsonError("Invalid request format.", 400);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) {
    return jsonError("Request is too large.", 413);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("You must be signed in to edit your profile.", 401);
  }

  if (
    !checkRateLimit(`update-profile:${user.id}`, {
      maxRequests: 10,
      windowMs: 10 * 60 * 1000,
    })
  ) {
    return jsonError("Too many profile updates recently. Please try again later.", 429);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Could not read the submitted form.", 400);
  }

  const parsed = profileFieldsSchema.safeParse({
    // Always lowercased server-side too — the client already does this,
    // but this route is the authoritative boundary, not the form.
    username: String(formData.get("username") ?? "").toLowerCase(),
    bio: String(formData.get("bio") ?? ""),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return jsonError(firstIssue?.message ?? "Invalid input.", 400);
  }

  const { username, bio } = parsed.data;

  const updatePayload: Record<string, string | null> = {
    username,
    bio: bio.length > 0 ? bio : null,
  };

  let uploadedObjectPath: string | null = null;
  let previousAvatarUrl: string | null = null;

  const avatarEntry = formData.get("avatar");
  if (avatarEntry instanceof File && avatarEntry.size > 0) {
    const processed = await processAvatarImage(avatarEntry);
    if (!processed.ok) {
      return jsonError(processed.error, 400);
    }

    // Random, server-generated path — never derived from the user-supplied
    // filename.
    const objectPath = `${user.id}/${randomUUID()}.${processed.data.extension}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, processed.data.buffer, {
        contentType: processed.data.contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("avatar upload failed:", uploadError.message);
      return jsonError("Could not upload the profile picture. Please try again.", 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
    updatePayload.avatar_url = publicUrl;
    uploadedObjectPath = objectPath;

    // Fetch the current avatar_url so we can clean up the old object after
    // a successful update — best-effort only, never blocks the response.
    const { data: existing } = await supabase
      .from("users")
      .select("avatar_url")
      .eq("user_id", user.id)
      .single();
    previousAvatarUrl = existing?.avatar_url ?? null;
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("user_id", user.id)
    .select("username, bio, avatar_url")
    .single();

  if (updateError) {
    // Cleanup an orphaned upload if the row update itself failed.
    if (uploadedObjectPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([uploadedObjectPath]).catch(() => {});
    }

    // Postgres unique_violation — the only realistic constraint this
    // update can hit is `users_username_key`.
    if (updateError.code === "23505") {
      return jsonError("That username is already taken.", 409);
    }

    console.error("profile update failed:", updateError.message);
    return jsonError("Could not update your profile. Please try again.", 500);
  }

  // Best-effort: remove the previous avatar object now that the new one is
  // live and the row committed. Never fails the request.
  if (uploadedObjectPath) {
    const oldPath = ownAvatarObjectPath(previousAvatarUrl, user.id);
    if (oldPath && oldPath !== uploadedObjectPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([oldPath]).catch(() => {});
    }
  }

  return NextResponse.json({
    username: updated.username,
    bio: updated.bio,
    avatarUrl: updated.avatar_url,
  });
}
