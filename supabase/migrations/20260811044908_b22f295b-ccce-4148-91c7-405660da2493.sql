CREATE OR REPLACE FUNCTION public.apply_payment_webhook_event(_event_id text, _event_type text, _environment text, _provider_reference text, _organization_id uuid, _position_id uuid, _price_id text, _amount_cents bigint, _currency text, _customer_id text, _outcome text, _raw jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _existing public.payments%ROWTYPE;
  _payment_id uuid;
  _new_status public.payment_status;
  _pos public.positions%ROWTYPE;
  _published boolean := false;
  _paused boolean := false;
  _staff uuid;
  _publish_error text := NULL;
BEGIN
  IF _outcome NOT IN ('paid','refunded','pending','unpaid') THEN
    RAISE EXCEPTION 'unsupported payment outcome: %', _outcome;
  END IF;
  _new_status := _outcome::public.payment_status;

  IF EXISTS (SELECT 1 FROM public.payments WHERE webhook_event_id = _event_id) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'duplicate_event');
  END IF;

  SELECT * INTO _existing
  FROM public.payments
  WHERE provider = 'stripe'
    AND provider_environment = _environment
    AND provider_reference = _provider_reference;

  IF FOUND THEN
    UPDATE public.payments SET
      organization_id = _organization_id,
      position_id = _position_id,
      price_id = COALESCE(_price_id, price_id),
      provider_customer_id = COALESCE(_customer_id, provider_customer_id),
      amount_cents = COALESCE(_amount_cents, amount_cents),
      currency = COALESCE(_currency, currency),
      status = _new_status,
      paid_at = CASE WHEN _outcome = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
      webhook_event_id = _event_id,
      raw_event = _raw,
      updated_at = now()
    WHERE id = _existing.id
    RETURNING id INTO _payment_id;
  ELSE
    INSERT INTO public.payments (
      organization_id, position_id, provider, provider_environment,
      provider_reference, provider_customer_id, price_id, amount_cents,
      currency, status, paid_at, webhook_event_id, raw_event
    ) VALUES (
      _organization_id, _position_id, 'stripe', _environment,
      _provider_reference, _customer_id, _price_id, COALESCE(_amount_cents, 0),
      COALESCE(_currency, 'usd'), _new_status,
      CASE WHEN _outcome = 'paid' THEN now() ELSE NULL END,
      _event_id, _raw
    )
    RETURNING id INTO _payment_id;
  END IF;

  IF _position_id IS NOT NULL THEN
    SELECT * INTO _pos FROM public.positions WHERE id = _position_id FOR UPDATE;
  END IF;

  IF _pos.id IS NOT NULL AND _pos.payment_status <> 'exempt'::public.payment_status THEN
    IF _outcome = 'paid' THEN
      IF _pos.status::text IN ('draft','submitted','under_review','needs_clarification','approved') THEN
        -- Publishing runs content validation (screening-question limits,
        -- lifecycle guards). A content problem must never discard the payment:
        -- the money is recorded either way and staff are told what to fix.
        BEGIN
          UPDATE public.positions
            SET payment_status = 'paid'::public.payment_status,
                status = 'active'::public.position_status
          WHERE id = _pos.id;
          _published := true;
        EXCEPTION WHEN OTHERS THEN
          _publish_error := SQLERRM;
          _published := false;
        END;

        IF NOT _published THEN
          UPDATE public.positions
            SET payment_status = 'paid'::public.payment_status
          WHERE id = _pos.id;

          FOR _staff IN
            SELECT DISTINCT user_id FROM public.memberships
            WHERE status = 'active' AND role IN ('platform_admin','operations')
          LOOP
            INSERT INTO public.notifications (
              recipient_user_id, audience, organization_id, event_type, title, body, link_path
            ) VALUES (
              _staff, 'admin'::public.notification_audience, _organization_id,
              'role_information_missing'::public.event_type,
              'Paid role could not be published',
              format('%s is paid (reference %s) but could not go live: %s. Fix the posting, then publish it.',
                     COALESCE(_pos.title, 'A role'), _provider_reference, _publish_error),
              '/admin/publish'
            );
          END LOOP;
        END IF;
      ELSE
        UPDATE public.positions
          SET payment_status = 'paid'::public.payment_status
        WHERE id = _pos.id;
      END IF;

    ELSIF _outcome = 'refunded' THEN
      _paused := _pos.status::text IN ('active','approved');
      UPDATE public.positions
        SET payment_status = 'refunded'::public.payment_status,
            status = CASE WHEN _paused THEN 'paused'::public.position_status ELSE _pos.status END
      WHERE id = _pos.id;

      FOR _staff IN
        SELECT DISTINCT user_id FROM public.memberships
        WHERE status = 'active' AND role IN ('platform_admin','operations')
      LOOP
        INSERT INTO public.notifications (
          recipient_user_id, audience, organization_id, event_type, title, body, link_path
        ) VALUES (
          _staff, 'admin'::public.notification_audience, _organization_id,
          'position_paused'::public.event_type,
          'Payment refunded — role paused',
          format('%s was paused after a refund or chargeback (reference %s).',
                 COALESCE(_pos.title, 'A role'), _provider_reference),
          '/admin/payments'
        );
      END LOOP;

    ELSE
      UPDATE public.positions
        SET payment_status = _new_status
      WHERE id = _pos.id
        AND payment_status IN ('unpaid'::public.payment_status, 'pending'::public.payment_status);
    END IF;
  END IF;

  INSERT INTO public.audit_events (
    actor_user_id, organization_id, entity_type, entity_id, action, before_state, after_state
  ) VALUES (
    NULL, _organization_id, 'payment', _payment_id,
    'payment_event_' || _outcome,
    jsonb_build_object('position_status', _pos.status, 'position_payment_status', _pos.payment_status),
    jsonb_build_object(
      'event_id', _event_id, 'event_type', _event_type,
      'provider_reference', _provider_reference, 'position_id', _position_id,
      'published', _published, 'paused', _paused, 'publish_error', _publish_error,
      'amount_cents', _amount_cents, 'currency', _currency, 'environment', _environment
    )
  );

  RETURN jsonb_build_object('applied', true, 'payment_id', _payment_id, 'published', _published, 'paused', _paused, 'publish_error', _publish_error);
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_payment_webhook_event(text, text, text, text, uuid, uuid, text, bigint, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_payment_webhook_event(text, text, text, text, uuid, uuid, text, bigint, text, text, text, jsonb) TO service_role;