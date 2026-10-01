import React from "react";
import { Link } from "react-router-dom";
import { Coins, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/SEO";
import guide from "@/content/rewards-guide.json";
import { isNative } from "@/lib/native";

// Same content as public/docs/1145-rewards-guide.pdf
// (regenerate with scripts/build-rewards-guide-pdf.py after editing the JSON).
export const REWARDS_GUIDE_PDF = "/docs/1145-rewards-guide.pdf";

type Section = {
  id: string;
  title: string;
  body?: string[];
  list?: string[];
  note?: string;
  table?: { columns: string[]; rows: string[][] };
  faq?: string[][];
};

const RewardsGuidePage: React.FC = () => {
  // In the iOS / Android apps, tier subscriptions can't be offered (store
  // billing rules), so prices and subscription wording are left out there.
  const native = isNative();
  const mentionsPaying = (text: string) => /subscri|payfast|monthly price/i.test(text);
  const sections = (guide.sections as Section[]).map((section) => {
    if (!native) return section;
    const priceCol = section.table?.columns.indexOf("Monthly price") ?? -1;
    return {
      ...section,
      body: section.body?.filter((p) => !mentionsPaying(p)),
      faq: section.faq?.filter(([q, a]) => !mentionsPaying(q) && !mentionsPaying(a)),
      table: section.table && priceCol >= 0
        ? {
            columns: section.table.columns.filter((_, i) => i !== priceCol),
            rows: section.table.rows.map((row) => row.filter((_, i) => i !== priceCol)),
          }
        : section.table,
    };
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 print:py-0">
      <SEO title={`${guide.title} · 1145`} description={guide.intro} />

      <header className="mb-8">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Coins className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">UCoin</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold">{guide.title}</h1>
        <p className="text-lg text-muted-foreground mt-1">{guide.subtitle}</p>
        <p className="text-xs text-muted-foreground mt-2">Last updated {guide.updated}</p>
        <p className="mt-4 max-w-prose">{guide.intro}</p>

        {!native && (
        <div className="flex flex-wrap gap-2 mt-5 print:hidden">
          <Button asChild>
            <a href={REWARDS_GUIDE_PDF} download="1145-rewards-guide.pdf">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </a>
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
        )}

        <nav aria-label="Contents" className="mt-6 print:hidden">
          <ul className="flex flex-wrap gap-2 text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="rounded-full border px-3 py-1 hover:bg-accent">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section.id} id={section.id} className="scroll-mt-24 break-inside-avoid">
            <CardHeader>
              <CardTitle className="text-xl">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.list && (
                <ul className="list-disc pl-5 space-y-1.5">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}

              {section.body?.map((p) => (
                <p key={p} className="text-muted-foreground">{p}</p>
              ))}

              {section.table && (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60">
                      <tr>
                        {section.table.columns.map((c) => (
                          <th key={c} scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row) => (
                        <tr key={row[0]} className="border-t align-top">
                          {row.map((cell, i) => (
                            <td
                              key={i}
                              className={`px-3 py-2 ${i === 0 ? "font-medium" : ""} ${
                                i > 0 && i < row.length - 1 && section.table!.columns.length > 3 ? "whitespace-nowrap" : ""
                              } ${i === 1 ? "whitespace-nowrap" : ""}`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {section.note && <p className="text-sm rounded-md bg-primary/10 px-3 py-2">{section.note}</p>}

              {section.faq && (
                <dl className="space-y-4">
                  {section.faq.map(([q, a]) => (
                    <div key={q}>
                      <dt className="font-medium">{q}</dt>
                      <dd className="text-muted-foreground mt-1">{a}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground mt-8 print:hidden">
        Still stuck? Visit our <Link to="/faq" className="underline">FAQ</Link> or contact support.
      </p>
    </div>
  );
};

export default RewardsGuidePage;
