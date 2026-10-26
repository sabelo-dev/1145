import React from "react";
import { Link } from "react-router-dom";
import { Apple, Download, Smartphone } from "lucide-react";
import { DOWNLOADABLE_APPS } from "@/config/appDownloads";
import { track } from "@/lib/analytics";

/** Closing call to action: get the app. Platform links reflect what is actually published. */
const AppDownloadBand: React.FC = () => {
  const app = DOWNLOADABLE_APPS.find((a) => a.key === "app")!;

  return (
    <section aria-labelledby="app-title" className="relative isolate overflow-hidden bg-navy-900 text-white">
      <div aria-hidden className="pointer-events-none absolute -right-24 top-0 -z-10 h-96 w-96 rounded-full bg-cyan/25 blur-3xl" />
      <div className="page-container section grid items-center gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <p className="eyebrow text-gold">The 1145 app</p>
          <h2 id="app-title" className="type-headline mt-3 text-white">Shop, ride and pay from your pocket.</h2>
          <p className="type-lead mt-4 max-w-xl text-white/75">{app.description}</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            to="/downloads"
            onClick={() => track("download_click", { placement: "app_band", platform: "android" })}
            className="flex h-14 items-center gap-3 rounded-2xl bg-brand px-5 font-semibold text-brand-foreground shadow-glow transition-colors hover:bg-brand-hover"
          >
            <Smartphone className="h-5 w-5" aria-hidden />
            <span className="flex-1">Download for Android</span>
            <Download className="h-5 w-5" aria-hidden />
          </Link>
          {app.testFlightUrl ? (
            <a
              href={app.testFlightUrl}
              onClick={() => track("download_click", { placement: "app_band", platform: "ios" })}
              className="flex h-14 items-center gap-3 rounded-2xl border border-white/20 px-5 font-semibold text-white transition-colors hover:bg-white/10"
            >
              <Apple className="h-5 w-5" aria-hidden />
              <span className="flex-1">iPhone via TestFlight</span>
            </a>
          ) : (
            <p className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 px-5 text-white/60">
              <Apple className="h-5 w-5" aria-hidden /> iPhone app coming soon
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default AppDownloadBand;
