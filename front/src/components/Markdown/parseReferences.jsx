export const parseReferences = (content) => {
  if (!content || typeof content !== "string") return [];

  try {
    // Split by lines to avoid regex performance issues
    const lines = content.split("\n");
    const references = [];
    let currentRef = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const refMatch = line.match(/^\[RREF(\d+)\]/);

      if (refMatch) {
        // Save previous reference if exists
        if (currentRef) {
          references.push({
            number: currentRef.number,
            content: currentRef.lines.join("\n").trim(),
          });
        }

        // Start new reference
        currentRef = {
          number: parseInt(refMatch[1], 10) - 1,
          lines: [line],
        };
      } else if (currentRef) {
        // Add line to current reference
        currentRef.lines.push(line);
      }
    }

    // Don't forget the last reference
    if (currentRef) {
      references.push({
        number: currentRef.number,
        content: currentRef.lines.join("\n").trim(),
      });
    }

    return references;
  } catch (error) {
    console.error("Error parsing references:", error);
    return [];
  }
};
