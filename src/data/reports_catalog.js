export const REPORTS_CATALOG = [
  {
    topic: 'cwv',
    keywords: ['cwv', 'core web vitals', 'lcp', 'inp', 'cls', 'fcp', 'ttfb', 'fid', 'web vitals'],
    description: 'Core Web Vitals distributions and monthly timeseries for websites globally and by technology.',
    precomputedTables: [
      {
        table: 'httparchive.reports.cwv_timeseries',
        description: 'Monthly percentage of websites passing Core Web Vitals (good LCP, CLS, INP) across lenses (all, top1k, top10k, wordpress, etc.).',
        sampleQuery: "SELECT date, client, lens, p75_lcp, p75_cls, p75_inp FROM `httparchive.reports.cwv_timeseries` WHERE date >= '2024-01-01' AND lens = 'all' ORDER BY date DESC"
      },
      {
        table: 'httparchive.reports.lcp_timeseries',
        description: 'Percentiles (p10, p25, p50, p75, p90) of Largest Contentful Paint over time.'
      },
      {
        table: 'httparchive.reports.inp_timeseries',
        description: 'Percentiles of Interaction to Next Paint over time.'
      },
      {
        table: 'httparchive.reports.cls_timeseries',
        description: 'Percentiles of Cumulative Layout Shift over time.'
      }
    ],
    techReportApi: {
      endpoint: '/v1/tech-report/cwv',
      tool: 'get_cwv_metrics',
      notes: 'Available through Tech Report API with zero BigQuery cost.'
    },
    recommendation: 'Always query `httparchive.reports.*` or Tech Report API before attempting raw crawl.pages CWV calculations.'
  },
  {
    topic: 'page-weight',
    keywords: ['page weight', 'bytes', 'transfer size', 'js size', 'css size', 'image size', 'payload size', 'html size'],
    description: 'Page weight breakdowns by resource type (HTML, JS, CSS, Images, Fonts, Video, Total).',
    precomputedTables: [
      {
        table: 'httparchive.reports.bytesTotal_timeseries',
        description: 'Median (p50) and percentiles (p10, p25, p75, p90) for total page transfer size in KB.',
        sampleQuery: "SELECT date, client, lens, p50, p75, p90 FROM `httparchive.reports.bytesTotal_timeseries` WHERE date >= '2024-01-01' AND lens = 'top1k' ORDER BY date DESC"
      },
      {
        table: 'httparchive.reports.bytesJs_timeseries',
        description: 'JavaScript transfer size percentiles in KB.'
      },
      {
        table: 'httparchive.reports.bytesImg_timeseries',
        description: 'Image transfer size percentiles in KB.'
      },
      {
        table: 'httparchive.reports.bytesCss_timeseries',
        description: 'CSS transfer size percentiles in KB.'
      },
      {
        table: 'httparchive.reports.bytesFont_timeseries',
        description: 'Web font transfer size percentiles in KB.'
      }
    ],
    techReportApi: {
      endpoint: '/v1/tech-report/page-weight',
      tool: 'get_page_weight_metrics',
      notes: 'Available through Tech Report API broken down by technology.'
    },
    recommendation: 'Use `bytesTotal_timeseries` or resource-specific timeseries. Avoid aggregating sum(summary.bytesTotal) over crawl.pages.'
  },
  {
    topic: 'requests',
    keywords: ['request count', 'num requests', 'number of requests', 'http requests', 'js requests'],
    description: 'Number of HTTP requests per page across resource types.',
    precomputedTables: [
      {
        table: 'httparchive.reports.reqTotal_timeseries',
        description: 'Total request count percentiles per page.',
        sampleQuery: "SELECT date, client, lens, p50 FROM `httparchive.reports.reqTotal_timeseries` WHERE date >= '2024-01-01' AND lens = 'all' ORDER BY date DESC"
      },
      {
        table: 'httparchive.reports.reqJs_timeseries',
        description: 'Number of JavaScript requests per page.'
      },
      {
        table: 'httparchive.reports.reqImg_timeseries',
        description: 'Number of Image requests per page.'
      }
    ],
    recommendation: 'Never run `COUNT(1) FROM crawl.requests GROUP BY page` across the entire month if you only need the median or percentiles.'
  },
  {
    topic: 'adoption',
    keywords: ['adoption', 'market share', 'penetration', 'usage', 'http2', 'http3', 'https', 'ipv6', 'service worker'],
    description: 'Adoption rates and percentages of web protocols, APIs, and technologies.',
    precomputedTables: [
      {
        table: 'httparchive.reports.h2_timeseries',
        description: 'HTTP/2 and HTTP/3 adoption percentage over time.'
      },
      {
        table: 'httparchive.reports.https_timeseries',
        description: 'HTTPS adoption percentage over time.'
      },
      {
        table: 'httparchive.reports.sw_timeseries',
        description: 'Service Worker adoption percentage over time.'
      }
    ],
    techReportApi: {
      endpoint: '/v1/tech-report/adoption',
      tool: 'get_adoption_metrics',
      notes: 'Adoption percentages over time by technology, geo, and rank segment.'
    },
    recommendation: 'Check `httparchive.reports.*_timeseries` or Tech Report API adoption endpoints first.'
  },
  {
    topic: 'lighthouse',
    keywords: ['lighthouse', 'performance score', 'accessibility score', 'seo score', 'best practices score', 'pwa'],
    description: 'Lighthouse category median scores and distributions.',
    precomputedTables: [
      {
        table: 'httparchive.reports.lighthouse_timeseries',
        description: 'Lighthouse audit category median scores over time.'
      }
    ],
    techReportApi: {
      endpoint: '/v1/tech-report/lighthouse',
      tool: 'get_lighthouse_metrics',
      notes: 'Lighthouse category scores by technology, rank, and geo.'
    },
    recommendation: 'Parsing JSON `lighthouse` field in `crawl.pages` scans tens of gigabytes per month. Use reports table or Tech Report API.'
  }
];
