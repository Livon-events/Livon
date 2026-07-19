type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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
 * The route handler (src/app/api/profile/route.ts) is the authoritative
 * validation boundary; this function does no validation of its own beyond
 * shaping the request.
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
