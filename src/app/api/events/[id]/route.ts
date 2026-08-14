import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/shared/supabase/server";
import { isSameOriginRequest, jsonError, readJsonOrMultipartFormData } from "@/shared/http";
import { updateEventOnServer } from "@/modules/events/serverMutations";
import { IMAGE_MAX_BYTES } from "@/modules/events";

// Same reasoning as POST /api/events — JSON after downscale, with legacy
// multipart still accepted. sharp still runs here.
export const runtime = "nodejs";

const MAX_MULTIPART_REQUEST_BYTES = IMAGE_MAX_BYTES + 64 * 1024;
const MAX_JSON_REQUEST_BYTES = Math.ceil((IMAGE_MAX_BYTES * 4) / 3) + 32 * 1024;

/**
 * The real edit logic (ownership check, validation, image processing,
 * storage upload/delete, update) lives in
 * `modules/events/serverMutations.ts`'s `updateEventOnServer` — this route
 * is the HTTP-layer adapter only.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await context.params;

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
    return jsonError("You must be signed in to edit an event.", 401);
  }

  const result = await updateEventOnServer(user.id, eventId, parsed.formData);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ id: result.data.id }, { status: 200 });
}
