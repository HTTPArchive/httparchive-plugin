import { REPORTS_CATALOG } from '../data/reports_catalog.js';

export const checkPrecomputedReports = async ({ topic }) => {
  if (!topic || typeof topic !== 'string') {
    return {
      overview: 'HTTP Archive maintains pre-aggregated timeseries and histograms in `httparchive.reports.*` and via Tech Report API endpoints. Querying pre-aggregated reports avoids scanning multi-gigabyte or multi-terabyte raw crawl tables.',
      availableTopics: REPORTS_CATALOG.map(r => ({
        topic: r.topic,
        description: r.description,
        tablesCount: r.precomputedTables.length
      }))
    };
  }

  const query = topic.toLowerCase().trim();
  const match = REPORTS_CATALOG.find(r =>
    r.topic.toLowerCase() === query ||
    r.keywords.some(k => query.includes(k) || k.includes(query))
  );

  if (!match) {
    return {
      found: false,
      message: `No pre-computed report matched '${topic}'. You may need to query raw \`crawl.pages\` or \`crawl.requests\`.`,
      availableTopics: REPORTS_CATALOG.map(r => r.topic)
    };
  }

  return {
    found: true,
    topic: match.topic,
    description: match.description,
    recommendation: match.recommendation,
    precomputedTables: match.precomputedTables,
    techReportApi: match.techReportApi || null
  };
};
