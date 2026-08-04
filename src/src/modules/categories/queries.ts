import "server-only";
import { createClient } from "@/shared/supabase/server";

export type Category = {
  id: string;
  name: string;
  defaultCoverImageUrl: string | null;
};

/**
 * All categories, for the CategorySelector filter bar and the
 * event-creation category picker. Small, static-ish reference table —
 * fine to fetch on every request for now.
 *
 * `defaultCoverImageUrl` is read here (not just `id`/`name`) because
 * `events.cover_image_url` is `NOT NULL` in the schema — the create-event
 * route falls back to this per-category image when the organiser doesn't
 * upload their own cover.
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("category_id, name, default_cover_image_url")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`getCategories failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.category_id,
    name: row.name,
    defaultCoverImageUrl: row.default_cover_image_url,
  }));
}
