import type { CompanyResearch as Research } from "@/api/types";
import { Button } from "@/components/ui/button";
import { tr } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { ArrowUpRight } from "lucide-react";
import { useResearchCompany } from "../api";
import type { CompanyRecord } from "../types";

const TOPICS = [
  "product",
  "stack",
  "hiring",
  "culture",
  "locations",
  "size",
  "other",
] as const;

function shortUrl(url: string) {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname + (pathname === "/" ? "" : pathname);
  } catch {
    return url;
  }
}

function Source({ url }: { url: string }) {
  return (
    <a
      className="inline-flex items-center gap-1 text-xs text-primary underline break-all"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {shortUrl(url)}
      <ArrowUpRight size={12} aria-hidden="true" />
    </a>
  );
}

function Facts({ research }: { research: Research }) {
  const groups = TOPICS.map((topic) => ({
    topic,
    facts: research.facts.filter((f) => f.topic === topic),
  })).filter((g) => g.facts.length);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {research.provider === "rule-based"
          ? tr("companyInsights.ruleBased")
          : tr("companyInsights.aiChecked")}{" "}
        {tr("companyInsights.checkedOn", {
          date: new Date(research.fetched_at).toLocaleDateString(),
        })}
      </p>
      {groups.length === 0 && (
        <p className="text-sm">{tr("companyInsights.noFacts")}</p>
      )}
      {groups.map(({ topic, facts }) => (
        <div key={topic} className="space-y-2">
          <h4 className="font-semibold">
            {tr(`companyInsights.topics.${topic}`)}
          </h4>
          <ul className="space-y-3">
            {facts.map((fact) => (
              <li
                key={fact.text}
                className="rounded-lg border p-3 space-y-1 text-sm"
              >
                <p>{fact.text}</p>
                {fact.quote !== fact.text && (
                  <blockquote className="border-l-2 pl-3 italic text-muted-foreground">
                    «{fact.quote}»
                  </blockquote>
                )}
                <Source url={fact.source_url} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {research.stack.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold">{tr("companyInsights.stackTitle")}</h4>
          <ul className="flex flex-wrap gap-2">
            {research.stack.map((tech) => (
              <li key={tech.name}>
                <a
                  className="skill-stamp"
                  href={tech.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={tr("companyInsights.namedOn", {
                    page: shortUrl(tech.source_url),
                  })}
                >
                  {tech.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {research.dropped > 0 && (
        <p className="text-xs text-muted-foreground">
          {tr("companyInsights.dropped", { count: research.dropped })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {tr("companyInsights.sources")}{" "}
        {research.sources.map((url, i) => (
          <span key={url}>
            {i > 0 && ", "}
            <Source url={url} />
          </span>
        ))}
      </p>
    </div>
  );
}

/** What the company says about itself on its own website, each fact with its quote and page. */
export function CompanyResearch({ company }: { company: CompanyRecord }) {
  const research = useResearchCompany();
  const saved = company.data.research;
  return (
    <section
      aria-labelledby="company-research"
      className="rounded-xl border p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 id="company-research" className="text-xl font-semibold">
            {tr("companyInsights.researchTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {tr("companyInsights.researchIntro")}
          </p>
        </div>
        {company.data.website && (
          <Button
            variant="outline"
            disabled={research.isPending}
            onClick={() =>
              research.mutate({ id: company.id, revision: company.revision })
            }
          >
            {research.isPending
              ? tr("companyInsights.reading")
              : saved
                ? tr("companyInsights.refresh")
                : tr("companyInsights.read")}
          </Button>
        )}
      </div>
      {!company.data.website && (
        <p className="text-sm">{tr("companyInsights.needWebsite")}</p>
      )}
      {research.isPending && (
        <p role="status" className="text-sm">
          {tr("companyInsights.readingHint")}
        </p>
      )}
      {research.error && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(research.error)}
        </p>
      )}
      {saved && <Facts research={saved} />}
    </section>
  );
}
