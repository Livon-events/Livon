import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/shared/supabase/server";
import { isSameOriginRequest, jsonError, readJsonOrMultipartFormData } from "@/shared/http";
import { createEventOnServer } from "@/modules/events/serverMutations";
import { IMAGE_MAX_BYTES } from "@/modules/events";

// The current client sends JSON after browser downscale. Legacy multipart
// is still accepted. Either path reaches sharp here, so this stays on
// Node.js.
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
 * then delegate. The image still goes through the unchanged sharp pipeline
 * before anything is stored publicly.
 */
const MAX_MULTIPART_REQUEST_BYTES = IMAGE_MAX_BYTES + 64 * 1024;
const MAX_JSON_REQUEST_BYTES = Math.ceil((IMAGE_MAX_BYTES * 4) / 3) + 32 * 1024;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Request rejected.", 403);
  }

  const parsed = await readJsonOrMultipartFormData(request, {
    maxMultipartBytes: MAX_MULTIPART_REQUEST_BYTES,
    maxJsonBytes: MAX_JSON_REQUEST_BYTES,
    fileFields: { cover: { maxBytes: IMAGE_MAX_BYTES } },
  });
  if (!parsed.ok) {
    return jsonError(parsed.error, parsed.status);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("You must be signed in to create an event.", 401);
  }

  const result = await createEventOnServer(user.id, parsed.formData);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ id: result.data.id }, { status: 201 });
}
