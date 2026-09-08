-- ────────────────────────────────────────────────────────────
-- Plan subscription purchases (member Pro + academy Plus/Elite)
--
-- Users pay through one of three methods:
--   1. Instapay link  https://ipn.eg/S/jimmydodo3/instapay/45APuk
--   2. E-wallet       01023862436
--   3. Kashier gateway (details to follow — not wired yet)
--
-- Instapay & e-wallet require the payer to upload a screenshot of the
-- transfer. The subscription activates immediately; the receipt is then
-- verified by a team member (super admin). If the payment screenshot cannot
-- be verified, the subscription is cancelled (member reverts to free,
-- academy reverts to starter) and the user is notified.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  academy_id     UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('member', 'academy')),
  plan           TEXT NOT NULL CHECK (plan IN ('pro', 'plus', 'elite')),
  billing_cycle  TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'semi', 'yearly')),
  amount         NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  method         TEXT NOT NULL CHECK (method IN ('instapay', 'e_wallet', 'kashier')),
  receipt_url    TEXT,
  receipt_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (receipt_status IN ('pending', 'verified', 'rejected')),
  reviewed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_user
  ON public.plan_subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_review
  ON public.plan_subscriptions(receipt_status, created_at DESC);

ALTER TABLE public.plan_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plan subs own select" ON public.plan_subscriptions;
CREATE POLICY "Plan subs own select" ON public.plan_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Plan subs own insert" ON public.plan_subscriptions;
CREATE POLICY "Plan subs own insert" ON public.plan_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Plan subs super admin all" ON public.plan_subscriptions;
CREATE POLICY "Plan subs super admin all" ON public.plan_subscriptions
  FOR ALL TO authenticated USING (public.is_super_admin());

-- Storage bucket for subscription payment screenshots (private, like game fees).
INSERT INTO storage.buckets (id, name, public)
VALUES ('subscription-receipts', 'subscription-receipts', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Subscription receipts: upload own" ON storage.objects;
CREATE POLICY "Subscription receipts: upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'subscription-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Subscription receipts: read own" ON storage.objects;
CREATE POLICY "Subscription receipts: read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'subscription-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Subscription receipts: super admin read" ON storage.objects;
CREATE POLICY "Subscription receipts: super admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'subscription-receipts'
    AND public.is_super_admin()
  );

-- Prices are fixed server-side so the client can't underpay.
CREATE OR REPLACE FUNCTION public.plan_price(
  p_kind TEXT,
  p_plan TEXT,
  p_cycle TEXT
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_kind = 'member' AND p_plan = 'pro' THEN
      CASE p_cycle WHEN 'monthly' THEN 100 WHEN 'semi' THEN 500 WHEN 'yearly' THEN 1000 END
    WHEN p_kind = 'academy' AND p_plan = 'plus' THEN
      CASE p_cycle WHEN 'monthly' THEN 200 WHEN 'yearly' THEN 2100 END
    WHEN p_kind = 'academy' AND p_plan = 'elite' THEN
      CASE p_cycle WHEN 'monthly' THEN 350 WHEN 'yearly' THEN 3800 END
    ELSE NULL
  END
$$;
GRANT EXECUTE ON FUNCTION public.plan_price(TEXT, TEXT, TEXT) TO authenticated;

-- Purchase a plan subscription: activates the plan immediately and queues the
-- payment screenshot (instapay / e-wallet) for verification.
CREATE OR REPLACE FUNCTION public.purchase_plan_subscription(
  p_kind          TEXT,
  p_plan          TEXT,
  p_billing_cycle TEXT,
  p_method        TEXT,
  p_receipt_url   TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_amount   NUMERIC;
  v_months   INTEGER;
  v_academy  UUID;
  v_receipt  TEXT;
  v_sub_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_kind NOT IN ('member', 'academy') OR p_plan NOT IN ('pro', 'plus', 'elite') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;
  IF p_kind = 'member' AND p_plan <> 'pro' THEN
    RAISE EXCEPTION 'Invalid member plan';
  END IF;
  IF p_kind = 'academy' AND p_plan = 'pro' THEN
    RAISE EXCEPTION 'Invalid academy plan';
  END IF;
  IF p_method NOT IN ('instapay', 'e_wallet', 'kashier') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF p_method = 'kashier' THEN
    RAISE EXCEPTION 'Kashier gateway is not available yet';
  END IF;

  v_amount := public.plan_price(p_kind, p_plan, p_billing_cycle);
  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'Invalid billing cycle';
  END IF;
  v_months := CASE p_billing_cycle WHEN 'monthly' THEN 1 WHEN 'semi' THEN 6 WHEN 'yearly' THEN 12 END;

  -- Screenshot methods must come with a receipt to verify later.
  v_receipt := NULLIF(btrim(coalesce(p_receipt_url, '')), '');
  IF v_receipt IS NULL THEN
    RAISE EXCEPTION 'A payment screenshot is required for this method';
  END IF;

  IF p_kind = 'academy' THEN
    SELECT academy_id INTO v_academy FROM public.profiles WHERE id = v_uid AND role = 'admin';
    IF v_academy IS NULL THEN
      RAISE EXCEPTION 'Only an academy admin can subscribe for an academy';
    END IF;
  END IF;

  INSERT INTO public.plan_subscriptions
    (user_id, academy_id, kind, plan, billing_cycle, amount, method, receipt_url, receipt_status)
  VALUES
    (v_uid, v_academy, p_kind, p_plan, p_billing_cycle, v_amount, p_method, v_receipt, 'pending')
  RETURNING id INTO v_sub_id;

  IF p_kind = 'member' THEN
    -- Activate premium and extend expiry.
    UPDATE public.profiles
    SET member_plan = 'premium',
        premium_expires_at = GREATEST(
          COALESCE(premium_expires_at, NOW()),
          NOW()
        ) + make_interval(months => v_months)
    WHERE id = v_uid;

    -- Record in the academy payments ledger (mapped to the payments.method CHECK).
    BEGIN
      INSERT INTO public.payments
        (member_id, academy_id, amount, payment_date, method, subscription_sessions, notes)
      VALUES
        (v_uid,
         (SELECT academy_id FROM public.profiles WHERE id = v_uid),
         v_amount,
         NOW()::DATE,
         CASE p_method WHEN 'instapay' THEN 'bank_transfer' WHEN 'e_wallet' THEN 'wallet' ELSE 'card' END,
         8,
         'Member Pro subscription (' || p_billing_cycle || ')');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- no academy attached: Pro benefit still granted, ledger not tracked
    END;
  ELSE
    -- Activate the academy plan now (also converts any unpaid trial to paid).
    UPDATE public.academies
    SET plan = p_plan,
        is_trial = FALSE,
        trial_ends_at = NULL
    WHERE id = v_academy;
  END IF;

  RETURN v_sub_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.purchase_plan_subscription(
  TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- Super admin verifies (or rejects) a payment screenshot. Rejecting cancels the
-- granted subscription and notifies the buyer.
CREATE OR REPLACE FUNCTION public.review_subscription_receipt(
  p_subscription_id UUID,
  p_approve BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_uid UUID := auth.uid();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_sub FROM public.plan_subscriptions WHERE id = p_subscription_id;
  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;
  IF v_sub.receipt_status <> 'pending' THEN
    RAISE EXCEPTION 'Subscription already reviewed';
  END IF;

  IF p_approve THEN
    UPDATE public.plan_subscriptions
    SET receipt_status = 'verified', reviewed_by = v_uid, reviewed_at = NOW()
    WHERE id = p_subscription_id;

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_sub.user_id,
      'subscription_verified',
      'Payment verified',
      'Your subscription payment was confirmed. Thanks!',
      '/checkout'
    );
  ELSE
    UPDATE public.plan_subscriptions
    SET receipt_status = 'rejected', reviewed_by = v_uid, reviewed_at = NOW()
    WHERE id = p_subscription_id;

    -- Cancel the granted subscription.
    IF v_sub.kind = 'member' THEN
      UPDATE public.profiles
      SET member_plan = 'free', premium_expires_at = NULL
      WHERE id = v_sub.user_id AND member_plan = 'premium';
    ELSE
      UPDATE public.academies
      SET plan = 'starter'
      WHERE id = v_sub.academy_id AND plan <> 'starter';
    END IF;

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_sub.user_id,
      'subscription_rejected',
      'Subscription cancelled',
      'Your subscription was cancelled because we could not verify your payment screenshot.',
      '/checkout'
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_subscription_receipt(UUID, BOOLEAN) TO authenticated;