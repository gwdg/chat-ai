// Reference parsing utility
export const parseReferences = (content) => {
  if (!content) return [];
  const refRegex = /\[RREF(\d+)\](.*?)(?=\n\[RREF|$)/gs;
  const matches = [...content.matchAll(refRegex)];

  return matches.map((match) => ({
    number: parseInt(match[1], 10) - 1,
    content: match[0].trim(),
  }));
};
