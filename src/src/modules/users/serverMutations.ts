import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/shared/supabase/server";
import { checkRateLimit } from "@/shared/security/rateLimit";
import { processAvatarImage } from "@/modules/users/images";
import { profileFieldsSchema } from "@/modules/users/validation";
import type { UpdateProfileData } from "@/modules/users/mutations";
import type { ServerMutationResult } from "@/shared/http";

/**
 * Server-only. Pulls in `sharp` (via processAvatarImage) — never import
 * this from a Client Component. This is the real logic that used to live
 * directly inside `src/app/api/profile/route.ts` — moved here during the
 * restructuring so the route handler itself can become a thin adapter.
 */

const STORAGE_BUCKET = "avatars";

function ownAvatarObjectPath(avatarUrl: string | null, userId: string): string | null {
  if (!avatarUrl) return null;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/${userId}/`;
  const idx = avatarUrl.indexOf(marker);
  if (idx === -1) return null;
  return avatarUrl.slice(idx + "/storage/v1/object/public/".length + STORAGE_BUCKET.length + 1);
}

export async function applyProfileUpdate(
  userId: string,
  formData: FormData
): Promise<ServerMutationResult<UpdateProfileData>> {
  const supabase = await createClient();

  if (
    !checkRateLimit(`update-profile:${userId}`, {
      maxRequests: 10,
      windowMs: 10 * 60 * 1000,
    })
  ) {
    return {
      ok: false,
      error: "Too many profile updates recently. Please try again later.",
      status: 429,
    };
  }

  const parsed = profileFieldsSchema.safeParse({
    // Always lowercased server-side too — the client already does this,
    // but this is the authoritative boundary, not the form.
    username: String(formData.get("username") ?? "").toLowerCase(),
    bio: String(formData.get("bio") ?? ""),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { ok: false, error: firstIssue?.message ?? "Invalid input.", status: 400 };
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
      return { ok: false, error: processed.error, status: 400 };
    }

    const objectPath = `${userId}/${randomUUID()}.${processed.data.extension}`;

    // IMPORTANT: pass a Uint8Array, not the raw Node Buffer, to
    // supabase-js's storage upload. Handing it a plain Buffer let it get
    // coerced through a lossy string/UTF-8 path somewhere in the
    // fetch/multipart layer, silently corrupting the binary image bytes
    // (every non-UTF8-valid byte got replaced with the UTF-8 "replacement
    // character", inflating and corrupting the file). Wrapping it as a
    // Uint8Array (a real binary view) forces the binary-safe path.
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, new Uint8Array(processed.data.buffer), {
        contentType: processed.data.contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("avatar upload failed:", uploadError.message);
      return { ok: false, error: "Could not upload the profile picture. Please try again.", status: 500 };
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
      .eq("user_id", userId)
      .single();
    previousAvatarUrl = existing?.avatar_url ?? null;
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("user_id", userId)
    .select("username, bio, avatar_url")
    .single();

  if (updateError) {
    if (uploadedObjectPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([uploadedObjectPath]).catch(() => {});
    }

    // Postgres unique_violation — the only realistic constraint this
    // update can hit is `users_username_key`.
    if (updateError.code === "23505") {
      return { ok: false, error: "That username is already taken.", status: 409 };
    }

    console.error("profile update failed:", updateError.message);
    return { ok: false, error: "Could not update your profile. Please try again.", status: 500 };
  }

  // Best-effort: remove the previous avatar object now that the new one is
  // live and the row committed. Never fails the request.
  if (uploadedObjectPath) {
    const oldPath = ownAvatarObjectPath(previousAvatarUrl, userId);
    if (oldPath && oldPath !== uploadedObjectPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([oldPath]).catch(() => {});
    }
  }

  return {
    ok: true,
    data: {
      username: updated.username,
      bio: updated.bio,
      avatarUrl: updated.avatar_url,
    },
  };
}
