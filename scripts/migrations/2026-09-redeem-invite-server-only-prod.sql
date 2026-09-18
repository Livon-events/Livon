-- Align production redeem_invite with deployed /i/[code] route (4-arg, service_role-only).
-- The app already calls redeem_invite(p_code, p_anon_session_id, p_user_id, p_client_ip);
-- production still had the old 2-arg client-callable signature, so every invite
-- link RPC failed and redirected visitors to the homepage.
--
-- Already applied to livon Project (zzgnkqpkmumpwjpsbbil) via Supabase MCP.
-- livon-test already had the 4-arg function from the full hardening migration.

DROP FUNCTION IF EXISTS public.redeem_invite(text, uuid);

CREATE OR REPLACE FUNCTION public.redeem_invite(
  p_code text,
  p_anon_session_id uuid,
  p_user_id uuid,
  p_client_ip text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  v_invite_link_id uuid;
  v_event_id uuid;
  v_creator_id uuid;
  v_row_count int;
begin
  if p_user_id is not null and p_anon_session_id is not null then
    raise exception 'redeem_invite: pass p_user_id or p_anon_session_id, never both'
      using errcode = '22023';
  end if;

  if p_code is null or length(p_code) < 1 or length(p_code) > 64 then
    return jsonb_build_object('event_id', null);
  end if;

  if not public.check_and_increment_rate_limit(
    'redeem_invite:' || coalesce(nullif(btrim(p_client_ip), ''), 'unknown'),
    60,
    interval '5 minutes'
  ) then
    return jsonb_build_object('event_id', null);
  end if;

  select invite_link_id, event_id, creator_id
    into v_invite_link_id, v_event_id, v_creator_id
  from public.invite_links
  where code = p_code;

  if v_invite_link_id is null then
    return jsonb_build_object('event_id', null);
  end if;

  if p_user_id is not null and p_user_id = v_creator_id then
    return jsonb_build_object('event_id', v_event_id);
  end if;

  if p_user_id is null and p_anon_session_id is null then
    return jsonb_build_object('event_id', v_event_id);
  end if;

  insert into public.invite_link_clicks (invite_link_id, user_id, anon_session_id)
  values (v_invite_link_id, p_user_id, p_anon_session_id)
  on conflict do nothing;

  get diagnostics v_row_count = row_count;

  if v_row_count > 0 then
    update public.invite_links
    set click_count = click_count + 1
    where invite_link_id = v_invite_link_id;
  end if;

  return jsonb_build_object('event_id', v_event_id);
end;
$function$;

REVOKE ALL ON FUNCTION public.redeem_invite(text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text, uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
