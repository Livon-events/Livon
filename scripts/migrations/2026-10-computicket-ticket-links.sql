-- Allow Computicket (computicket.com and *.computicket.com) as a fifth ticket
-- provider. Keep in sync with src/modules/events/ticketLinks.ts.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_allowed_ticket_url(p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  select p_url is not null
    and length(p_url) <= 2048
    and p_url !~ '[[:space:][:cntrl:]]'
    and position('@' in p_url) = 0
    and (
      p_url ~ '^https://(www\.)?(ecoticket|ticketbox|mytag|etickets)\.co\.ls([/?#].*)?$'
      or p_url ~ '^https://([a-z0-9-]+\.)*computicket\.com([/?#].*)?$'
    );
$function$;

CREATE OR REPLACE FUNCTION public.ticket_links_are_allowed(p_links text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  select coalesce(cardinality(p_links), 0) <= 5
    and coalesce(
      (select bool_and(public.is_allowed_ticket_url(u)) from unnest(p_links) as u),
      true
    );
$function$;

COMMIT;
