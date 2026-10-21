import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useMerchantAccess } from "@/hooks/useMerchantAccess";
import {
  askAssistant,
  canUse,
  decideAiDraft,
  fetchAiDrafts,
  type AiDraft,
  type AssistantReply,
} from "@/services/merchantAi";
import StoreSwitcher from "./StoreSwitcher";

const SUGGESTIONS = [
  "How did sales go in the last 7 days?",
  "What were my top five products last month?",
  "Which products are about to run out?",
  "Are any orders waiting too long?",
];

interface Turn {
  question: string;
  reply?: AssistantReply;
  error?: string;
}

/**
 * Ask 1145 AI about this store. Answers come from the store's own figures;
 * drafted copy waits below until someone approves it.
 */
const MerchantAssistant: React.FC = () => {
  const { stores, current, setStoreId } = useMerchantAccess();
  const queryClient = useQueryClient();
  const storeId = current?.store_id;
  const allowed = !!current?.features.includes("ai_assistant")
    && (canUse(current, "insights") || canUse(current, "catalog"));

  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const ask = useMutation({
    mutationFn: (q: string) => askAssistant(storeId!, q, conversationId),
    onMutate: (q) => {
      setTurns((t) => [...t, { question: q }]);
      setQuestion("");
    },
    onSuccess: (reply) => {
      setConversationId(reply.conversation_id);
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, reply } : turn)));
      if (reply.drafts.length) queryClient.invalidateQueries({ queryKey: ["merchant-ai-drafts", storeId] });
    },
    onError: (error: Error) => {
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, error: error.message } : turn)));
    },
  });

  if (!current || !allowed) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          1145 AI is not switched on for this store yet.
        </CardContent>
      </Card>
    );
  }

  const submit = (q: string) => {
    const text = q.trim();
    if (text && !ask.isPending) ask.mutate(text);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StoreSwitcher stores={stores} current={current} onChange={(id) => {
          setStoreId(id);
          setTurns([]);
          setConversationId(null);
        }} />
        {turns.length > 0 && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setTurns([]); setConversationId(null); }}>
            New conversation
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Ask 1145 AI</CardTitle>
          <CardDescription>
            Answers use only {current.store_name}'s own figures, in South Africa time. AI can make mistakes, so check
            important numbers in your reports. It cannot change prices, stock, orders or payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => submit(s)}>{s}</Button>
              ))}
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={i} className="space-y-2">
              <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground">{turn.question}</p>
              {turn.reply ? (
                <div className="max-w-[95%] space-y-1 rounded-lg bg-muted px-3 py-2">
                  <p className="whitespace-pre-wrap text-sm">{turn.reply.answer}</p>
                  {turn.reply.data_as_of && (
                    <p className="text-xs text-muted-foreground">
                      Figures as of {format(new Date(turn.reply.data_as_of), "d MMM yyyy, HH:mm")}
                      {" · "}{turn.reply.metrics.length} {turn.reply.metrics.length === 1 ? "report" : "reports"} used
                    </p>
                  )}
                  {turn.reply.drafts.length > 0 && (
                    <p className="text-xs font-medium">Draft saved. Review it under AI drafts below.</p>
                  )}
                </div>
              ) : turn.error ? (
                <p className="text-sm text-destructive">{turn.error}</p>
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
          ))}

          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(question); }}>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(question);
                }
              }}
              maxLength={2000}
              rows={2}
              placeholder="Ask about sales, orders or stock, or ask for a product description…"
              aria-label="Question for 1145 AI"
            />
            <Button type="submit" size="icon" className="h-auto w-12" disabled={ask.isPending || !question.trim()} aria-label="Send">
              {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <AiDrafts storeId={current.store_id} canApprove={canUse(current, "catalog")} />
    </div>
  );
};

const AiDrafts: React.FC<{ storeId: string; canApprove: boolean }> = ({ storeId, canApprove }) => {
  const queryClient = useQueryClient();
  const drafts = useQuery({ queryKey: ["merchant-ai-drafts", storeId], queryFn: () => fetchAiDrafts(storeId) });
  const [edits, setEdits] = useState<Record<string, string>>({});

  const decide = useMutation({
    mutationFn: ({ draft, decision }: { draft: AiDraft; decision: "approve" | "reject" }) =>
      decideAiDraft(draft.id, decision, edits[draft.id]),
    onSuccess: (_result, { draft, decision }) => {
      toast.success(decision === "reject" ? "Draft rejected"
        : draft.target_type === "product_description" ? "Description published to the product" : "Promotion copy approved");
      queryClient.invalidateQueries({ queryKey: ["merchant-ai-drafts", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const open = drafts.data?.filter((d) => d.approval_state === "draft") ?? [];
  const decided = drafts.data?.filter((d) => d.approval_state !== "draft").slice(0, 10) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI drafts</CardTitle>
        <CardDescription>
          Nothing is published until you approve it. You can edit a draft first. Approving a product description replaces
          the product's current description.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {drafts.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {!drafts.isLoading && open.length === 0 && <p className="text-sm text-muted-foreground">No drafts waiting.</p>}
        {open.map((draft) => (
          <div key={draft.id} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{draft.target_type === "product_description" ? "Product description" : "Promotion"}</Badge>
              {draft.products?.name && <span className="text-sm font-medium">{draft.products.name}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{format(new Date(draft.created_at), "d MMM, HH:mm")}</span>
            </div>
            <Textarea
              value={edits[draft.id] ?? draft.content}
              onChange={(e) => setEdits((all) => ({ ...all, [draft.id]: e.target.value }))}
              rows={5}
              maxLength={5000}
              disabled={!canApprove}
              aria-label="Draft text"
            />
            {canApprove ? (
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" disabled={decide.isPending}
                  onClick={() => decide.mutate({ draft, decision: "approve" })}>
                  <Check className="h-4 w-4" />
                  {draft.target_type === "product_description" ? "Approve and publish" : "Approve"}
                </Button>
                <Button size="sm" variant="outline" className="gap-1" disabled={decide.isPending}
                  onClick={() => decide.mutate({ draft, decision: "reject" })}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Someone with catalogue access needs to approve this.</p>
            )}
          </div>
        ))}
        {decided.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Recently decided ({decided.length})</summary>
            <ul className="mt-2 space-y-1">
              {decided.map((d) => (
                <li key={d.id} className="flex gap-2">
                  <Badge variant={d.approval_state === "approved" ? "default" : "secondary"}>{d.approval_state}</Badge>
                  <span className="truncate">{d.products?.name ?? "Promotion"}: {d.content}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
};

export default MerchantAssistant;
