import { memo, useEffect, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Cleans LaTeX expressions by removing delimiters
 */
const cleanLatexExpression = (expression, displayMode = false) => {
  if (!expression) return expression;

  let cleanedExpression = expression;

  // Remove display mode delimiters
  if (displayMode) {
    // Handle $$ ... $$ format
    if (
      cleanedExpression.startsWith("$$") &&
      cleanedExpression.endsWith("$$")
    ) {
      cleanedExpression = cleanedExpression.slice(2, -2).trim();
    }
    // Handle \[ ... \] format
    else if (
      cleanedExpression.startsWith("\\[") &&
      cleanedExpression.endsWith("\\]")
    ) {
      cleanedExpression = cleanedExpression.slice(2, -2).trim();
    }
    // Handle [ ... ] format
    else if (
      cleanedExpression.startsWith("[") &&
      cleanedExpression.endsWith("]") &&
      !cleanedExpression.startsWith("[$")
    ) {
      cleanedExpression = cleanedExpression.slice(1, -1).trim();
    }
  }
  // Remove inline mode delimiters
  else {
    // Handle $ ... $ format
    if (cleanedExpression.startsWith("$") && cleanedExpression.endsWith("$")) {
      cleanedExpression = cleanedExpression.slice(1, -1).trim();
    }
    // Handle \( ... \) format
    else if (
      cleanedExpression.startsWith("\\(") &&
      cleanedExpression.endsWith("\\)")
    ) {
      cleanedExpression = cleanedExpression.slice(2, -2).trim();
    }
  }

  // Remove potential wrapping with f(x) notation
  if (cleanedExpression.startsWith("f(x")) {
    const equalsIndex = cleanedExpression.indexOf("=");
    if (equalsIndex > 0) {
      cleanedExpression = cleanedExpression.substring(equalsIndex + 1).trim();
    }
  }

  return cleanedExpression;
};

/**
 * Renders LaTeX expressions with proper error handling
 */
const LaTeXRenderer = memo(
  ({ expression, displayMode = false, errorColor = "#cc0000" }) => {
    const [html, setHtml] = useState("");
    const [error, setError] = useState(null);

    useEffect(() => {
      try {
        if (!expression) {
          setHtml("");
          setError(null);
          return;
        }

        // Clean the expression (remove delimiters if present)
        const cleanedExpression = cleanLatexExpression(expression, displayMode);

        // Render using KaTeX
        const katexHTML = katex.renderToString(cleanedExpression, {
          displayMode: displayMode,
          throwOnError: false,
          errorColor: errorColor,
          trust: true,
          strict: "ignore",
          output: "html",
          macros: {
            "\\R": "\\mathbb{R}",
            "\\N": "\\mathbb{N}",
            "\\Z": "\\mathbb{Z}",
            "\\Q": "\\mathbb{Q}",
            "\\C": "\\mathbb{C}",
          },
        });

        setHtml(katexHTML);
        setError(null);
      } catch (err) {
        console.error(
          "LaTeX rendering error:",
          err,
          "in expression:",
          expression
        );
        setError(err.message || "Error rendering LaTeX");
      }
    }, [expression, displayMode, errorColor]);

    if (error) {
      return (
        <span className="text-red-500 italic" title={error}>
          Error rendering LaTeX: {error}
        </span>
      );
    }

    return (
      <span
        className={`latex-container ${
          displayMode ? "block my-4 text-center" : "inline"
        }`}
        dangerouslySetInnerHTML={{ __html: html }}
        role="math"
        aria-label={expression}
      />
    );
  }
);

LaTeXRenderer.displayName = "LaTeXRenderer";

/**
 * Enhanced LaTeX detection - checks if a string contains LaTeX
 */
const containsLaTeX = (text) => {
  if (!text) return false;

  const str = String(text);

  // Standard LaTeX delimiters
  if (
    str.includes("$$") ||
    (str.includes("$") && !/\$\d+(?:\.\d+)?/.test(str))
  ) {
    // Avoid matching currency
    return true;
  }

  // Check for \( ... \) notation for inline math
  if (str.includes("\\(") || str.includes("\\)")) {
    return true;
  }

  // Check for \[ ... \] notation for display math
  if (str.includes("\\[") || str.includes("\\]")) {
    return true;
  }

  // Check for square bracket notation with LaTeX symbols
  if (
    /\[[^\]]*\\(?:frac|sigma|mu|pi|sum|int|alpha|beta|gamma|delta|theta|partial|nabla)[^\]]*\]/g.test(
      str
    )
  ) {
    return true;
  }

  // Check for function notation with LaTeX
  if (/f\(x\)[^=\n]{0,10}=(?:\s*\\frac|\s*\{|\s*[a-z0-9]\\)/g.test(str)) {
    return true;
  }

  // Check for common LaTeX commands
  const commonLatexCommands = [
    "\\frac",
    "\\sqrt",
    "\\sum",
    "\\prod",
    "\\int",
    "\\lim",
    "\\sigma",
    "\\mu",
    "\\alpha",
    "\\beta",
    "\\gamma",
    "\\delta",
    "\\epsilon",
    "\\zeta",
    "\\eta",
    "\\theta",
    "\\iota",
    "\\kappa",
    "\\lambda",
    "\\nu",
    "\\xi",
    "\\pi",
    "\\rho",
    "\\tau",
    "\\phi",
    "\\chi",
    "\\psi",
    "\\omega",
    "\\Gamma",
    "\\Delta",
    "\\Theta",
    "\\Lambda",
    "\\Xi",
    "\\Pi",
    "\\Sigma",
    "\\Phi",
    "\\Psi",
    "\\Omega",
    "\\infty",
    "\\partial",
    "\\nabla",
    "\\forall",
    "\\exists",
  ];

  for (const cmd of commonLatexCommands) {
    if (str.includes(cmd)) {
      return true;
    }
  }

  // Check for specific mathematical patterns
  const mathPatterns = [
    // Integrals
    /\\int(?:_[^{}\s]+|\{[^{}]+\})?(?:\^[^{}\s]+|\{[^{}]+\})?/,
    // Limits
    /\\lim_\{[^{}]+\}/,
    // Subscripts and superscripts with braces
    /_\{[^{}]+\}|\^\{[^{}]+\}/,
    // Matrices
    /\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix)\}/,
    // Aligned equations
    /\\begin\{(?:align|gather|equation)\}/,
  ];

  for (const pattern of mathPatterns) {
    if (pattern.test(str)) {
      return true;
    }
  }

  return false;
};

/**
 * Processes text to find and render LaTeX formulas
 */
const LaTeXProcessor = memo(({ children, className = "" }) => {
  const [components, setComponents] = useState([]);

  useEffect(() => {
    if (!children) {
      setComponents([]);
      return;
    }

    const text = String(children);
    const result = [];
    let lastIndex = 0;

    // Define all the possible LaTeX patterns (most specific first)
    const patterns = [
      // Display mode: $$ ... $$
      { regex: /\$\$([\s\S]*?)\$\$/g, displayMode: true },

      // Display mode: \[ ... \]
      { regex: /\\\[([\s\S]*?)\\\]/g, displayMode: true },

      // Inline mode: \( ... \)
      { regex: /\\\(([\s\S]*?)\\\)/g, displayMode: false },

      // Function notation with standard form of Gaussian distribution
      {
        regex:
          /f\(x\)\s*=\s*(\\frac\{1\}\{(?:\\sigma|σ)\\sqrt\{2\\pi\}\}[\s\S]*?(?:2(?:\\sigma|σ)\^2\}\)|\}))/g,
        displayMode: true,
        processMatch: (match) => `f(x) = ${match[1]}`,
      },

      // Function notation with display-style equations
      {
        regex:
          /(?:^|\n)[ \t]*f\(x\)\s*=\s*\\frac\{1\}\{(?:\\sigma|σ)\\sqrt\{2\\pi\}\}[\s\S]*?(?:2(?:\\sigma|σ)\^2\}\)|\})(?=\s*\n|$)/g,
        displayMode: true,
        processMatch: (match) => `$$${match[0]}$$`,
      },

      // Display mode with square brackets
      {
        regex: /\[(f\(x\)|f\([^\)]+\))[^=\n]{0,10}=\s*[\s\S]*?\]/g,
        displayMode: true,
      },

      // Display mode with common LaTeX commands in square brackets
      {
        regex:
          /\[[^\]]*\\(?:frac|sum|int|sigma|mu|pi|theta|alpha|beta|gamma)[^\]]*\]/g,
        displayMode: true,
      },

      // Inline mode: $ ... $
      {
        regex: /\$([^\$\n]+?)\$/g,
        displayMode: false,
        // Skip if it looks like currency
        processShouldMatch: (match) => !/^\$\d+(?:\.\d+)?$/.test(match[0]),
      },

      // Common LaTeX commands without delimiters
      {
        regex:
          /(\\frac\{[^{}]+\}\{[^{}]+\}|\\sqrt\{[^{}]+\}|\\sum_\{[^{}]+\}(?:\^\{[^{}]+\})?)/g,
        displayMode: false,
        processMatch: (match) => `$${match[0]}$`,
      },
    ];

    // First collect all matches
    let allMatches = [];

    patterns.forEach(
      ({ regex, displayMode, processMatch, processShouldMatch }) => {
        let match;
        // Create a copy of the regex to avoid lastIndex issues
        const regexCopy = new RegExp(regex.source, regex.flags);
        while ((match = regexCopy.exec(text)) !== null) {
          // Skip if processShouldMatch returns false
          if (processShouldMatch && !processShouldMatch(match)) {
            continue;
          }

          const content = processMatch ? processMatch(match) : match[0];
          allMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            content: content,
            displayMode,
          });
        }
      }
    );

    // Sort matches by start position
    allMatches.sort((a, b) => a.start - b.start);

    // Remove overlapping matches (keep the longer one)
    const filteredMatches = [];
    for (let i = 0; i < allMatches.length; i++) {
      const current = allMatches[i];
      let overlapping = false;

      for (let j = 0; j < filteredMatches.length; j++) {
        const existing = filteredMatches[j];

        // Check if current match overlaps with any existing match
        if (!(current.end <= existing.start || current.start >= existing.end)) {
          // If they overlap, keep the longer one
          if (current.end - current.start > existing.end - existing.start) {
            filteredMatches[j] = current;
          }
          overlapping = true;
          break;
        }
      }

      if (!overlapping) {
        filteredMatches.push(current);
      }
    }

    // Re-sort filtered matches
    filteredMatches.sort((a, b) => a.start - b.start);

    // Process text with matches
    for (let i = 0; i < filteredMatches.length; i++) {
      const match = filteredMatches[i];

      // Add text before this match
      if (match.start > lastIndex) {
        result.push(text.substring(lastIndex, match.start));
      }

      // Add the LaTeX component
      result.push(
        <LaTeXRenderer
          key={`latex-${i}`}
          expression={match.content}
          displayMode={match.displayMode}
        />
      );

      lastIndex = match.end;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }

    setComponents(result);
  }, [children]);

  return <div className={className}>{components}</div>;
});

LaTeXProcessor.displayName = "LaTeXProcessor";

export { LaTeXRenderer, LaTeXProcessor, containsLaTeX };
export default LaTeXProcessor;
