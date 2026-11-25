import { hasOpenRouterKey, openRouterChat } from "@/lib/openrouter";
import { hasGeminiKey, geminiGenerateJson } from "@/lib/gemini";
import { deepSeekChat, hasDeepSeekKey } from "@/lib/deepseek";
import { parseJsonObjectSafe } from "@/lib/safe-json";

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
 * Strips page markers, slide headers, and repetitive page numbering noise from document text.
 */
export function stripPageNoise(text: string): string {
  if (!text) return "";
  return text
    // Strip "--- Page X ---" and "--- Slide X ---" line markers
    .replace(/^---\s*(?:Page|Slide)\s*\d+\s*---\s*$/gim, "\n")
    .replace(/---\s*(?:Page|Slide)\s*\d+\s*---/gi, "\n")
    // Strip repeating header lines with lecturer or course title repeated on slides
    .replace(/\bCourse Lecturer:\s*[^\n.]+\.?/gi, " ")
    // Strip repeating slide numbering like "1 / 38", "2 / 38", "Page 1 of 38"
    .replace(/\b\d+\s*\/\s*\d+\b/g, " ")
    .replace(/\bPage\s+\d+\s+of\s+\d+\b/gi, " ")
    // Normalize spaces and multiple blank lines
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Intelligent algorithmic fallback in case AI providers are unreachable or keys are not configured.
 * Cleans all page/slide markers and parses the transcript into structured topics, key definitions, and revision takeaways.
 */
function generateStructuredFallback(transcript: string, title: string, courseTitle?: string): OrganizedNoteContent {
  const cleaned = stripPageNoise(transcript);
  const paragraphs = cleaned
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    // Filter out slide headers, page numbers, or short fragments
    .filter((p) => p.length > 25 && !/^---\s*(?:Page|Slide)/i.test(p));

  const sentences = cleaned
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && !/course lecturer|---\s*page/i.test(s));

  // Synthesize executive summary from introductory sentences without page metadata
  const summary = sentences.slice(0, 4).join(" ") ||
    `This lecture on "${title}"${courseTitle ? ` (${courseTitle})` : ""} covers foundational principles, analytical methods, mathematical derivations, and practical applications presented in the material.`;

  // Dynamically extract natural headings and group paragraphs into cohesive sections
  const sections: OrganizedNoteSection[] = [];
  if (paragraphs.length >= 3) {
    const sectionCount = Math.min(6, Math.max(3, Math.ceil(paragraphs.length / 5)));
    const chunkSize = Math.ceil(paragraphs.length / sectionCount);

    for (let i = 0; i < sectionCount; i++) {
      const slice = paragraphs.slice(i * chunkSize, (i + 1) * chunkSize);
      if (slice.length) {
        // Try to identify a heading from the first line of the slice
        const firstLine = slice[0].split(/[.:\n]/)[0].trim();
        const headingText = (firstLine.length > 5 && firstLine.length < 75)
          ? firstLine
          : `Core Topic ${i + 1}: Analytical Study`;

        sections.push({
          heading: `${i + 1}. ${headingText}`,
          body: slice.join("\n\n"),
          bullets: slice.slice(0, 4).map((p) => {
            const trimmed = p.replace(/\s+/g, " ").trim();
            return trimmed.slice(0, 160) + (trimmed.length > 160 ? "…" : "");
          }),
          takeaways: [
            `Key insight: review ${headingText.toLowerCase()} for problem sets and exam preparation.`,
            `Connect these mechanisms to the broader objectives of ${courseTitle || title}.`,
          ],
        });
      }
    }
  } else {
    sections.push({
      heading: "1. Core Lecture Overview",
      body: cleaned || transcript,
      bullets: sentences.slice(0, 5),
      takeaways: [
        "Review key definitions, derivations, and formulas discussed in the source material.",
        "Highlight unfamiliar terms and cross-reference with syllabus materials.",
      ],
    });
  }

  // Extract realistic key terms from capitalized technical phrases or headers
  const detectedTerms: string[] = [];
  const termMatches = cleaned.match(/\b[A-Z][a-zA-Z]{3,}(?:\s+[A-Z][a-zA-Z]{3,}){1,2}\b/g) || [];
  for (const match of termMatches) {
    const t = match.trim();
    if (!detectedTerms.includes(t) && !/^(?:Page|Slide|Lecture|University|Chapter|Section|Table|Figure)/i.test(t)) {
      detectedTerms.push(t);
    }
    if (detectedTerms.length >= 6) break;
  }

  const keyTerms: OrganizedKeyTerm[] = detectedTerms.length >= 2
    ? detectedTerms.map((term) => ({
        term,
        definition: `Fundamental concept in ${title}, detailing theoretical principles, governing criteria, and problem-solving methods.`,
      }))
    : [
        {
          term: title.replace(/[-_]+/g, " ").trim() || "Main Subject",
          definition: `Foundational topic exploring analytical frameworks, problem definitions, and governing mechanisms.`,
        },
        {
          term: "Governing Principles & Equations",
          definition: "The core mathematical or theoretical relationships established in the material.",
        },
        {
          term: "Analytical Methods & Solutions",
          definition: "Techniques and procedures for solving problem instances and evaluating results.",
        },
      ];

  const takeaways: string[] = [
    `Master the fundamental formulas, definitions, and theorems presented in "${title}".`,
    "Review specific mechanisms, step-by-step procedures, and derivations from the material.",
    "Formulate connections between this material and surrounding module coursework.",
    "Use active recall questions to verify understanding before upcoming examinations.",
  ];

  const studyQuestions: OrganizedStudyQuestion[] = [
    {
      question: `What are the primary governing principles or theorems analyzed in "${title}"?`,
      answer: summary,
    },
    {
      question: "What mathematical or conceptual methods are introduced to solve problems in this topic?",
      answer: "Refer to the core sections and analytical frameworks outlined above.",
    },
    {
      question: "How do the concepts in this lecture apply to practical exam scenarios or problem sets?",
      answer: "They establish the theoretical foundation and derivation steps needed for multi-step problem solving.",
    },
  ];

  const actionChecklist: string[] = [
    "Re-read the core sections and verify understanding of all key terms and equations.",
    "Practice deriving key formulas and solutions step-by-step without looking at notes.",
    "Add lecture points to your personal revision schedule in the Study Planner.",
  ];

  return {
    title: `${title} — Study Notes`,
    summary,
    keyTerms,
    sections,
    takeaways,
    studyQuestions,
    actionChecklist,
  };
}

/**
 * Call Gemini API directly with automatic model resilience, generous token ceiling, and LaTeX-safe JSON parsing.
 */
async function callGeminiForNotes(prompt: string): Promise<OrganizedNoteContent> {
  const { text } = await geminiGenerateJson(prompt, {
    temperature: 0.2,
    maxOutputTokens: 16384,
  });
  if (!text) throw new Error("Gemini returned an empty response");
  return parseJsonObjectSafe<OrganizedNoteContent>(text);
}

function looksLikeGoodNotes(note: OrganizedNoteContent): boolean {
  if (!note || typeof note !== "object") return false;
  if (!note.summary || note.summary.trim().length < 40) return false;
  if (!Array.isArray(note.sections) || note.sections.length === 0) return false;
  const joined = note.sections.map((s) => s.heading || "").join(" ").toLowerCase();
  if (/loops\s*&\s*iteration|variables\s*&\s*data types/i.test(joined)) {
    const bodyJoin = note.sections.map((s) => s.body || "").join(" ");
    if (bodyJoin.length < 80) return false;
  }
  return true;
}

function sanitizeNoteContent(note: OrganizedNoteContent, title: string): OrganizedNoteContent {
  const cleanText = (s: string) =>
    (s || "")
      .replace(/^-{2,}\s*Page\s*\d+\s*-{2,}.*$/gim, "")
      .replace(/\bCourse Lecturer:[^.]*\.?/gi, "")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

  const sections = (note.sections || [])
    .map((sec, idx) => ({
      heading: cleanText(sec.heading || `Section ${idx + 1}`),
      body: cleanText(sec.body || ""),
      bullets: (sec.bullets || []).map(cleanText).filter(Boolean),
      takeaways: (sec.takeaways || []).map(cleanText).filter(Boolean),
    }))
    .filter((sec) => sec.body.length > 20 || (sec.bullets && sec.bullets.length > 0));

  const keyTerms = (note.keyTerms || [])
    .map((kt) => ({
      term: cleanText(kt.term || ""),
      definition: cleanText(kt.definition || ""),
    }))
    .filter((kt) => kt.term.length > 1 && kt.definition.length > 5);

  return {
    title: cleanText(note.title || `${title} — Study Notes`),
    summary: cleanText(note.summary || ""),
    keyTerms,
    sections,
    takeaways: (note.takeaways || []).map(cleanText).filter(Boolean),
    studyQuestions: (note.studyQuestions || [])
      .map((sq) => ({
        question: cleanText(sq.question || ""),
        answer: cleanText(sq.answer || ""),
      }))
      .filter((sq) => sq.question.length > 5),
    actionChecklist: (note.actionChecklist || []).map(cleanText).filter(Boolean),
  };
}

/**
 * Generate comprehensive, university-grade structured notes from an uploaded lecture document or transcript.
 */
export async function generateOrganizedNote(params: {
  transcript: string;
  title: string;
  courseTitle?: string;
}): Promise<OrganizedNoteContent> {
  const { transcript, title, courseTitle } = params;

  if (!transcript || transcript.trim().length === 0) {
    throw new Error("Cannot generate notes from an empty document or transcript.");
  }

  // Pre-clean page and slide noise
  const cleanedFull = stripPageNoise(transcript);
  // Support comprehensive documents (up to 300,000 characters / ~50,000 words in a single holistic pass)
  const clipped = cleanedFull.slice(0, 300_000);

  const systemInstructions = `You are StudyStation's expert academic AI professor and masterclass study coach.
Your job is to transform the provided source document or lecture into organized, comprehensive, university-grade study notes.

CRITICAL INSTRUCTIONS ON CONTENT SYNTHESIS & ANTI-META DIRECTIVE:
1. STRICT ZERO META-COMMENTARY RULE:
   - NEVER write meta-commentary about the pages, slides, or document structure.
   - ABSOLUTELY FORBIDDEN PHRASES: "Page 1 introduces...", "Slide 2 outlines...", "This slide presents...", "The document describes...", "The presentation covers...", "As stated in the outline...".
   - Treat the input as a unified academic textbook or masterclass lecture. Teach the ACTUAL SUBJECT MATTER directly to the student.
   - If the material includes slide or page markers, IGNORE them completely and NEVER mention pages or slides in your output.
   - Synthesize the core technical substance, theories, principles, mechanisms, and applications found throughout the entire document.

2. DEPTH, SUBSTANCE, AND RIGOR:
   - Provide concrete, rigorous explanations of underlying concepts, theories, principles, mechanisms, and real-world examples.
   - Explain the "how" and "why" behind concepts in substantive, clear paragraphs. Do NOT produce superficial one-sentence summaries.
   - For mathematical, engineering, or scientific topics, include relevant formulas, step-by-step mechanisms, and derivations. Format all mathematical and scientific notation in LaTeX ($...$ for inline expressions, $$...$$ for standalone equations). Ensure all LaTeX backslashes are properly escaped in JSON (e.g. \\\\frac{a}{b}, \\\\Delta, \\\\theta, \\\\lambda).

3. COMPLETE THEMATIC SYNTHESIS:
   - Synthesize the ENTIRE document from first principles to the final conclusions. Group related concepts into 4 to 8 cohesive thematic sections reflecting the actual topics of the material.
   - Give each section a clear, descriptive heading drawn from the subject matter, deep explanatory paragraphs, concrete application bullets, and key exam takeaways.
   - Extract 6 to 12 critical technical or academic key terms with substantive definitions.
   - Provide 4 to 6 deep active recall study questions with detailed model answers.

Structure the response strictly as valid JSON with this exact schema:
{
  "title": "Clear, informative note title reflecting the actual subject matter",
  "summary": "2 to 4 detailed paragraphs providing an executive academic summary of the core thesis, foundational theories, and major analytical frameworks presented across the material",
  "keyTerms": [
    {
      "term": "Term Name",
      "definition": "Precise, thorough academic definition explaining what it is, how it works, and its significance"
    }
  ],
  "sections": [
    {
      "heading": "1. Thematic Section Heading",
      "body": "In-depth, comprehensive explanation of this topic in thorough paragraphs explaining mechanisms, core principles, and analytical nuance",
      "bullets": ["Concrete application, proof, or key detail 1", "Concrete application, proof, or key detail 2"],
      "takeaways": ["Essential conceptual insight for exam preparation"]
    }
  ],
  "takeaways": [
    "High-yield exam takeaway 1",
    "High-yield exam takeaway 2",
    "High-yield exam takeaway 3",
    "High-yield exam takeaway 4"
  ],
  "studyQuestions": [
    {
      "question": "Deep active-recall concept question testing understanding of mechanisms or trade-offs?",
      "answer": "Thorough, accurate model answer explaining the principle and reasoning"
    }
  ],
  "actionChecklist": [
    "Concrete revision task or practice problem to test mastery",
    "Specific concept or formula derivation to practice without notes"
  ]
}

Guidelines:
- Ground every section and definition strictly in the provided lecture or document. Do not hallucinate outside facts.
- Output ONLY valid JSON. No markdown backticks or commentary outside the JSON object.`;

  const userPrompt = `LECTURE TITLE: "${title}"
${courseTitle ? `COURSE: "${courseTitle}"` : ""}

SOURCE MATERIAL:
${clipped}

Produce rich, university-grade study notes. Section headings must reflect what is actually discussed in the source material.`;

  // 1. Prefer Google Gemini directly (generous 1M context window, fast, rich output)
  if (hasGeminiKey()) {
    try {
      const parsed = await callGeminiForNotes(`${systemInstructions}\n\n${userPrompt}`);
      if (looksLikeGoodNotes(parsed)) {
        return sanitizeNoteContent(parsed, title);
      }
    } catch (err) {
      console.warn("[NoteGenerator] Gemini note generation failed:", err);
    }
  }

  // 2. OpenRouter fallback if configured
  if (hasOpenRouterKey()) {
    try {
      const model =
        process.env.OPENROUTER_STUDY_MODEL ?? process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
      const raw = await openRouterChat(
        [
          { role: "system", content: systemInstructions },
          { role: "user", content: userPrompt },
        ],
        { model, temperature: 0.2, maxTokens: 12000 },
      );
      const parsed = parseJsonObjectSafe<OrganizedNoteContent>(raw);
      if (looksLikeGoodNotes(parsed)) {
        return sanitizeNoteContent(parsed, title);
      }
    } catch (err) {
      console.warn("[NoteGenerator] OpenRouter note generation failed:", err);
    }
  }

  // 3. DeepSeek is the final hosted provider before the local organizer.
  if (hasDeepSeekKey()) {
    try {
      const raw = await deepSeekChat(
        [
          { role: "system", content: systemInstructions },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.2, maxTokens: 8192 },
      );
      const parsed = parseJsonObjectSafe<OrganizedNoteContent>(raw);
      if (looksLikeGoodNotes(parsed)) {
        return sanitizeNoteContent(parsed, title);
      }
    } catch (err) {
      console.warn("[NoteGenerator] DeepSeek note generation failed:", err);
    }
  }

  console.warn("[NoteGenerator] Falling back to intelligent structured organizer");
  // 4. Fallback to intelligent structured organizer (cleaned of all page/slide markers)
  return sanitizeNoteContent(generateStructuredFallback(cleanedFull, title, courseTitle), title);
}
