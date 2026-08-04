import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/shared/supabase/server";
import { isSameOriginRequest, isMultipartFormRequest, exceedsDeclaredContentLength, jsonError } from "@/shared/http";
import { createEventOnServer } from "@/modules/events/serverMutations";
import { IMAGE_MAX_BYTES } from "@/modules/events";

// This route handles a potentially large multipart upload — force the
// Node.js runtime (not Edge), which is required for `sharp` anyway.
export const runtime = "nodejs";

/**
 * REQUIRED INFRA:
 *
 * 1. A Storage bucket named `event-covers` — Storage policies live in the
 *    `storage` schema, separate from docs/db/rls-policies.md. Provision
 *    once:
 *    - Public read (event covers are shown on the public feed).
 *    - INSERT policy restricted to `authenticated`, scoped so a user may
 *      only write under their own folder:
 *        (bucket_id = 'event-covers')
 *        and (auth.uid()::text = (storage.foldername(name))[1])
 *
 * 2. `public.events` RLS — already confirmed in docs/db/rls-policies.md:
 *    "Authenticated users can create events" (INSERT, with check
 *    `organizer_id = (select auth.uid())`).
 *
 * The real create-event logic (validation, image processing, storage
 * upload, insert, rollback-on-failure) lives in
 * `modules/events/serverMutations.ts`'s `createEventOnServer` — this route
 * is just the HTTP-layer adapter: origin/content-type/size checks, auth,
 * then delegate.
 */
const MAX_REQUEST_BYTES = IMAGE_MAX_BYTES + 64 * 1024;

export async function POST(request: NextRequest) {
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
    return jsonError("You must be signed in to create an event.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Could not read the submitted form.", 400);
  }

  const result = await createEventOnServer(user.id, formData);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ id: result.data.id }, { status: 201 });
}
