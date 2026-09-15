-- Expose users.youtube_url on the public-profile RPC and add the same
-- https+platform-domain CHECK the other social URL columns already have.
-- Apply via Supabase SQL editor or CLI.

DROP FUNCTION IF EXISTS public.get_public_profile(uuid);

CREATE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  username text,
  bio text,
  avatar_url text,
  tiktok_url text,
  instagram_url text,
  facebook_url text,
  youtube_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select
    u.user_id,
    u.username,
    u.bio,
    u.avatar_url,
    u.tiktok_url,
    u.instagram_url,
    u.facebook_url,
    u.youtube_url
  from public.users u
  where u.user_id = p_user_id;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated, service_role;

ALTER TABLE public.users
  ADD CONSTRAINT users_youtube_url_format
  CHECK (
    youtube_url IS NULL OR (
      length(youtube_url) <= 200 AND
      youtube_url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be)(/|$)'
    )
  );
