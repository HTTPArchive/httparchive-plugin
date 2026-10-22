import { fetchDoc, DOCS_TOPICS } from '../docs.js';

export const getDocumentation = async ({ topic }) => {
  if (!topic) {
    return {
      description: 'Official HTTP Archive documentation topics available to read. Pass any topic to retrieve its full markdown content.',
      topics: Object.entries(DOCS_TOPICS).map(([key, item]) => ({
        topic: key,
        title: item.title,
        url: item.url
      }))
    };
  }

  const result = await fetchDoc(topic);
  return result;
};
