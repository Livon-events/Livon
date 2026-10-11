import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/shared/supabase/public";

export type Category = {
  id: string;
  name: string;
  defaultCoverImageUrl: string | null;
};

/**
 * All categories, for the CategorySelector filter bar and the
 * event-creation category picker. Small, static-ish reference table, so it
 * is cached across requests for an hour (tag "categories" — call
 * revalidateTag("categories") after editing the table to refresh sooner).
 *
 * `defaultCoverImageUrl` is read here (not just `id`/`name`) because
 * `events.cover_image_url` is `NOT NULL` in the schema — the create-event
 * route falls back to this per-category image when the organiser doesn't
 * upload their own cover.
 */
export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const supabase = createPublicClient();

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
  },
  ["categories"],
  { tags: ["categories"], revalidate: 3600 }
);
