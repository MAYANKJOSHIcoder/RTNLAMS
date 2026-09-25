-- ===========================================================================
-- RTNLAMS — 005_queries_notifications.sql
-- Raised Queries + threaded conversation messages + per-user notifications.
--
-- Apply AFTER 004 (Supabase SQL editor, as postgres). Idempotent: re-running
-- drops/recreates policies, triggers and functions; tables use IF NOT EXISTS.
--
--   queries          one row per citizen query on one parcel
--   query_messages   append-only conversation (never overwritten, no single
--                    "response" column) — citizen + staff replies, in order
--   notifications    one row per recipient; is_read persists across sessions
--
-- Access is enforced in the database (RLS), never only in the UI:
--   citizen  → own rows only, may post on own threads, may reopen (not resolve)
--   staff    → admin/field_officer read+manage all, auditor read-only
--              (message inserts are admin/field_officer, matching the UI)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. queries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id varchar(255) NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('Land Record','Document','Compensation','Survey','Acquisition','Payment','Other')),
  subject TEXT NOT NULL CHECK (btrim(subject) <> ''),
  description TEXT NOT NULL CHECK (btrim(description) <> ''),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved','reopened')),
  assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 2. query_messages — append-only thread
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.query_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES public.queries(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (btrim(message) <> ''),
  attachment_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  parcel_id varchar(255) REFERENCES public.parcels(id) ON DELETE CASCADE,
  query_id UUID REFERENCES public.queries(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_queries_parcel_id ON public.queries(parcel_id);
CREATE INDEX IF NOT EXISTS idx_queries_citizen_id ON public.queries(citizen_id);
CREATE INDEX IF NOT EXISTS idx_queries_assigned_to ON public.queries(assigned_to);
CREATE INDEX IF NOT EXISTS idx_queries_status ON public.queries(status);
CREATE INDEX IF NOT EXISTS idx_query_messages_query_id ON public.query_messages(query_id);
CREATE INDEX IF NOT EXISTS idx_query_messages_sender_id ON public.query_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

DROP TRIGGER IF EXISTS trg_queries_updated ON public.queries;
CREATE TRIGGER trg_queries_updated BEFORE UPDATE ON public.queries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "queries_select" ON public.queries;
DROP POLICY IF EXISTS "queries_insert" ON public.queries;
DROP POLICY IF EXISTS "queries_update" ON public.queries;
DROP POLICY IF EXISTS "query_messages_select" ON public.query_messages;
DROP POLICY IF EXISTS "query_messages_insert" ON public.query_messages;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

-- queries: staff read all; a citizen reads only their own.
CREATE POLICY "queries_select" ON public.queries FOR SELECT USING (
  public.current_user_role() IN ('admin','field_officer','auditor')
  OR (public.current_user_role() = 'citizen' AND citizen_id = auth.uid())
);

-- queries: a citizen may create a query only for themselves, on a parcel whose
-- owner_aadhaar matches their own profile (same rule as citizen_parcels RLS).
CREATE POLICY "queries_insert" ON public.queries FOR INSERT WITH CHECK (
  public.current_user_role() = 'citizen'
  AND citizen_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.parcels p
    JOIN public.user_profiles u ON u.id = auth.uid()
    WHERE p.id = queries.parcel_id
      AND p.owner_aadhaar IS NOT NULL
      AND p.owner_aadhaar = u.aadhaar
  )
);

-- queries: admin/field_officer manage status + assignment. A citizen may only
-- post a status their own lifecycle allows (reopen / reopen→open), so they can
-- never mark their own query resolved or reassign it.
CREATE POLICY "queries_update" ON public.queries FOR UPDATE USING (
  public.current_user_role() IN ('admin','field_officer')
  OR (public.current_user_role() = 'citizen' AND citizen_id = auth.uid())
) WITH CHECK (
  public.current_user_role() IN ('admin','field_officer')
  OR (
    public.current_user_role() = 'citizen'
    AND citizen_id = auth.uid()
    AND status IN ('open','reopened')
  )
);

-- query_messages: staff read every thread; a citizen reads only their own.
CREATE POLICY "query_messages_select" ON public.query_messages FOR SELECT USING (
  public.current_user_role() IN ('admin','field_officer','auditor')
  OR EXISTS (
    SELECT 1 FROM public.queries q
    WHERE q.id = query_messages.query_id
      AND q.citizen_id = auth.uid()
  )
);

-- query_messages: admin/field_officer may reply on any thread; a citizen may
-- reply only on their own. sender_id is pinned to the caller — no spoofing.
CREATE POLICY "query_messages_insert" ON public.query_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.current_user_role() IN ('admin','field_officer')
    OR EXISTS (
      SELECT 1 FROM public.queries q
      WHERE q.id = query_messages.query_id
        AND q.citizen_id = auth.uid()
    )
  )
);

-- notifications: strictly private to the recipient.
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (
  user_id = auth.uid()
);

-- Recipients may only create their own (the SECURITY DEFINER trigger functions
-- below insert for other users and run as the table owner, so they are not
-- constrained by this policy).
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (
  user_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- Notification producers
-- Real events only — nothing here invents activity that did not happen.
-- ---------------------------------------------------------------------------

-- Single-recipient insert. SECURITY DEFINER so a trigger acting for a citizen
-- can still write a row owned by a staff member (RLS would otherwise block it).
CREATE OR REPLACE FUNCTION public.push_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_parcel_id varchar,
  p_query_id UUID
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications
    (user_id, type, title, message, entity_type, entity_id, parcel_id, query_id)
  VALUES
    (p_user_id, p_type, p_title, p_message, p_entity_type, p_entity_id, p_parcel_id, p_query_id);
$$;

-- Fan-out to every admin + field officer (used when nothing is assigned yet).
CREATE OR REPLACE FUNCTION public.push_notification_to_staff(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_parcel_id varchar,
  p_query_id UUID
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.push_notification(
    u.id, p_type, p_title, p_message, 'query', p_query_id::text, p_parcel_id, p_query_id
  )
  FROM public.user_profiles u
  WHERE u.role IN ('admin','field_officer');
$$;

-- Resolve the readable parcel label (falls back to the raw id).
CREATE OR REPLACE FUNCTION public.query_parcel_label(p_parcel_id varchar)
RETURNS TEXT
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.parcel_number FROM public.parcels p WHERE p.id = p_parcel_id),
    p_parcel_id
  );
$$;

-- TRIGGER 1 — a citizen raises a query → notify the assigned officer, else all
-- admins + field officers.
CREATE OR REPLACE FUNCTION public.notify_on_query_created()
RETURNS TRIGGER AS $$
DECLARE
  v_citizen TEXT;
  v_label TEXT;
  v_msg TEXT;
BEGIN
  SELECT COALESCE(full_name, 'A citizen') INTO v_citizen
  FROM public.user_profiles WHERE id = NEW.citizen_id;

  v_label := public.query_parcel_label(NEW.parcel_id);
  v_msg := v_citizen || ' raised a query on ' || v_label || ': "' || NEW.subject || '"';

  IF NEW.assigned_to IS NOT NULL THEN
    PERFORM public.push_notification(
      NEW.assigned_to, 'query_created', 'New Query Raised', v_msg,
      'query', NEW.id::text, NEW.parcel_id, NEW.id
    );
  ELSE
    PERFORM public.push_notification_to_staff(
      'query_created', 'New Query Raised', v_msg, NEW.parcel_id, NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_query_created ON public.queries;
CREATE TRIGGER trg_notify_query_created
  AFTER INSERT ON public.queries
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_query_created();

-- TRIGGER 2 — a reply lands on a thread.
--   staff reply   → notify the citizen
--   citizen reply → notify the assigned officer, else all admins + field officers
-- The citizen's first message (the description) is skipped: the query-created
-- notification already covered it, and we never emit duplicates.
CREATE OR REPLACE FUNCTION public.notify_on_query_message()
RETURNS TRIGGER AS $$
DECLARE
  q RECORD;
  v_sender_role TEXT;
  v_sender_name TEXT;
  v_label TEXT;
BEGIN
  SELECT * INTO q FROM public.queries WHERE id = NEW.query_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.query_messages
    WHERE query_id = NEW.query_id AND id <> NEW.id
  ) THEN
    RETURN NEW; -- opening message of the thread
  END IF;

  SELECT role, COALESCE(full_name, 'A user') INTO v_sender_role, v_sender_name
  FROM public.user_profiles WHERE id = NEW.sender_id;

  v_label := public.query_parcel_label(q.parcel_id);

  IF v_sender_role = 'citizen' THEN
    IF q.assigned_to IS NOT NULL THEN
      PERFORM public.push_notification(
        q.assigned_to, 'query_reply', 'Citizen Replied to Query',
        v_sender_name || ' replied on ' || v_label || ': "' || q.subject || '"',
        'query', q.id::text, q.parcel_id, q.id
      );
    ELSE
      PERFORM public.push_notification_to_staff(
        'query_reply', 'Citizen Replied to Query',
        v_sender_name || ' replied on ' || v_label || ': "' || q.subject || '"',
        q.parcel_id, q.id
      );
    END IF;
  ELSE
    PERFORM public.push_notification(
      q.citizen_id, 'query_reply', 'Officer Replied to Your Query',
      'An officer replied to your query on ' || v_label || ': "' || q.subject || '"',
      'query', q.id::text, q.parcel_id, q.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_query_message ON public.query_messages;
CREATE TRIGGER trg_notify_query_message
  AFTER INSERT ON public.query_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_query_message();

-- TRIGGER 3 — status moves.
--   → resolved : stamp resolved_at, notify the citizen
--   → reopened : clear resolved_at, notify the assigned officer (else staff)
--   → under_review : notify the citizen their query is being worked on
CREATE OR REPLACE FUNCTION public.notify_on_query_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_label TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_label := public.query_parcel_label(NEW.parcel_id);

  IF NEW.status = 'resolved' THEN
    NEW.resolved_at := NOW();
    PERFORM public.push_notification(
      NEW.citizen_id, 'query_resolved', 'Query Resolved',
      'Your query on ' || v_label || ' ("' || NEW.subject || '") has been marked as resolved.',
      'query', NEW.id::text, NEW.parcel_id, NEW.id
    );

  ELSIF NEW.status = 'reopened' THEN
    NEW.resolved_at := NULL;
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM public.push_notification(
        NEW.assigned_to, 'query_reopened', 'Query Reopened',
        v_label || ' — "' || NEW.subject || '" was reopened by the citizen.',
        'query', NEW.id::text, NEW.parcel_id, NEW.id
      );
    ELSE
      PERFORM public.push_notification_to_staff(
        'query_reopened', 'Query Reopened',
        v_label || ' — "' || NEW.subject || '" was reopened by the citizen.',
        NEW.parcel_id, NEW.id
      );
    END IF;

  ELSIF NEW.status = 'under_review' THEN
    PERFORM public.push_notification(
      NEW.citizen_id, 'query_under_review', 'Query Under Review',
      'Your query on ' || v_label || ' ("' || NEW.subject || '") is being reviewed by an officer.',
      'query', NEW.id::text, NEW.parcel_id, NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_query_status_change ON public.queries;
CREATE TRIGGER trg_notify_query_status_change
  BEFORE UPDATE OF status ON public.queries
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_query_status_change();

-- ---------------------------------------------------------------------------
-- Self-check: the three tables must exist and RLS must be on.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['queries','query_messages','notifications'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      RAISE EXCEPTION '005 failed: public.% is missing', t;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t AND rowsecurity) THEN
      RAISE EXCEPTION '005 failed: RLS is not enabled on public.%', t;
    END IF;
  END LOOP;
  RAISE NOTICE '005 OK — queries, query_messages, notifications ready with RLS enabled.';
END $$;






