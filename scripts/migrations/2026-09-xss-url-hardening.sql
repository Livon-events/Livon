-- Defense in depth for every persisted URL rendered by the web app.
-- The UI validates these values again at render time; these constraints stop
-- direct Data API writes from storing executable or malformed URL schemes.

BEGIN;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_avatar_url_format,
  DROP CONSTRAINT IF EXISTS users_tiktok_url_format,
  DROP CONSTRAINT IF EXISTS users_instagram_url_format,
  DROP CONSTRAINT IF EXISTS users_facebook_url_format,
  DROP CONSTRAINT IF EXISTS users_youtube_url_format;

ALTER TABLE public.users
  ADD CONSTRAINT users_avatar_url_format CHECK (
    avatar_url IS NULL OR (
      length(avatar_url) <= 2048 AND
      avatar_url ~ '^https://[^[:space:][:cntrl:]]+$' AND
      position('@' IN avatar_url) = 0
    )
  ),
  ADD CONSTRAINT users_tiktok_url_format CHECK (
    tiktok_url IS NULL OR (
      length(tiktok_url) <= 200 AND
      tiktok_url ~* '^https://([a-z0-9-]+\.)*tiktok\.com(/|$)' AND
      tiktok_url !~ '[[:space:][:cntrl:]]'
    )
  ),
  ADD CONSTRAINT users_instagram_url_format CHECK (
    instagram_url IS NULL OR (
      length(instagram_url) <= 200 AND
      instagram_url ~* '^https://([a-z0-9-]+\.)*instagram\.com(/|$)' AND
      instagram_url !~ '[[:space:][:cntrl:]]'
    )
  ),
  ADD CONSTRAINT users_facebook_url_format CHECK (
    facebook_url IS NULL OR (
      length(facebook_url) <= 200 AND
      facebook_url ~* '^https://([a-z0-9-]+\.)*(facebook|fb)\.com(/|$)' AND
      facebook_url !~ '[[:space:][:cntrl:]]'
    )
  ),
  ADD CONSTRAINT users_youtube_url_format CHECK (
    youtube_url IS NULL OR (
      length(youtube_url) <= 200 AND
      youtube_url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be)(/|$)' AND
      youtube_url !~ '[[:space:][:cntrl:]]'
    )
  );

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_cover_image_url_format,
  ADD CONSTRAINT events_cover_image_url_format CHECK (
    length(cover_image_url) <= 2048 AND
    cover_image_url !~ '[[:space:][:cntrl:]]' AND
    position('@' IN cover_image_url) = 0 AND
    (cover_image_url ~ '^https://' OR cover_image_url ~ '^/[^/]')
  );

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_default_cover_image_url_format,
  ADD CONSTRAINT categories_default_cover_image_url_format CHECK (
    default_cover_image_url IS NULL OR (
      length(default_cover_image_url) <= 2048 AND
      default_cover_image_url !~ '[[:space:][:cntrl:]]' AND
      position('@' IN default_cover_image_url) = 0 AND
      (default_cover_image_url ~ '^https://' OR default_cover_image_url ~ '^/[^/]')
    )
  );

COMMIT;
