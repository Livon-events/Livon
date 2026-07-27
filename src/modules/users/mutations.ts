import { createClient } from "@/shared/supabase/client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Client-safe users mutations — callable from Client Components. The real
 * profile-update logic (avatar processing via `sharp`) lives server-only
 * in `modules/users/serverMutations.ts`, imported only by
 * `app/api/profile/route.ts`; this file only ever talks to that route via
 * `fetch`, or writes directly to `users` for the location-preference case
 * (no image involved, safe to call from the browser).
 */

export type UpdateProfileInput = {
  username: string;
  bio: string;
  avatarFile?: File | null;
};

export type UpdateProfileData = {
  username: string;
  bio: string | null;
  avatarUrl: string | null;
};

/**
 * Submits the single edit surface (bio + username + optional avatar) from
 * docs/FR/user-profile-fr.md §4. Always sent as multipart/form-data so the
 * avatar file (when present) and the text fields travel in one request —
 * "no partial save — the whole edit form submits together" per the FR.
 *
 * `app/api/profile/route.ts` is the authoritative validation boundary;
 * this function does no validation of its own beyond shaping the request.
 */
export async function updateProfile(input: UpdateProfileInput): Promise<Result<UpdateProfileData>> {
  const formData = new FormData();
  formData.set("username", input.username.toLowerCase());
  formData.set("bio", input.bio);
  if (input.avatarFile) {
    formData.set("avatar", input.avatarFile);
  }

  let response: Response;
  try {
    response = await fetch("/api/profile", {
      method: "PATCH",
      body: formData,
    });
  } catch {
    return { ok: false, error: "Network error — please check your connection and try again." };
  }

  let body: { error?: string; username?: string; bio?: string | null; avatarUrl?: string | null };
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  if (!response.ok) {
    return { ok: false, error: body.error ?? "Something went wrong. Please try again." };
  }

  return {
    ok: true,
    data: {
      username: body.username ?? input.username,
      bio: body.bio ?? null,
      avatarUrl: body.avatarUrl ?? null,
    },
  };
}

/**
 * Persists the header's City/Area selection to the signed-in user's
 * account (`users.preferred_city_id` / `preferred_area_id`), per
 * docs/FR/location-toggle.md. `areaId: null` means "All Areas" for that
 * city — a legitimate value, not an error.
 *
 * RLS ("Users can update own profile": `auth.uid() = user_id`) already
 * scopes this to the caller's own row; `.eq("user_id", ...)` below is just
 * an explicit, defensive match rather than relying on RLS alone.
 */
export async function updateLocationPreference(input: {
  cityId: string;
  areaId: string | null;
}): Promise<Result> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { error } = await supabase
    .from("users")
    .update({ preferred_city_id: input.cityId, preferred_area_id: input.areaId })
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: undefined };
}
