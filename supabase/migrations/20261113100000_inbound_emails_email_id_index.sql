-- The inbox sync checks every Resend email it sees against inbound_emails by
-- raw_payload->>'email_id'. Without an index each check read the whole table
-- (bodies and payloads included), on every inbox open.
CREATE INDEX IF NOT EXISTS inbound_emails_email_id_idx
  ON public.inbound_emails ((raw_payload->>'email_id'));

-- The list is ordered by created_at; is_archived picks the tab.
CREATE INDEX IF NOT EXISTS inbound_emails_archived_created_idx
  ON public.inbound_emails (is_archived, created_at DESC);
