import { createClient } from "@/lib/supabase/server";

export type Category = {
  id: string;
  name: string;
};

/**
 * All categories, for the CategorySelector filter bar and the (future)
 * event-creation category picker. Small, static-ish reference table —
 * fine to fetch on every request for now.
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("category_id, name")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`getCategories failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({ id: row.category_id, name: row.name }));
}
