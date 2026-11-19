/**
 * Highly resilient JSON parser designed for LLM outputs.
 * Handles:
 * 1. Markdown code fences (```json ... ```)
 * 2. Unescaped LaTeX backslashes inside JSON strings (e.g. \frac, \alpha, \partial)
 * 3. Trailing commas before closing brackets/braces
 * 4. Truncated JSON responses from token limits by auto-closing open strings and brackets
 */

function repairTruncatedJson(jsonStr: string): string {
  let str = jsonStr.trim();
  
  // If ends with trailing comma, strip it
  str = str.replace(/,\s*$/, "");

  // Track open structures
  const stack: string[] = [];
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (char === "\\" && !isEscaped) {
        isEscaped = true;
      } else {
        if (char === '"' && !isEscaped) {
          inString = false;
        }
        isEscaped = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === "{" || char === "[") {
        stack.push(char);
      } else if (char === "}") {
        if (stack.length && stack[stack.length - 1] === "{") stack.pop();
      } else if (char === "]") {
        if (stack.length && stack[stack.length - 1] === "[") stack.pop();
      }
    }
  }

  // If inside a string when cut off, close the string
  if (inString) {
    str += '"';
  }

  // Remove any trailing comma or dangling property name colon
  str = str.replace(/,\s*$/, "").replace(/:\s*$/, ': ""');

  // Close unclosed brackets and braces in reverse order
  while (stack.length > 0) {
    const open = stack.pop();
    if (open === "{") {
      str += "}";
    } else if (open === "[") {
      str += "]";
    }
  }

  return str;
}

function sanitizeLatexAndEscapes(raw: string): string {
  return raw
    // 1. Fix LaTeX commands that start with JSON escape letters: \frac, \beta, \theta, \rho, \nabla, etc.
    .replace(/\\([bfnrt])(?=[a-zA-Z])/g, "\\\\$1")
    // 2. Fix all other invalid JSON escape characters (e.g. \alpha, \lambda, \partial, \dots, etc.)
    .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\")
    // 3. Remove trailing commas before closing braces/brackets
    .replace(/,\s*([}\]])/g, "$1");
}

export function parseJsonObjectSafe<T>(value: string): T {
  if (!value || typeof value !== "string") {
    throw new Error("Cannot parse empty or non-string AI response");
  }

  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  if (start < 0) {
    throw new Error("AI response did not contain a JSON object");
  }

  // Try direct parse first
  const end = cleaned.lastIndexOf("}");
  const candidate = end > start ? cleaned.slice(start, end + 1) : cleaned.slice(start);

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Attempt LaTeX and invalid escape repair
    try {
      const sanitized = sanitizeLatexAndEscapes(candidate);
      return JSON.parse(sanitized) as T;
    } catch {
      // Attempt truncated JSON repair + sanitization
      try {
        const repaired = repairTruncatedJson(candidate);
        const sanitizedRepaired = sanitizeLatexAndEscapes(repaired);
        return JSON.parse(sanitizedRepaired) as T;
      } catch (finalErr) {
        throw new Error(
          `Failed to parse AI JSON response: ${finalErr instanceof Error ? finalErr.message : String(finalErr)}`
        );
      }
    }
  }
}
