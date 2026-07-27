import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/shared/supabase/server";
import { isSameOriginRequest, isMultipartFormRequest, exceedsDeclaredContentLength, jsonError } from "@/shared/http";
import { applyProfileUpdate } from "@/modules/users/serverMutations";
import { AVATAR_MAX_BYTES } from "@/modules/users";

// This route can handle a multipart avatar upload — force the Node.js
// runtime (not Edge), which `sharp` requires anyway.
export const runtime = "nodejs";

/**
 * REQUIRED INFRA:
 *
 * 1. A Storage bucket named `avatars`, same shape as `event-covers`
 *    (src/app/api/events/route.ts):
 *    - Public read.
 *    - INSERT policy restricted to `authenticated`, scoped to the user's
 *      own folder.
 *
 * 2. `public.users` RLS — "Users can update own profile" (UPDATE, using +
 *    check `(select auth.uid()) = user_id`).
 *
 * The real update logic (validation, avatar processing, storage
 * upload/cleanup, DB update) lives in
 * `modules/users/serverMutations.ts`'s `applyProfileUpdate` — this route
 * is the HTTP-layer adapter only.
 */
const MAX_REQUEST_BYTES = AVATAR_MAX_BYTES + 32 * 1024;

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Request rejected.", 403);
  }

  if (!isMultipartFormRequest(request)) {
    return jsonError("Invalid request format.", 400);
  }

  if (exceedsDeclaredContentLength(request, MAX_REQUEST_BYTES)) {
    return jsonError("Request is too large.", 413);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("You must be signed in to edit your profile.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Could not read the submitted form.", 400);
  }

  const result = await applyProfileUpdate(user.id, formData);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({
    username: result.data.username,
    bio: result.data.bio,
    avatarUrl: result.data.avatarUrl,
  });
}
