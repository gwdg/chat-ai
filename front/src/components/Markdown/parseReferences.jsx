const convertHtmlToText = (content) => {
  return (
    content
      // Remove various templating systems
      .replace(/\{\{[^}]*\}\}/g, "") // Hugo: {{< >}}, {{ }}
      .replace(/\{%[^%]*%\}/g, "") // Jekyll: {% %}
      .replace(/\[\[([^\]]*)\]\]/g, "$1") // WikiLinks: [[text]]
      .replace(/<!--.*?-->/gs, "") // HTML comments

      // Fix common URL issues
      .replace(
        /https?:\/([^\/])/g,
        (match, rest) => match.slice(0, -rest.length) + "/" + rest
      )

      // Remove dangerous content
      .replace(/<script[^>]*>.*?<\/script>/gi, "[SCRIPT]")
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, "[IFRAME]")
      .replace(/javascript:/gi, "js-protocol:")

      // Clean up whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
};

const extractTitleFromReferenceLine = (line, rrefNumber, url) => {
  // Remove RREF marker first
  let title = line.replace(/\[RREF\d+\]\s*/i, "");

  // Handle various link formats
  title = title
    // Markdown links: [title](url)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // HTML links: <a href="url">title</a>
    .replace(/<a[^>]*>([^<]+)<\/a>/gi, "$1")
    // Plain URLs at start/end
    .replace(/^(https?:\/\/[^\s]+)\s*/, "")
    .replace(/\s*(https?:\/\/[^\s]+)$/, "")
    // Remove similarity scores: (0.123), [0.123], etc.
    .replace(/[\(\[\{]\s*\d+\.\d+\s*[\)\]\}].*$/, "")
    .trim();

  // If we still don't have a good title, generate from URL or number
  if (!title || title.length < 3 || /^https?:\/\//.test(title)) {
    if (url) {
      // Extract meaningful name from URL
      try {
        const urlObj = new URL(url.startsWith("http") ? url : "https://" + url);
        const pathParts = urlObj.pathname.split("/").filter((p) => p);
        const lastPart =
          pathParts[pathParts.length - 1] ||
          pathParts[pathParts.length - 2] ||
          urlObj.hostname;

        title = lastPart
          .replace(/\.(md|html?|php|jsp|asp)$/i, "") // Remove file extensions
          .replace(/[-_]/g, " ") // Replace separators with spaces
          .replace(/\b\w/g, (l) => l.toUpperCase()) // Title case
          .trim();

        if (title.length < 3) {
          title = urlObj.hostname.replace(/^www\./, "");
        }
      } catch (e) {
        title = `Reference ${rrefNumber}`;
      }
    } else {
      title = `Reference ${rrefNumber}`;
    }
  }

  return title;
};

const findReferenceSections = (content) => {
  // Look for various reference section markers
  const sectionMarkers = [
    /\n\s*[-=]{3,}\s*\n\s*references?\s*:?\s*\n/gi,
    /\n\s*references?\s*:?\s*\n\s*[-=]{3,}\s*\n/gi,
    /\n\s*#{1,6}\s*references?\s*\n/gi,
    /\n\s*references?\s*:?\s*\n/gi,
    /\n\s*sources?\s*(?:&|and)?\s*references?\s*:?\s*\n/gi,
  ];

  let sections = [content]; // Start with full content

  for (const marker of sectionMarkers) {
    const newSections = [];
    for (const section of sections) {
      newSections.push(...section.split(marker));
    }
    sections = newSections;
  }

  return sections;
};

export const parseReferences = (content) => {
  if (!content || typeof content !== "string") {
    return [];
  }

  try {
    // Step 1: Find reference sections
    const sections = findReferenceSections(content);

    // Step 2: Find all RREF patterns across all sections
    const allRrefMatches = [];

    sections.forEach((section, sectionIndex) => {
      const rrefPattern = /\[RREF(\d+)\]/gi;
      let match;

      while ((match = rrefPattern.exec(section)) !== null) {
        allRrefMatches.push({
          rrefNumber: parseInt(match[1], 10),
          index: match.index,
          sectionIndex,
          section,
          fullMatch: match[0],
        });

        // Prevent infinite loop
        if (match.index === rrefPattern.lastIndex) {
          rrefPattern.lastIndex++;
        }
      }
    });

    if (allRrefMatches.length === 0) {
      return [];
    }

    // Step 3: Group by RREF number and find the best content for each
    const rrefGroups = {};

    allRrefMatches.forEach((match) => {
      if (!rrefGroups[match.rrefNumber]) {
        rrefGroups[match.rrefNumber] = [];
      }
      rrefGroups[match.rrefNumber].push(match);
    });

    // Step 4: Process each RREF number
    const references = [];
    const seenUrls = new Set();

    Object.keys(rrefGroups)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((rrefNumber) => {
        const matches = rrefGroups[rrefNumber];

        // Find the match with the most content (likely the detailed one)
        let bestMatch = matches[0];
        let bestContentLength = 0;

        matches.forEach((match) => {
          // Find content from this RREF to next RREF or end of section
          const section = match.section;
          const nextRrefInSection = section
            .substring(match.index + match.fullMatch.length)
            .search(/\[RREF\d+\]/);
          const endIndex =
            nextRrefInSection === -1
              ? section.length
              : match.index + match.fullMatch.length + nextRrefInSection;
          const blockContent = section.substring(match.index, endIndex).trim();

          if (blockContent.length > bestContentLength) {
            bestMatch = match;
            bestContentLength = blockContent.length;
          }
        });

        // Extract content for the best match
        if (bestContentLength > 20) {
          // Must have substantial content
          const section = bestMatch.section;
          const nextRrefInSection = section
            .substring(bestMatch.index + bestMatch.fullMatch.length)
            .search(/\[RREF\d+\]/);
          const endIndex =
            nextRrefInSection === -1
              ? section.length
              : bestMatch.index +
                bestMatch.fullMatch.length +
                nextRrefInSection;
          const blockContent = section
            .substring(bestMatch.index, endIndex)
            .trim();

          const lines = blockContent.split("\n");
          const firstLine = lines[0] || "";

          // Extract URL
          const urlMatch = blockContent.match(/(https?:\/\/[^\s\)\]\>]+)/);
          const url = urlMatch ? urlMatch[1] : null;

          // Skip if we've seen this URL before (deduplication)
          if (url && seenUrls.has(url)) {
            return;
          }

          if (url) seenUrls.add(url);

          // Extract title
          const title = extractTitleFromReferenceLine(
            firstLine,
            parseInt(rrefNumber),
            url
          );

          // Clean the full content
          const cleanContent = convertHtmlToText(blockContent);

          references.push({
            number: parseInt(rrefNumber) - 1, // 0-based for internal use
            rrefNumber: parseInt(rrefNumber), // 1-based for display
            content: `${title}\n\n${cleanContent}`,
            url: url,
          });
        }
      });

    // Step 5: Final sort and validation
    const finalReferences = references
      .sort((a, b) => a.rrefNumber - b.rrefNumber)
      .filter((ref) => ref.content && ref.content.length > 30); // Ensure substantial content

    return finalReferences;
  } catch (error) {
    console.error("❌ Error parsing references:", error);
    return [];
  }
};
