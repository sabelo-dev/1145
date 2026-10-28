import React from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { competitionTerms } from "@/content/competition";

const closes = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" })
  .format(new Date(competitionTerms.closes));

// Optional: the page must still render if the promoter details are absent.
const { promoter } = competitionTerms as {
  promoter?: { name?: string; registrationNumber?: string; address?: string };
};

/** Official rules of the XIXLV DROP competition. Hidden until approved. */
const CompetitionTermsPage: React.FC = () => {
  if (!competitionTerms.approved) return <Navigate to="/terms" replace />;

  return (
    <div className="min-h-screen bg-surface-muted">
      <SEO title={`${competitionTerms.title} | 1145`} description={`${competitionTerms.prize}. Closes ${closes}.`} />
      <div className="page-container max-w-3xl py-10 md:py-14">
        <Link to="/" className="link-arrow mb-6 text-foreground"><ArrowLeft aria-hidden /> Home</Link>
        <p className="eyebrow text-gold">XIXLV DROP</p>
        <h1 className="type-headline mt-3">{competitionTerms.title}</h1>
        <p className="mt-3 text-text-secondary">{competitionTerms.prize}. Closes {closes}.</p>
        {promoter?.name && (
          <p className="mt-2 text-sm text-text-secondary">
            Promoter: {promoter.name}
            {promoter.registrationNumber && ` (Reg. ${promoter.registrationNumber})`}
            {promoter.address && `, ${promoter.address}`}
          </p>
        )}

        <div className="mt-8 space-y-4">
          {competitionTerms.sections.map((s, i) => (
            <section key={s.heading} className="rounded-2xl bg-card p-6">
              <h2 className="text-lg font-semibold">{i + 1}. {s.heading}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-text-secondary">
                {s.body.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompetitionTermsPage;
