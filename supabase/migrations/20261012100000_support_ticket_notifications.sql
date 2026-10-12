-- Support tickets: tell the people who need to act.
--
-- A new ticket notifies every admin. A reply or a status change by someone
-- else notifies the person who opened the ticket; a merchant's ticket has no
-- user_id, so its owner is the merchant's account. The notifications are
-- written here so they do not depend on which screen made the change.

CREATE OR REPLACE FUNCTION public.notify_support_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_owner_url text;
BEGIN
  BEGIN
    v_owner := COALESCE(NEW.user_id, (SELECT user_id FROM public.merchants WHERE id = NEW.merchant_id));
    v_owner_url := CASE WHEN NEW.merchant_id IS NOT NULL THEN '/merchant/dashboard?tab=support' ELSE '/dashboard?tab=support' END;

    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.user_notifications (user_id, type, title, message, data)
      SELECT a.user_id, 'support_ticket', 'New support ticket',
             left(NEW.subject, 120) || ' (' || COALESCE(NEW.priority, 'medium') || ' priority)',
             jsonb_build_object('ticket_id', NEW.id, 'url', '/admin/dashboard?tab=support')
      FROM (SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin') a
      WHERE a.user_id IS DISTINCT FROM v_owner;

    ELSIF v_owner IS NOT NULL AND auth.uid() IS DISTINCT FROM v_owner THEN
      IF NEW.admin_response IS DISTINCT FROM OLD.admin_response AND NEW.admin_response IS NOT NULL THEN
        INSERT INTO public.user_notifications (user_id, type, title, message, data)
        VALUES (v_owner, 'support_ticket', 'Support replied',
                'Your ticket "' || left(NEW.subject, 120) || '" has a reply from support.',
                jsonb_build_object('ticket_id', NEW.id, 'url', v_owner_url));
      ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('resolved', 'closed') THEN
        INSERT INTO public.user_notifications (user_id, type, title, message, data)
        VALUES (v_owner, 'support_ticket', 'Support ticket ' || NEW.status,
                'Your ticket "' || left(NEW.subject, 120) || '" was marked ' || NEW.status || '.',
                jsonb_build_object('ticket_id', NEW.id, 'url', v_owner_url));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- A notification must never stop a ticket from being saved.
    RAISE WARNING 'notify_support_ticket: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_support_ticket() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_support_ticket ON public.support_tickets;
CREATE TRIGGER notify_support_ticket
  AFTER INSERT OR UPDATE OF admin_response, status ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_ticket();
