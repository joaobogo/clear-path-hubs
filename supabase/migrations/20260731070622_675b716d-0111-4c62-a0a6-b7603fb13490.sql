-- ============================================================
-- Subscriptions
-- ============================================================
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  provider_environment text NOT NULL DEFAULT 'sandbox',
  provider_subscription_id text NOT NULL,
  provider_customer_id text,
  price_id text NOT NULL,
  plan_label text,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  pending_price_id text,
  pending_effective_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_provider_unique UNIQUE (provider, provider_environment, provider_subscription_id)
);

CREATE INDEX idx_subscriptions_org ON public.subscriptions(organization_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.payments_touch_updated_at();

-- ============================================================
-- Plan entitlements (role allowance ledger)
-- ============================================================
CREATE TABLE public.plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('package', 'subscription')),
  price_id text NOT NULL,
  plan_label text NOT NULL,
  roles_total integer CHECK (roles_total IS NULL OR roles_total > 0),
  roles_used integer NOT NULL DEFAULT 0 CHECK (roles_used >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  provider_reference text,
  source_event_id text UNIQUE,
  provider_environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_entitlements_org_active
  ON public.plan_entitlements(organization_id, status);

GRANT SELECT ON public.plan_entitlements TO authenticated;
GRANT ALL ON public.plan_entitlements TO service_role;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own entitlements"
  ON public.plan_entitlements FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) OR public.is_platform_staff(auth.uid()));

CREATE POLICY "Service role manages entitlements"
  ON public.plan_entitlements FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER plan_entitlements_touch_updated_at
  BEFORE UPDATE ON public.plan_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.payments_touch_updated_at();

-- Which allowance paid for a given role.
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS covered_by_entitlement_id uuid
    REFERENCES public.plan_entitlements(id) ON DELETE SET NULL;

-- Idempotency ledger for subscription webhook deliveries.
CREATE TABLE public.subscription_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  provider_environment text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.subscription_webhook_events TO service_role;
ALTER TABLE public.subscription_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages subscription events"
  ON public.subscription_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- Publishing gate: an allowance-covered role may go live
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_position_payment_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _paid boolean;
BEGIN
  IF NEW.status IN ('approved'::position_status, 'active'::position_status)
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN

    _paid := COALESCE(NEW.payment_status::text, 'unpaid') IN ('paid', 'exempt', 'covered');

    IF NOT _paid THEN
      RAISE EXCEPTION 'This role cannot be published until payment is complete. Your brief is saved as a draft — finish checkout and it will go live automatically.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- Notify platform staff (shared helper)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_platform_staff(
  _organization_id uuid,
  _event_type public.event_type,
  _title text,
  _body text,
  _link_path text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _staff uuid;
BEGIN
  FOR _staff IN
    SELECT DISTINCT user_id FROM public.memberships
    WHERE status = 'active' AND role IN ('platform_admin', 'operations')
  LOOP
    INSERT INTO public.notifications (
      recipient_user_id, audience, organization_id, event_type, title, body, link_path
    ) VALUES (
      _staff, 'admin'::public.notification_audience, _organization_id,
      _event_type, _title, _body, _link_path
    );
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_platform_staff(uuid, public.event_type, text, text, text) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Grant an allowance after a one-off package purchase
-- ============================================================
CREATE OR REPLACE FUNCTION public.grant_plan_entitlement(
  _event_id text,
  _organization_id uuid,
  _price_id text,
  _plan_label text,
  _roles_total integer,
  _expires_at timestamptz,
  _provider_reference text,
  _environment text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.plan_entitlements WHERE source_event_id = _event_id) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'duplicate_event');
  END IF;

  INSERT INTO public.plan_entitlements (
    organization_id, source, price_id, plan_label, roles_total,
    expires_at, provider_reference, source_event_id, provider_environment
  ) VALUES (
    _organization_id, 'package', _price_id, _plan_label, _roles_total,
    _expires_at, _provider_reference, _event_id, _environment
  )
  RETURNING id INTO _id;

  PERFORM public.notify_platform_staff(
    _organization_id,
    'intake_submitted'::public.event_type,
    'New package purchased — start the brief',
    format('%s purchased. Allowance: %s role(s). Confirm the brief and begin sourcing today.',
           _plan_label, COALESCE(_roles_total::text, 'unlimited')),
    '/admin/payments'
  );

  INSERT INTO public.audit_events (
    actor_user_id, organization_id, entity_type, entity_id, action, after_state
  ) VALUES (
    NULL, _organization_id, 'plan_entitlement', _id, 'entitlement_granted',
    jsonb_build_object('price_id', _price_id, 'roles_total', _roles_total, 'source_event_id', _event_id)
  );

  RETURN jsonb_build_object('applied', true, 'entitlement_id', _id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.grant_plan_entitlement(text, uuid, text, text, integer, timestamptz, text, text) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Use one role from an allowance
-- ============================================================
CREATE OR REPLACE FUNCTION public.consume_role_allowance(
  _position_id uuid,
  _actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _pos public.positions%ROWTYPE;
  _ent public.plan_entitlements%ROWTYPE;
BEGIN
  SELECT * INTO _pos FROM public.positions WHERE id = _position_id FOR UPDATE;
  IF _pos.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT public.is_org_editor(_actor_user_id, _pos.organization_id)
     AND NOT public.is_platform_staff(_actor_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF _pos.payment_status IN ('paid'::public.payment_status,
                             'exempt'::public.payment_status,
                             'covered'::public.payment_status) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_covered');
  END IF;

  SELECT * INTO _ent
  FROM public.plan_entitlements
  WHERE organization_id = _pos.organization_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND (roles_total IS NULL OR roles_used < roles_total)
  ORDER BY (roles_total IS NULL), expires_at NULLS LAST, created_at
  LIMIT 1
  FOR UPDATE;

  IF _ent.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_allowance');
  END IF;

  UPDATE public.plan_entitlements
    SET roles_used = roles_used + 1
  WHERE id = _ent.id;

  UPDATE public.positions
    SET payment_status = 'covered'::public.payment_status,
        covered_by_entitlement_id = _ent.id
  WHERE id = _pos.id;

  INSERT INTO public.audit_events (
    actor_user_id, organization_id, entity_type, entity_id, action, after_state
  ) VALUES (
    _actor_user_id, _pos.organization_id, 'position', _pos.id, 'allowance_consumed',
    jsonb_build_object('entitlement_id', _ent.id, 'plan_label', _ent.plan_label)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'entitlement_id', _ent.id,
    'plan_label', _ent.plan_label,
    'roles_remaining', CASE WHEN _ent.roles_total IS NULL
                            THEN NULL ELSE _ent.roles_total - _ent.roles_used - 1 END
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_role_allowance(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_role_allowance(uuid, uuid) TO service_role;

-- ============================================================
-- Apply a subscription lifecycle event
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_subscription_event(
  _event_id text,
  _event_type text,
  _environment text,
  _organization_id uuid,
  _provider_subscription_id text,
  _provider_customer_id text,
  _price_id text,
  _plan_label text,
  _roles_total integer,
  _status text,
  _period_start timestamptz,
  _period_end timestamptz,
  _cancel_at_period_end boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _sub_id uuid;
  _ent_id uuid;
  _is_new boolean := false;
  _ended boolean := false;
BEGIN
  IF EXISTS (SELECT 1 FROM public.subscription_webhook_events WHERE event_id = _event_id) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'duplicate_event');
  END IF;
  INSERT INTO public.subscription_webhook_events (event_id, event_type, provider_environment)
  VALUES (_event_id, _event_type, _environment);

  SELECT id INTO _sub_id FROM public.subscriptions
  WHERE provider = 'stripe'
    AND provider_environment = _environment
    AND provider_subscription_id = _provider_subscription_id
  FOR UPDATE;

  IF _sub_id IS NULL THEN
    INSERT INTO public.subscriptions (
      organization_id, provider_environment, provider_subscription_id,
      provider_customer_id, price_id, plan_label, status,
      current_period_start, current_period_end, cancel_at_period_end
    ) VALUES (
      _organization_id, _environment, _provider_subscription_id,
      _provider_customer_id, _price_id, _plan_label, _status,
      _period_start, _period_end, _cancel_at_period_end
    ) RETURNING id INTO _sub_id;
    _is_new := true;
  ELSE
    UPDATE public.subscriptions SET
      price_id = _price_id,
      plan_label = COALESCE(_plan_label, plan_label),
      status = _status,
      provider_customer_id = COALESCE(_provider_customer_id, provider_customer_id),
      current_period_start = COALESCE(_period_start, current_period_start),
      current_period_end = COALESCE(_period_end, current_period_end),
      cancel_at_period_end = _cancel_at_period_end,
      pending_price_id = CASE WHEN pending_price_id = _price_id THEN NULL ELSE pending_price_id END,
      pending_effective_at = CASE WHEN pending_price_id = _price_id THEN NULL ELSE pending_effective_at END
    WHERE id = _sub_id;
  END IF;

  -- Keep the allowance in step with the plan.
  SELECT id INTO _ent_id FROM public.plan_entitlements
  WHERE subscription_id = _sub_id FOR UPDATE;

  IF _status IN ('active', 'trialing', 'past_due') THEN
    IF _ent_id IS NULL THEN
      INSERT INTO public.plan_entitlements (
        organization_id, subscription_id, source, price_id, plan_label,
        roles_total, expires_at, provider_reference, provider_environment
      ) VALUES (
        _organization_id, _sub_id, 'subscription', _price_id, _plan_label,
        _roles_total, NULL, _provider_subscription_id, _environment
      ) RETURNING id INTO _ent_id;
    ELSE
      UPDATE public.plan_entitlements SET
        price_id = _price_id,
        plan_label = _plan_label,
        roles_total = _roles_total,
        status = 'active',
        expires_at = NULL
      WHERE id = _ent_id;
    END IF;
  ELSIF _status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    -- The plan has actually ended (Stripe only sends this at period end when
    -- the client cancelled), so the allowance stops and live roles come off.
    _ended := true;
    UPDATE public.plan_entitlements
      SET status = 'cancelled', expires_at = COALESCE(expires_at, now())
    WHERE id = _ent_id;

    UPDATE public.positions
      SET status = 'paused'::public.position_status
    WHERE organization_id = _organization_id
      AND status = 'active'::public.position_status
      AND payment_status = 'covered'::public.payment_status;

    PERFORM public.notify_platform_staff(
      _organization_id,
      'position_paused'::public.event_type,
      'Subscription ended — covered roles paused',
      format('The %s subscription ended. Roles covered by it are now paused.',
             COALESCE(_plan_label, 'client')),
      '/admin/payments'
    );
  END IF;

  IF _is_new THEN
    PERFORM public.notify_platform_staff(
      _organization_id,
      'intake_submitted'::public.event_type,
      'New subscription started — start the brief',
      format('%s subscription started. Allowance: %s active role(s). Confirm the brief and begin sourcing today.',
             COALESCE(_plan_label, 'A'), COALESCE(_roles_total::text, 'unlimited')),
      '/admin/payments'
    );
  END IF;

  INSERT INTO public.audit_events (
    actor_user_id, organization_id, entity_type, entity_id, action, after_state
  ) VALUES (
    NULL, _organization_id, 'subscription', _sub_id, 'subscription_' || _event_type,
    jsonb_build_object('event_id', _event_id, 'status', _status, 'price_id', _price_id,
                       'cancel_at_period_end', _cancel_at_period_end, 'ended', _ended)
  );

  RETURN jsonb_build_object('applied', true, 'subscription_id', _sub_id, 'ended', _ended);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_subscription_event(text, text, text, uuid, text, text, text, text, integer, text, timestamptz, timestamptz, boolean) FROM PUBLIC, anon, authenticated;