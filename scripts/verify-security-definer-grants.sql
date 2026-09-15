-- Privilege-matrix assertions for the SECURITY DEFINER functions in `public`
-- (docs/security-definer-risks.md Phase 5). Read-only: raises on the first
-- violation and returns the full matrix when everything passes.
--
-- Run in BOTH projects after any migration that creates or replaces a definer
-- function. Behavioural coverage lives in scripts/test-rpc-authorization.mjs.
--
-- Known expected failure: until src/app/i/[code]/route.ts deploys, production
-- still exposes the 2-argument `redeem_invite` to clients, so the first
-- assertion fails there by design. It passes in test.

DO $$
DECLARE
  v_offenders text;
BEGIN
  -- Internal helpers and trigger functions must not be client-callable.
  SELECT string_agg(p.proname, ', ')
  INTO v_offenders
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.proname IN ('check_and_increment_rate_limit', 'handle_new_user', 'redeem_invite')
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  IF v_offenders IS NOT NULL THEN
    RAISE EXCEPTION 'internal functions are client-callable: %', v_offenders;
  END IF;

  -- Organizer-only functions must not be anonymous.
  SELECT string_agg(p.proname, ', ')
  INTO v_offenders
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.proname IN ('claim_event', 'get_event_management_data', 'get_my_event_view_stats')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_offenders IS NOT NULL THEN
    RAISE EXCEPTION 'organizer-only functions are anon-callable: %', v_offenders;
  END IF;

  -- No definer function may keep the default PUBLIC execute grant: PUBLIC is
  -- every current and future role, not just anon/authenticated.
  SELECT string_agg(p.proname, ', ')
  INTO v_offenders
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND (p.proacl IS NULL OR array_to_string(p.proacl, ',') LIKE '=X/%');

  IF v_offenders IS NOT NULL THEN
    RAISE EXCEPTION 'definer functions still grant EXECUTE to PUBLIC: %', v_offenders;
  END IF;

  -- Every definer function needs a fixed, safe search_path so it cannot
  -- resolve objects through a schema the caller influences.
  SELECT string_agg(p.proname, ', ')
  INTO v_offenders
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(coalesce(p.proconfig, '{}'::text[])) AS cfg
      WHERE cfg LIKE 'search_path=%'
    );

  IF v_offenders IS NOT NULL THEN
    RAISE EXCEPTION 'definer functions without a fixed search_path: %', v_offenders;
  END IF;

  -- The email-disclosure RPC must stay gone.
  IF to_regprocedure('public.resolve_login_email(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'resolve_login_email still exists';
  END IF;

  -- No anonymous read may return an email column (R8 output contract).
  SELECT string_agg(p.proname, ', ')
  INTO v_offenders
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND pg_get_function_result(p.oid) ~* 'e-?mail';

  IF v_offenders IS NOT NULL THEN
    RAISE EXCEPTION 'anon-callable functions expose an email column: %', v_offenders;
  END IF;

  -- A writable `public` schema would defeat a fixed search_path.
  IF has_schema_privilege('anon', 'public', 'CREATE')
    OR has_schema_privilege('authenticated', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'anon or authenticated can CREATE in schema public';
  END IF;

  -- New functions must not inherit execute access; without this a future
  -- migration can ship an anonymous endpoint by simply omitting a GRANT.
  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE n.nspname = 'public'
      AND d.defaclobjtype = 'f'
      AND d.defaclrole = 'postgres'::regrole
      AND array_to_string(d.defaclacl, ',') ~ '(^|,)(=X|anon=|authenticated=)'
  ) THEN
    RAISE EXCEPTION 'default function privileges in public still grant execute to PUBLIC/anon/authenticated';
  END IF;

  RAISE NOTICE 'All SECURITY DEFINER privilege assertions passed.';
END;
$$;

SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.proacl::text AS acl,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  coalesce(array_to_string(p.proconfig, ', '), '') AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
ORDER BY p.proname, arguments;
