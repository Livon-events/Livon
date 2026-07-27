import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/shared/supabase/server";
import { isSameOriginRequest, isMultipartFormRequest, exceedsDeclaredContentLength, jsonError } from "@/shared/http";
import { updateEventOnServer } from "@/modules/events/serverMutations";
import { IMAGE_MAX_BYTES } from "@/modules/events";

// Same reasoning as POST /api/events — a multipart upload needs the
// Node.js runtime for `sharp`.
export const runtime = "nodejs";

const MAX_REQUEST_BYTES = IMAGE_MAX_BYTES + 64 * 1024;

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
    return jsonError("You must be signed in to edit an event.", 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Could not read the submitted form.", 400);
  }

  const result = await updateEventOnServer(user.id, eventId, formData);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ id: result.data.id }, { status: 200 });
}
