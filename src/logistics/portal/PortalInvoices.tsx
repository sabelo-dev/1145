import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "../lib/db";
import { EmptyState, PageHeader } from "../components/common";
import { printInvoice, type Account, type Invoice } from "../pages/AccountsPage";
import { usePortal } from "./PortalApp";

const rands = (n: number) => `R ${Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PortalInvoices: React.FC = () => {
  const { account } = usePortal();
  const { data: details } = useQuery({
    queryKey: ["portal", account.id, "account"],
    queryFn: async () => (await db.from("logistics_accounts").select("*").eq("id", account.id).maybeSingle()).data as Account | null,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["portal", account.id, "invoices"],
    queryFn: async () => {
      const { data, error } = await db.from("logistics_invoices").select("*").eq("account_id", account.id).order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });

  return (
    <div>
      <PageHeader title="Invoices" description={details ? `Payment terms: ${details.payment_terms_days} days. Use the invoice number as your payment reference.` : undefined} />
      {invoices.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No invoices yet" description="Invoices are issued monthly for delivered parcels." />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const overdue = inv.status === "issued" && inv.due_date && new Date(inv.due_date) < new Date();
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(inv.period_start), "d MMM")} – {format(new Date(inv.period_end), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{rands(inv.total)}</TableCell>
                    <TableCell className="text-sm">
                      {inv.status === "paid" ? (
                        <span className="text-emerald-700 dark:text-emerald-400">Paid {inv.paid_at ? format(new Date(inv.paid_at), "d MMM") : ""}</span>
                      ) : overdue ? (
                        <span className="text-red-600 font-medium">Overdue since {format(new Date(inv.due_date!), "d MMM")}</span>
                      ) : inv.status === "void" ? (
                        <span className="text-muted-foreground">Void</span>
                      ) : (
                        <span>Due {inv.due_date ? format(new Date(inv.due_date), "d MMM") : ""}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => printInvoice(inv, details ?? undefined)}>
                        <Printer className="h-4 w-4 mr-1.5" /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default PortalInvoices;
