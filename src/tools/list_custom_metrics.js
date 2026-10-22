import { CUSTOM_METRICS_CATALOG } from '../data/custom_metrics_catalog.js';

export const listCustomMetrics = async ({ category, search }) => {
  if (category) {
    const normalized = category.toLowerCase().trim();
    const metric = CUSTOM_METRICS_CATALOG[normalized];

    if (!metric) {
      return {
        error: `Category '${category}' not found. Available categories: ${Object.keys(CUSTOM_METRICS_CATALOG).join(', ')}`
      };
    }

    return {
      category: metric.name,
      type: metric.type,
      description: metric.description,
      exampleFields: metric.exampleFields,
      queryExample: metric.queryExample,
      costTip: metric.costTip
    };
  }

  if (search) {
    const query = search.toLowerCase().trim();
    const matches = Object.values(CUSTOM_METRICS_CATALOG).filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.description.toLowerCase().includes(query) ||
      m.exampleFields.some(f => f.toLowerCase().includes(query))
    );

    return {
      searchQuery: search,
      matchCount: matches.length,
      categories: matches.map(m => ({
        category: m.name,
        description: m.description,
        exampleFields: m.exampleFields,
        costTip: m.costTip
      }))
    };
  }

  return {
    description: 'HTTP Archive pages table custom_metrics RECORD contains 20 specific JSON sub-columns. Accessing a sub-column (e.g. custom_metrics.a11y) only scans that column, reducing scanned bytes significantly.',
    totalCategories: Object.keys(CUSTOM_METRICS_CATALOG).length,
    categories: Object.values(CUSTOM_METRICS_CATALOG).map(m => ({
      category: m.name,
      description: m.description,
      costTip: m.costTip
    }))
  };
};
