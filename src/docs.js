import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DOCS_TOPICS = {
  // Guides
  'minimizing-costs': {
    title: 'Minimizing Query Costs',
    path: 'guides/minimizing-costs.md',
    url: 'https://httparchive.org/docs/guides/minimizing-costs/'
  },
  'getting-started': {
    title: 'Getting Started with HTTP Archive',
    path: 'guides/getting-started.mdx',
    url: 'https://httparchive.org/docs/guides/getting-started/'
  },
  'guided-tour': {
    title: 'Guided Tour',
    path: 'guides/guided-tour.mdx',
    url: 'https://httparchive.org/docs/guides/guided-tour/'
  },
  'release-cycle': {
    title: 'Release Cycle',
    path: 'guides/release-cycle.mdx',
    url: 'https://httparchive.org/docs/guides/release-cycle/'
  },

  // Tables Reference
  'pages': {
    title: 'Pages Table Reference',
    path: 'reference/tables/pages.mdx',
    url: 'https://httparchive.org/docs/reference/tables/pages/'
  },
  'requests': {
    title: 'Requests Table Reference',
    path: 'reference/tables/requests.mdx',
    url: 'https://httparchive.org/docs/reference/tables/requests/'
  },

  // Structs & Columns
  'custom-metrics': {
    title: 'Custom Metrics Struct Reference',
    path: 'reference/structs/custom-metrics.mdx',
    url: 'https://httparchive.org/docs/reference/structs/custom-metrics/'
  },
  'technology': {
    title: 'Technology Struct Reference',
    path: 'reference/structs/technology.mdx',
    url: 'https://httparchive.org/docs/reference/structs/technology/'
  },
  'feature': {
    title: 'Blink Features Struct Reference',
    path: 'reference/structs/feature.mdx',
    url: 'https://httparchive.org/docs/reference/structs/feature/'
  },
  'header': {
    title: 'Headers Struct Reference',
    path: 'reference/structs/header.mdx',
    url: 'https://httparchive.org/docs/reference/structs/header/'
  },

  // Blobs
  'lighthouse': {
    title: 'Lighthouse Report Blob Reference',
    path: 'reference/blobs/lighthouse.mdx',
    url: 'https://httparchive.org/docs/reference/blobs/lighthouse/'
  },
  'page-payload': {
    title: 'Page Payload Blob Reference',
    path: 'reference/blobs/page-payload.mdx',
    url: 'https://httparchive.org/docs/reference/blobs/page-payload/'
  },
  'page-summary': {
    title: 'Page Summary Blob Reference',
    path: 'reference/blobs/page-summary.mdx',
    url: 'https://httparchive.org/docs/reference/blobs/page-summary/'
  },
  'request-payload': {
    title: 'Request Payload Blob Reference',
    path: 'reference/blobs/request-payload.mdx',
    url: 'https://httparchive.org/docs/reference/blobs/request-payload/'
  },
  'request-summary': {
    title: 'Request Summary Blob Reference',
    path: 'reference/blobs/request-summary.mdx',
    url: 'https://httparchive.org/docs/reference/blobs/request-summary/'
  },

  // SQL Functions
  'capo': {
    title: 'Capo SQL Function',
    path: 'reference/functions/capo.mdx',
    url: 'https://httparchive.org/docs/reference/functions/capo/'
  },
  'get_lcp_priority': {
    title: 'get_lcp_priority SQL Function',
    path: 'reference/functions/get_lcp_priority.mdx',
    url: 'https://httparchive.org/docs/reference/functions/get_lcp_priority/'
  },
  'get_origin': {
    title: 'get_origin SQL Function',
    path: 'reference/functions/get_origin.mdx',
    url: 'https://httparchive.org/docs/reference/functions/get_origin/'
  }
};

const findLocalDocsPath = (relPath) => {
  const possiblePaths = [
    process.env.DOCS_PATH ? path.join(process.env.DOCS_PATH, relPath) : null,
    path.resolve(__dirname, '../../httparchive.org/src/content/docs/docs', relPath),
    path.resolve(process.cwd(), 'httparchive.org/src/content/docs/docs', relPath),
    path.resolve(process.cwd(), '../httparchive.org/src/content/docs/docs', relPath)
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
};

export const fetchDoc = async (topicOrPath) => {
  if (!topicOrPath) {
    return {
      availableTopics: Object.entries(DOCS_TOPICS).map(([key, item]) => ({
        topic: key,
        title: item.title,
        url: item.url
      }))
    };
  }

  const normalized = topicOrPath.toLowerCase().trim().replace(/^\/+/, '');
  const entry = DOCS_TOPICS[normalized] || Object.values(DOCS_TOPICS).find(e => e.path.toLowerCase().includes(normalized));

  const docRelPath = entry ? entry.path : normalized.endsWith('.md') || normalized.endsWith('.mdx') ? normalized : `${normalized}.mdx`;
  const title = entry ? entry.title : topicOrPath;
  const webUrl = entry ? entry.url : `https://httparchive.org/docs/${normalized}`;

  // Try reading local docs first
  const localFile = findLocalDocsPath(docRelPath);
  if (localFile) {
    const content = fs.readFileSync(localFile, 'utf-8');
    return {
      topic: normalized,
      title,
      source: 'local-docs',
      url: webUrl,
      content
    };
  }

  // Fetch from raw GitHub repository
  const remoteUrl = `https://raw.githubusercontent.com/HTTPArchive/httparchive.org/main/src/content/docs/docs/${docRelPath}`;
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) {
      return {
        error: `Documentation not found for topic '${topicOrPath}' (HTTP ${res.status}). Available topics: ${Object.keys(DOCS_TOPICS).join(', ')}`,
        availableTopics: Object.keys(DOCS_TOPICS)
      };
    }
    const content = await res.text();
    return {
      topic: normalized,
      title,
      source: 'remote-github',
      url: webUrl,
      content
    };
  } catch (err) {
    return {
      error: `Failed to fetch documentation: ${err.message}`,
      url: webUrl
    };
  }
};
