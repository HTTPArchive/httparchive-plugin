export const CUSTOM_METRICS_CATALOG = {
  a11y: {
    name: 'a11y',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Accessibility audit results, Axe violations, aria attributes, color contrast, and landmark usage.',
    exampleFields: [
      '$.axe.violations',
      '$.axe.incomplete',
      '$.aria_landmarks',
      '$.interactive_elements_with_accessible_name',
      '$.tables.total',
      '$.zoom.user_scalable_no'
    ],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.a11y, '$.axe.violations[0].id') AS top_violation FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Query custom_metrics.a11y directly. Never select parent custom_metrics, which scans all 20+ JSON blobs."
  },
  cms: {
    name: 'cms',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Content Management System metadata, versions, plugins, and generators detected on the page.',
    exampleFields: ['$.wordpress', '$.drupal', '$.joomla', '$.generator'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.cms, '$.wordpress.version') AS wp_ver FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "For technology market share, prefer unnesting the top-level `technologies` array or checking pre-aggregated Tech Report tables."
  },
  cookies: {
    name: 'cookies',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Cookies set during page test, SameSite attributes, Secure flags, and HttpOnly directives.',
    exampleFields: ['$.samesite', '$.secure', '$.httponly', '$.total'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.cookies, '$.total') AS cookie_count FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Only project custom_metrics.cookies if cookie policy/attributes are the primary subject."
  },
  css_variables: {
    name: 'css_variables',
    type: 'JSON inside custom_metrics RECORD',
    description: 'CSS Custom Properties (variables) usage, declared variables, and values.',
    exampleFields: ['$.total', '$.values', '$.names'],
    queryExample: "SELECT page, CAST(JSON_VALUE(custom_metrics.css_variables, '$.total') AS INT64) AS var_count FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Use CAST(JSON_VALUE(...) AS INT64) for numeric aggregations."
  },
  ecommerce: {
    name: 'ecommerce',
    type: 'JSON inside custom_metrics RECORD',
    description: 'E-commerce platform detection, Shopify, Magento, WooCommerce metadata, cart/checkout indicators.',
    exampleFields: ['$.shopify', '$.cart', '$.checkout'],
    queryExample: "SELECT page FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000 AND JSON_VALUE(custom_metrics.ecommerce, '$.shopify') IS NOT NULL",
    costTip: "Combine with rank filters (e.g. rank <= 10000) to keep exploratory costs low."
  },
  element_count: {
    name: 'element_count',
    type: 'JSON inside custom_metrics RECORD',
    description: 'DOM size, element counts by tag name (div, span, button, a), and max DOM depth.',
    exampleFields: ['$.total', '$.div', '$.span', '$.img', '$.max_depth'],
    queryExample: "SELECT page, CAST(JSON_VALUE(custom_metrics.element_count, '$.total') AS INT64) AS dom_elements FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Note: avg_dom_depth is in custom_metrics.other.avg_dom_depth."
  },
  javascript: {
    name: 'javascript',
    type: 'JSON inside custom_metrics RECORD',
    description: 'JavaScript API usage, feature detection, async/defer script counts, inline scripts, web workers.',
    exampleFields: ['$.ajax', '$.async', '$.defer', '$.inline', '$.workers'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.javascript, '$.async') AS async_scripts FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Filter by client and is_root_page to maximize BigQuery cluster pruning."
  },
  markup: {
    name: 'markup',
    type: 'JSON inside custom_metrics RECORD',
    description: 'HTML markup structure, viewport tags, document declarations, semantic elements (nav, main, footer).',
    exampleFields: ['$.viewport', '$.meta', '$.semantic_elements', '$.buttons', '$.forms'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.markup, '$.viewport') AS viewport FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Useful for checking responsive viewport definitions without reading full page payloads."
  },
  media: {
    name: 'media',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Images and video media formats, picture elements, lazy loading (loading=lazy), video autoplay.',
    exampleFields: ['$.images.total', '$.images.lazy_loaded', '$.picture', '$.video'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.media, '$.images.total') AS img_count FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Query requests table directly with type = 'image' if request-level bytes or formats are needed."
  },
  origin_trials: {
    name: 'origin_trials',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Active Chrome Origin Trials tokens detected in response headers or meta tags.',
    exampleFields: ['$.tokens', '$.features'],
    queryExample: "SELECT page, JSON_QUERY(custom_metrics.origin_trials, '$.tokens') AS ot_tokens FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Use JSON_QUERY for extracting JSON arrays/objects, JSON_VALUE for scalar strings/numbers."
  },
  performance: {
    name: 'performance',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Web performance measurements, Resource Timing, Navigation Timing, long tasks, and soft navigations.',
    exampleFields: ['$.navigation_timing', '$.resource_timing', '$.lcp', '$.cls', '$.inp', '$.soft_navigations'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.performance, '$.lcp') AS lcp FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "For aggregated CWV distributions, use pre-aggregated `httparchive.reports.*` tables instead of raw crawl."
  },
  privacy: {
    name: 'privacy',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Privacy disclosures, consent management platforms (CMP / OneTrust), privacy policy links, DNT signals.',
    exampleFields: ['$.cmp', '$.consent', '$.gpc', '$.privacy_policy'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.privacy, '$.cmp') AS cmp FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Selecting custom_metrics.privacy is very small (~10-20 MB for top 1k)."
  },
  responsive_images: {
    name: 'responsive_images',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Responsive image adoption: srcset, sizes attributes, picture element usage, formats (AVIF, WebP).',
    exampleFields: ['$.picture', '$.srcset', '$.sizes'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.responsive_images, '$.picture.count') AS picture_count FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Check reports.responsive_images_timeseries for historical adoption trends."
  },
  robots_txt: {
    name: 'robots_txt',
    type: 'JSON inside custom_metrics RECORD',
    description: 'robots.txt presence, directives, user-agents, disallow rules, and sitemap declarations.',
    exampleFields: ['$.has_robots_txt', '$.sitemaps', '$.disallowed_paths'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.robots_txt, '$.has_robots_txt') AS has_robots FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Safe boolean checks: use SAFE.BOOL(JSON_VALUE(...))."
  },
  security: {
    name: 'security',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Security headers: CSP (Content-Security-Policy), HSTS, X-Content-Type-Options, Referrer-Policy, SRI.',
    exampleFields: ['$.csp', '$.hsts', '$.x_content_type_options', '$.sri'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.security, '$.hsts.enabled') AS hsts_enabled FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Check reports.security_timeseries for macro-level adoption trends before writing raw crawl queries."
  },
  structured_data: {
    name: 'structured_data',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Schema.org structured data, JSON-LD, microdata, RDFa, OpenGraph, and Twitter card tags.',
    exampleFields: ['$.json_ld', '$.opengraph', '$.twitter_card', '$.microdata'],
    queryExample: "SELECT page, JSON_QUERY(custom_metrics.structured_data, '$.json_ld') AS json_ld FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "JSON-LD can be nested deeply; use JSON_EXTRACT_ARRAY to unpack entities."
  },
  third_parties: {
    name: 'third_parties',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Third-party resources, domains, script trackers, analytics, ad networks, and CDNs.',
    exampleFields: ['$.domains', '$.scripts', '$.trackers', '$.total_requests'],
    queryExample: "SELECT page, CAST(JSON_VALUE(custom_metrics.third_parties, '$.total_requests') AS INT64) AS tp_requests FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "For deeper third-party resource analysis, query crawl.requests joined with third-party-web mapping."
  },
  well_known: {
    name: 'well_known',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Well-known URIs (/.well-known/security.txt, /.well-known/change-password, assetlinks.json).',
    exampleFields: ['$.security_txt', '$.assetlinks'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.well_known, '$.security_txt') AS has_sec_txt FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Extremely sparse metric, ideal for top-rank scans."
  },
  wpt_bodies: {
    name: 'wpt_bodies',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Metrics computed from WebPageTest response bodies object (e.g. script hashes, inline CSS sizes).',
    exampleFields: ['$.scripts', '$.inline_css_bytes'],
    queryExample: "SELECT page, JSON_VALUE(custom_metrics.wpt_bodies, '$.inline_css_bytes') AS inline_css FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Avoid selecting raw `payload` blob when wpt_bodies already extracts the required metric."
  },
  other: {
    name: 'other',
    type: 'JSON inside custom_metrics RECORD',
    description: 'Miscellaneous metrics: avg_dom_depth, stylesheet counts, web components, shadow DOM, service worker scope.',
    exampleFields: ['$.avg_dom_depth', '$.service_worker', '$.web_components', '$.shadow_dom'],
    queryExample: "SELECT page, CAST(JSON_VALUE(custom_metrics.other, '$.avg_dom_depth') AS FLOAT64) AS dom_depth FROM `httparchive.crawl.pages` WHERE date = '2024-01-01' AND client = 'mobile' AND is_root_page AND rank <= 1000",
    costTip: "Remember: avg_dom_depth is in custom_metrics.other, NOT element_count."
  }
};
