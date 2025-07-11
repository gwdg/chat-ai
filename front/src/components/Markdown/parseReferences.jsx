// parseReferences.js - Fixed version that handles any LLM format

export const parseReferences = (content) => {
  if (!content || typeof content !== "string") {
    return [];
  }

  try {
    // Find all RREF patterns in the content
    const rrefPattern = /\[RREF(\d+)\]/gi;
    const matches = [];
    let match;

    // Reset regex state
    rrefPattern.lastIndex = 0;

    while ((match = rrefPattern.exec(content)) !== null) {
      matches.push({
        number: parseInt(match[1], 10) - 1,
        index: match.index,
        fullMatch: match[0],
      });

      // Prevent infinite loop
      if (match.index === rrefPattern.lastIndex) {
        rrefPattern.lastIndex++;
      }
    }

    if (matches.length === 0) {
      return [];
    }

    const lines = content.split("\n");
    const references = [];

    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];

      // Find which line contains this RREF
      let startLineIndex = -1;
      let currentPos = 0;

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineEndPos = currentPos + lines[lineIdx].length;
        if (
          currentMatch.index >= currentPos &&
          currentMatch.index <= lineEndPos
        ) {
          startLineIndex = lineIdx;
          break;
        }
        currentPos = lineEndPos + 1; // +1 for the newline character
      }

      if (startLineIndex === -1) continue;

      // Find where this reference ends
      let endLineIndex = lines.length - 1;

      if (nextMatch) {
        // Find the line containing the next RREF
        currentPos = 0;
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const lineEndPos = currentPos + lines[lineIdx].length;
          if (nextMatch.index >= currentPos && nextMatch.index <= lineEndPos) {
            endLineIndex = lineIdx - 1; // End before the next reference
            break;
          }
          currentPos = lineEndPos + 1;
        }
      }

      // Extract the reference content
      const referenceLines = lines.slice(startLineIndex, endLineIndex + 1);

      // Clean up - remove trailing empty lines
      while (
        referenceLines.length > 0 &&
        referenceLines[referenceLines.length - 1].trim() === ""
      ) {
        referenceLines.pop();
      }

      const referenceContent = referenceLines.join("\n").trim();

      if (referenceContent) {
        // Sanitize reference content to prevent HTML injection
        const sanitizedContent = referenceContent
          // Remove meta tags (especially refresh tags)
          .replace(/<meta[^>]*>/gi, "[META TAG REMOVED FOR SECURITY]")
          // Remove script tags
          .replace(
            /<script[^>]*>.*?<\/script>/gi,
            "[SCRIPT TAG REMOVED FOR SECURITY]"
          )
          // Remove other potentially dangerous HTML
          .replace(
            /<iframe[^>]*>.*?<\/iframe>/gi,
            "[IFRAME REMOVED FOR SECURITY]"
          )
          .replace(
            /<object[^>]*>.*?<\/object>/gi,
            "[OBJECT REMOVED FOR SECURITY]"
          )
          .replace(/<embed[^>]*>/gi, "[EMBED REMOVED FOR SECURITY]")
          .replace(/<form[^>]*>.*?<\/form>/gi, "[FORM REMOVED FOR SECURITY]")
          // Remove javascript: links
          .replace(/javascript:/gi, "")
          // Remove on* event handlers
          .replace(/\son\w+\s*=\s*[^>]*/gi, "");

        references.push({
          number: currentMatch.number,
          content: sanitizedContent,
        });
      }
    }

    return references;
  } catch (error) {
    console.error("Error parsing references:", error);
    return [];
  }
};
