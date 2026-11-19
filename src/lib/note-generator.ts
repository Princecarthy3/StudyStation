import { hasOpenRouterKey, openRouterChat, parseJsonObject } from "@/lib/openrouter";
import { hasGeminiKey, geminiGenerateJson, geminiChat } from "@/lib/gemini";

export type OrganizedKeyTerm = {
  term: string;
  definition: string;
};

export type OrganizedNoteSection = {
  heading: string;
  body: string;
  bullets?: string[];
  takeaways?: string[];
};

export type OrganizedStudyQuestion = {
  question: string;
  answer?: string;
};

export type OrganizedNoteContent = {
  title: string;
  summary: string;
  keyTerms: OrganizedKeyTerm[];
  sections: OrganizedNoteSection[];
  takeaways: string[];
  studyQuestions: OrganizedStudyQuestion[];
  actionChecklist: string[];
};

export type NoteRecord = {
  id: string;
  userId: string;
  lectureId: string;
  title: string;
  summary: string;
  content: OrganizedNoteContent;
  createdAt: string;
  updatedAt: string;
};

/**
 * Intelligent algorithmic fallback in case AI providers are unreachable or keys are not configured.
 * Parses the raw transcript into structured topics, key definitions, and revision takeaways.
 */
function stripPageNoise(text: string): string {
  return text
    .replace(/^-{2,}\s*Page\s*\d+\s*-{2,}\s*/gim, "\n")
    .replace(/^---\s*Page\s*\d+\s*---\s*/gim, "\n")
    .replace(/\bCourse Lecturer:\s*[^\n.]+/gi, " ")
    .replace(/\bProgramming with Java:\s*CE\s*\d+/gi, " ")
    .replace(/\bCE\s*\d+\b/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractDefinitionCandidates(text: string): OrganizedKeyTerm[] {
  const terms: OrganizedKeyTerm[] = [];
  const seen = new Set<string>();
  const patterns = [
    /(?:What is|What are)\s+([A-Z][A-Za-z0-9 /\-]{2,60})\??\s*([A-Z][^.]{20,220}\.)/g,
    /([A-Z][A-Za-z0-9 /\-]{2,40})\s+is\s+(?:a|an|the)\s+([^.]{20,180}\.)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null && terms.length < 12) {
      const term = m[1].trim().replace(/\s+/g, " ");
      const definition = m[2].trim().replace(/\s+/g, " ");
      const key = term.toLowerCase();
      if (seen.has(key) || term.length < 3 || definition.length < 20) continue;
      if (/page|slide|lecturer|course/i.test(term)) continue;
      seen.add(key);
      terms.push({ term, definition });
    }
  }
  return terms;
}

/**
 * Algorithmic fallback when AI providers fail. Still produces usable study notes
 * instead of dumping raw page OCR.
 */
function generateStructuredFallback(transcript: string, title: string, courseTitle?: string): OrganizedNoteContent {
  const cleaned = stripPageNoise(transcript);
  const paragraphs = cleaned
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40 && !/^page\s*\d+/i.test(p));

  const sentences = cleaned
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && !/course lecturer|---\s*page/i.test(s));

  const summary =
    sentences.slice(0, 4).join(" ") ||
    `Study notes for "${title}"${courseTitle ? ` (${courseTitle})` : ""}. Review the structured sections below for the main ideas covered in this material.`;

  const topicHints = [
    { re: /variable|data type|declaration|assignment/i, heading: "Variables & Data Types" },
    { re: /operator|increment|cast|numeric/i, heading: "Operators & Type Conversion" },
    { re: /loop|while|for\b|do-while|iteration/i, heading: "Loops & Iteration" },
    { re: /if\b|selection|boolean|condition/i, heading: "Selections & Conditions" },
    { re: /array|arraylist|hashmap|hashset|data structure/i, heading: "Arrays & Data Structures" },
    { re: /class|object|inheritance|polymorphism|method/i, heading: "Classes, Objects & Methods" },
    { re: /exception|try|catch|input\/output|i\/o/i, heading: "Exceptions & I/O" },
    { re: /swing|javafx|gui|event handler|application/i, heading: "GUI & Application Development" },
    { re: /operating system|compiler|interpreter|machine language|assembly/i, heading: "Computing Foundations" },
    { re: /java programming language|jdk|api|specification/i, heading: "Java Language Fundamentals" },
  ];

  const buckets = new Map<string, string[]>();
  for (const para of paragraphs) {
    let placed = false;
    for (const hint of topicHints) {
      if (hint.re.test(para)) {
        const list = buckets.get(hint.heading) ?? [];
        if (list.length < 8) list.push(para.slice(0, 600));
        buckets.set(hint.heading, list);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const list = buckets.get("Core Concepts") ?? [];
      if (list.length < 6) list.push(para.slice(0, 600));
      buckets.set("Core Concepts", list);
    }
  }

  const sections: OrganizedNoteSection[] = [];
  let i = 1;
  for (const [heading, paras] of buckets) {
    if (!paras.length) continue;
    const body = paras.slice(0, 5).join("\n\n");
    sections.push({
      heading: `${i}. ${heading}`,
      body,
      bullets: paras.slice(0, 5).map((p) => {
        const first = p.split(/(?<=[.?!])\s+/)[0] || p;
        return first.slice(0, 180) + (first.length > 180 ? "…" : "");
      }),
      takeaways: [`Be able to explain ${heading.toLowerCase()} with a clear example.`],
    });
    i += 1;
    if (sections.length >= 7) break;
  }

  if (!sections.length) {
    sections.push({
      heading: "1. Core Lecture Overview",
      body: cleaned.slice(0, 2500),
      bullets: sentences.slice(0, 6),
      takeaways: ["Review the material and extract definitions of unfamiliar terms."],
    });
  }

  let keyTerms = extractDefinitionCandidates(cleaned);
  if (keyTerms.length < 3) {
    keyTerms = [
      ...keyTerms,
      {
        term: title.replace(/[-_]+/g, " ").replace(/\b20\d{2}\b/g, "").trim().slice(0, 60) || "Lecture topic",
        definition: sentences[0] || "Primary subject covered in this lecture material.",
      },
    ].slice(0, 8);
  }

  return {
    title: `${title} — Study Notes`,
    summary,
    keyTerms,
    sections,
    takeaways: [
      `Identify and define the main terms from "${title}".`,
      "Rewrite each section heading as a short explanation in your own words.",
      "Practice one worked example from each major topic before the next class.",
      "Use the active-recall questions below without looking at the answers first.",
    ],
    studyQuestions: [
      {
        question: `What are the main topics covered in "${title}" and how do they connect?`,
        answer: sections.map((s) => s.heading.replace(/^\d+\.\s*/, "")).join("; "),
      },
      {
        question: "Name two key terms from this material and explain each briefly.",
        answer: keyTerms.slice(0, 2).map((k) => `${k.term}: ${k.definition}`).join(" "),
      },
      {
        question: "What would you need to be able to do on an exam based on this lecture?",
        answer: "Explain core definitions, apply procedures or syntax correctly, and connect topics across sections.",
      },
    ],
    actionChecklist: [
      "Re-read the thematic sections and highlight definitions you cannot yet explain.",
      "Write a one-paragraph summary of the lecture from memory.",
      "Schedule a short revision block for this lecture in the Study Planner.",
    ],
  };
}

/**
 * Call Gemini API directly with automatic model resilience and generous token ceiling.
 */
async function callGeminiForNotes(prompt: string): Promise<OrganizedNoteContent> {
  const { text } = await geminiGenerateJson(prompt, {
    temperature: 0.2,
    maxOutputTokens: 8192,
  });
  if (!text) throw new Error("Gemini returned an empty response");
  return parseJsonObject<OrganizedNoteContent>(text);
}

/**
 * Generate a comprehensive, university-grade structured note from raw lecture transcript.
 */
export async function generateOrganizedNote(params: {
  transcript: string;
  title: string;
  courseTitle?: string;
}): Promise<OrganizedNoteContent> {
  const { transcript, title, courseTitle } = params;

  if (!transcript || transcript.trim().length === 0) {
    throw new Error("Cannot generate notes from an empty transcript.");
  }

  const cleanedFull = stripPageNoise(transcript);
  // Cap raw payload; long docs use map-reduce instead of one giant prompt.
  const SINGLE_PASS_LIMIT = 28_000;
  const MAP_CHUNK = 12_000;

  const systemInstructions = `You are StudyStation's expert academic study coach for university students.
Transform the source material into organized, exam-ready study notes about the SUBJECT — not about the document.

HARD RULES:
1. NEVER describe pages, slides, or document structure. Forbidden: "Page 1 introduces", "This slide shows", "The document covers", "Course Lecturer", page numbers.
2. Teach the actual concepts: definitions, mechanisms, syntax/examples, comparisons, and when to use them.
3. Write concrete notes a student can revise from. Prefer clear paragraphs + precise bullets over vague commentary.
4. For multi-topic material, group into 4–8 thematic sections (e.g. Variables, Loops, OOP) — not page order.
5. keyTerms must be real technical terms with accurate definitions from the material (not "Core Methodology").
6. summary must be 2–4 substantive paragraphs of the substance, not an agenda or title list.
7. Return ONLY valid JSON matching the schema. No markdown fences.

JSON schema:
{
  "title": "string",
  "summary": "string",
  "keyTerms": [{"term": "string", "definition": "string"}],
  "sections": [{"heading": "string", "body": "string", "bullets": ["string"], "takeaways": ["string"]}],
  "takeaways": ["string"],
  "studyQuestions": [{"question": "string", "answer": "string"}],
  "actionChecklist": ["string"]
}`;

  async function synthesizeFromText(sourceText: string, mode: "full" | "final"): Promise<OrganizedNoteContent | null> {
    const userPrompt =
      mode === "final"
        ? `LECTURE TITLE: "${title}"
${courseTitle ? `COURSE: "${courseTitle}"` : ""}

Below are partial digests extracted from a long lecture/document. Merge them into ONE coherent set of study notes. Drop duplicates, remove any page/slide language, and produce deep thematic sections.

PARTIAL DIGESTS:
${sourceText}`
        : `LECTURE TITLE: "${title}"
${courseTitle ? `COURSE: "${courseTitle}"` : ""}

SOURCE MATERIAL:
${sourceText}`;

    if (hasGeminiKey()) {
      try {
        const parsed = await callGeminiForNotes(`${systemInstructions}\n\n${userPrompt}`);
        if (parsed.summary && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          return {
            title: parsed.title || `${title} — Study Notes`,
            summary: parsed.summary,
            keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms : [],
            sections: parsed.sections,
            takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways : [],
            studyQuestions: Array.isArray(parsed.studyQuestions) ? parsed.studyQuestions : [],
            actionChecklist: Array.isArray(parsed.actionChecklist) ? parsed.actionChecklist : [],
          };
        }
      } catch (err) {
        console.warn("Gemini note generation failed:", err);
      }
    }

    if (hasOpenRouterKey()) {
      try {
        const model = process.env.OPENROUTER_STUDY_MODEL ?? process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
        const raw = await openRouterChat(
          [
            { role: "system", content: systemInstructions },
            { role: "user", content: userPrompt },
          ],
          { model, temperature: 0.2, maxTokens: 8000 },
        );
        const parsed = parseJsonObject<OrganizedNoteContent>(raw);
        if (parsed.summary && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          return {
            title: parsed.title || `${title} — Study Notes`,
            summary: parsed.summary,
            keyTerms: Array.isArray(parsed.keyTerms) ? parsed.keyTerms : [],
            sections: parsed.sections,
            takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways : [],
            studyQuestions: Array.isArray(parsed.studyQuestions) ? parsed.studyQuestions : [],
            actionChecklist: Array.isArray(parsed.actionChecklist) ? parsed.actionChecklist : [],
          };
        }
      } catch (err) {
        console.warn("OpenRouter note generation failed:", err);
      }
    }

    return null;
  }

  // Short / medium docs: single pass
  if (cleanedFull.length <= SINGLE_PASS_LIMIT) {
    const result = await synthesizeFromText(cleanedFull, "full");
    if (result) return sanitizeNoteContent(result, title);
    return sanitizeNoteContent(generateStructuredFallback(cleanedFull, title, courseTitle), title);
  }

  // Long multi-page docs: map each chunk → mini digest, then reduce
  const digests: string[] = [];
  for (let offset = 0, part = 1; offset < cleanedFull.length && part <= 12; offset += MAP_CHUNK, part += 1) {
    const chunk = cleanedFull.slice(offset, offset + MAP_CHUNK);
    if (chunk.trim().length < 200) continue;
    const mapPrompt = `Extract study digests from this part of a university lecture/document.
Return plain text (not JSON) with:
- Key concepts & definitions (bullet list)
- Important procedures, syntax, or examples
- Exam-relevant facts
Do NOT mention page numbers, slides, or "this section of the document".
TITLE: ${title}
PART ${part}:
${chunk}`;
    try {
      if (hasGeminiKey()) {
        const text = await geminiChat(
          [
            { role: "system", content: "Extract study digests as plain structured text only. No JSON. No page or slide references." },
            { role: "user", content: mapPrompt },
          ],
          { temperature: 0.1, maxOutputTokens: 2048 },
        );
        if (text?.trim()) digests.push(`### Part ${part}\n${text.trim()}`);
      } else if (hasOpenRouterKey()) {
        const raw = await openRouterChat(
          [
            { role: "system", content: "Extract study digests as plain text. No page/slide meta." },
            { role: "user", content: mapPrompt },
          ],
          {
            model: process.env.OPENROUTER_STUDY_MODEL ?? process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash",
            temperature: 0.1,
            maxTokens: 1800,
          },
        );
        if (raw?.trim()) digests.push(`### Part ${part}\n${raw.trim()}`);
      }
    } catch (err) {
      console.warn(`Note map pass ${part} failed:`, err);
      // Keep a trimmed raw slice so reduce still has signal
      digests.push(`### Part ${part}\n${chunk.slice(0, 2500)}`);
    }
  }

  if (digests.length) {
    const reduced = await synthesizeFromText(digests.join("\n\n").slice(0, 60_000), "final");
    if (reduced) return sanitizeNoteContent(reduced, title);
  }

  return sanitizeNoteContent(generateStructuredFallback(cleanedFull, title, courseTitle), title);
}

/** Drop page-meta leftovers and empty fields the model sometimes returns. */
function sanitizeNoteContent(note: OrganizedNoteContent, title: string): OrganizedNoteContent {
  const bad = /(page\s*\d+|slide\s*\d+|course lecturer|---\s*page)/i;
  const cleanText = (s: string) =>
    s
      .replace(/^-{2,}\s*Page\s*\d+\s*-{2,}.*$/gim, "")
      .replace(/\bCourse Lecturer:[^.]*\.?/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  const sections = (note.sections || [])
    .map((sec, idx) => ({
      heading: cleanText(sec.heading || `Section ${idx + 1}`),
      body: cleanText(sec.body || ""),
      bullets: (sec.bullets || []).map(cleanText).filter((b) => b && !bad.test(b)),
      takeaways: (sec.takeaways || []).map(cleanText).filter(Boolean),
    }))
    .filter((sec) => sec.body.length > 40 || (sec.bullets && sec.bullets.length > 0));

  const keyTerms = (note.keyTerms || [])
    .map((k) => ({ term: cleanText(k.term), definition: cleanText(k.definition) }))
    .filter((k) => k.term && k.definition && !/core methodology|primary findings|central subject/i.test(k.term));

  return {
    title: cleanText(note.title) || `${title} — Study Notes`,
    summary: cleanText(note.summary || ""),
    keyTerms: keyTerms.slice(0, 15),
    sections: sections.slice(0, 10),
    takeaways: (note.takeaways || []).map(cleanText).filter(Boolean).slice(0, 8),
    studyQuestions: (note.studyQuestions || [])
      .map((q) => ({ question: cleanText(q.question), answer: q.answer ? cleanText(q.answer) : undefined }))
      .filter((q) => q.question)
      .slice(0, 8),
    actionChecklist: (note.actionChecklist || []).map(cleanText).filter(Boolean).slice(0, 6),
  };
}
