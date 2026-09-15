import { createClient } from "@/shared/supabase/client";

export type TalentSearchResult = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
};

type PersonSearchRow = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

/** Browser-safe wrapper around the existing public `search_people` RPC. */
export async function searchPeopleForTalent(query: string): Promise<TalentSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_people", {
    p_query: trimmed,
    p_page_size: 8,
  });

  if (error) throw new Error(error.message);

  return ((data ?? []) as PersonSearchRow[])
    .filter((row) => Boolean(row.username))
    .map((row) => ({
      userId: row.user_id,
      username: row.username ?? "User",
      avatarUrl: row.avatar_url,
      bio: row.bio,
    }));
}
