import { supabase } from "@/integrations/supabase/client";

export type NewsletterStatus = "active" | "unsubscribed" | "bounced";

export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: NewsletterStatus;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

const normaliseEmail = (email: string) => email.trim().toLowerCase();

export async function subscribeToNewsletter(email: string, storeId?: string) {
  const { error } = await (supabase as any).rpc("subscribe_to_newsletter", {
    p_email: normaliseEmail(email),
    p_store_id: storeId ?? null,
  });
  if (error) throw error;
}

export async function getNewsletterSubscribers(storeId: string): Promise<NewsletterSubscriber[]> {
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, status, subscribed_at, unsubscribed_at")
    .eq("store_id", storeId)
    .order("subscribed_at", { ascending: false });
  if (error) throw error;
  return data as NewsletterSubscriber[];
}

export async function setNewsletterSubscriberStatus(id: string, status: NewsletterStatus) {
  const { error } = await supabase
    .from("newsletter_subscribers")
    .update({
      status,
      unsubscribed_at: status === "unsubscribed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}
