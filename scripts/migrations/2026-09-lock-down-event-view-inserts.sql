-- Phase 2 of event-view RPC rollout. Apply only after the client calls
-- public.record_event_view and no longer inserts into these tables
-- directly. Revokes browser INSERT and drops the obsolete insert
-- policies so mash-clicking cannot bypass the rate-limited RPC.

DROP POLICY IF EXISTS "Users can log own views" ON public.event_views;
DROP POLICY IF EXISTS "Anyone can log anonymous views"
  ON public.anonymous_event_views;

REVOKE INSERT ON public.event_views FROM anon, authenticated;
REVOKE INSERT ON public.anonymous_event_views FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
