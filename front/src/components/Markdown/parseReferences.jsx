// parseReferences.js - Robust version that only extracts actual references

// Convert HTML to readable text and ESCAPE it completely
const convertHtmlToText = (content) => {
  return (
    content
      // ESCAPE ALL HTML tags to prevent React/browser interpretation
      .replace(/<meta\s+([^>]*)>/gi, (match, attrs) => {
        return `\\<meta ${attrs}\\>`;
      })
      .replace(
        /<script\s*([^>]*)>(.*?)<\/script>/gi,
        (match, attrs, content) => {
          return `\\<script${attrs ? ` ${attrs}` : ""}\\>${
            content ? content : ""
          }\\</script\\>`;
        }
      )
      .replace(
        /<iframe\s*([^>]*)>(.*?)<\/iframe>/gi,
        (match, attrs, content) => {
          return `\\<iframe${attrs ? ` ${attrs}` : ""}\\>${
            content || ""
          }\\</iframe\\>`;
        }
      )
      .replace(
        /<object\s*([^>]*)>(.*?)<\/object>/gi,
        (match, attrs, content) => {
          return `\\<object${attrs ? ` ${attrs}` : ""}\\>${
            content || ""
          }\\</object\\>`;
        }
      )
      .replace(/<embed\s*([^>]*)>/gi, (match, attrs) => {
        return `\\<embed${attrs ? ` ${attrs}` : ""}\\>`;
      })
      .replace(/<form\s*([^>]*)>(.*?)<\/form>/gi, (match, attrs, content) => {
        return `\\<form${attrs ? ` ${attrs}` : ""}\\>${
          content || ""
        }\\</form\\>`;
      })
      // Escape any remaining HTML tags
      .replace(/<([^>]+)>/gi, (match, tagContent) => {
        return `\\<${tagContent}\\>`;
      })
      // Convert javascript: links
      .replace(/javascript:/gi, "javascript-protocol:")
      // Convert event handlers to data attributes
      .replace(/\son(\w+)\s*=\s*([^>\s]*)/gi, (match, event, handler) => {
        return ` data-on${event}="${handler}"`;
      })
  );
};

export const parseReferences = (content) => {
  if (!content || typeof content !== "string") {
    return [];
  }

  try {
    // Find all RREF patterns and their positions
    const rrefPattern = /\[RREF(\d+)\]/gi;
    const rrefMatches = [];
    let match;

    // Reset regex state
    rrefPattern.lastIndex = 0;

    while ((match = rrefPattern.exec(content)) !== null) {
      rrefMatches.push({
        number: parseInt(match[1], 10) - 1, // Convert to 0-based index
        rrefNumber: parseInt(match[1], 10), // Keep original number for display
        index: match.index,
        fullMatch: match[0],
        line: -1, // Will be calculated
      });

      // Prevent infinite loop
      if (match.index === rrefPattern.lastIndex) {
        rrefPattern.lastIndex++;
      }
    }

    if (rrefMatches.length === 0) {
      return [];
    }

    // Split content into lines and find which line each RREF is on
    const lines = content.split("\n");
    let currentPos = 0;

    // Calculate line numbers for each RREF
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineEndPos = currentPos + lines[lineIdx].length;

      // Check which RREFs are on this line
      rrefMatches.forEach((rrefMatch) => {
        if (
          rrefMatch.index >= currentPos &&
          rrefMatch.index <= lineEndPos &&
          rrefMatch.line === -1
        ) {
          rrefMatch.line = lineIdx;
        }
      });

      currentPos = lineEndPos + 1; // +1 for newline
    }

    // Process each RREF to extract its content
    const references = [];

    for (let i = 0; i < rrefMatches.length; i++) {
      const currentRref = rrefMatches[i];
      const nextRref = rrefMatches[i + 1];

      if (currentRref.line === -1) continue;

      // Validate that this line actually looks like a reference
      const currentLine = lines[currentRref.line];

      // Check if this is an actual reference line (starts with or prominently features RREF)
      const isActualReference =
        /^\s*\[RREF\d+\]/.test(currentLine) || // Starts with RREF
        (/\[RREF\d+\]/.test(currentLine) &&
          currentLine.trim().indexOf("[RREF") < 10); // RREF appears early in line

      if (!isActualReference) {
        console.log(`Skipping non-reference line: ${currentLine}`);
        continue;
      }

      // Find the end of this reference
      let endLine = lines.length - 1;

      if (nextRref && nextRref.line !== -1) {
        // Find the next actual reference line
        for (let j = i + 1; j < rrefMatches.length; j++) {
          const futureRref = rrefMatches[j];
          if (futureRref.line !== -1) {
            const futureLine = lines[futureRref.line];
            const isFutureActualRef =
              /^\s*\[RREF\d+\]/.test(futureLine) ||
              (/\[RREF\d+\]/.test(futureLine) &&
                futureLine.trim().indexOf("[RREF") < 10);

            if (isFutureActualRef) {
              endLine = futureRref.line - 1;
              break;
            }
          }
        }
      }

      // Extract reference content
      const referenceLines = lines.slice(currentRref.line, endLine + 1);

      // Clean up - remove trailing empty lines
      while (
        referenceLines.length > 0 &&
        referenceLines[referenceLines.length - 1].trim() === ""
      ) {
        referenceLines.pop();
      }

      // Join the reference content
      const referenceContent = referenceLines.join("\n").trim();

      if (referenceContent) {
        // Apply safe HTML conversion
        const processedContent = convertHtmlToText(referenceContent);

        references.push({
          number: currentRref.number,
          rrefNumber: currentRref.rrefNumber,
          content: processedContent,
        });
      }
    }

    // Sort references by their RREF number to ensure correct order
    return references.sort((a, b) => a.rrefNumber - b.rrefNumber);
  } catch (error) {
    console.error("Error parsing references:", error);
    return [];
  }
};
