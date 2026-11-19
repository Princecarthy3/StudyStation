import { hasOpenRouterKey, openRouterChat } from "@/lib/openrouter";
import { hasGeminiKey, geminiGenerateJson } from "@/lib/gemini";
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
 * Strips all page markers, slide headers, and repetitive slide footers from document text.
 */
export function cleanTranscript(raw: string): string {
  if (!raw) return "";
  return raw
    // Strip "--- Page X ---" or "--- Slide X ---" line markers
    .replace(/^---\s*(?:Page|Slide)\s*\d+\s*---\s*$/gim, "")
    // Strip inline "--- Page X ---"
    .replace(/---\s*(?:Page|Slide)\s*\d+\s*---/gi, "")
    // Strip repeating page numbers like "1 / 38", "2 / 38", "Page 1 of 38"
    .replace(/\b\d+\s*\/\s*\d+\b/g, "")
    .replace(/\bPage\s+\d+\s+of\s+\d+\b/gi, "")
    // Normalize spaces and multiple blank lines
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Intelligent algorithmic fallback in case AI providers are unreachable or keys are not configured.
 * Cleans all page/slide markers and parses the transcript into structured topics, key definitions, and revision takeaways.
 */
function generateStructuredFallback(transcript: string, title: string, courseTitle?: string): OrganizedNoteContent {
  const cleaned = cleanTranscript(transcript);
  const paragraphs = cleaned
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    // Filter out slide headers, page numbers, or short fragments
    .filter((p) => p.length > 25 && !/^---\s*(?:Page|Slide)/i.test(p));

  const sentences = cleaned
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && !/^---\s*(?:Page|Slide)/i.test(s));

  // Synthesize executive summary from introductory sentences without page metadata
  const summary = sentences.slice(0, 3).join(" ") ||
    `This lecture on "${title}" covers core principles, analytical methods, mathematical foundations, and practical applications presented in the material.`;

  // Dynamically group paragraphs into cohesive sections
  const sections: OrganizedNoteSection[] = [];
  if (paragraphs.length >= 3) {
    const sectionCount = Math.min(6, Math.max(3, Math.ceil(paragraphs.length / 5)));
    const chunkSize = Math.ceil(paragraphs.length / sectionCount);

    for (let i = 0; i < sectionCount; i++) {
      const slice = paragraphs.slice(i * chunkSize, (i + 1) * chunkSize);
      if (slice.length) {
        // Try to identify a heading from the first line of the slice
        const firstLine = slice[0].split(/[.:\n]/)[0].trim();
        const headingText = (firstLine.length > 5 && firstLine.length < 70)
          ? firstLine
          : `Core Topic ${i + 1}: Conceptual Analysis`;

        sections.push({
          heading: `${i + 1}. ${headingText}`,
          body: slice.join("\n\n"),
          bullets: slice.slice(0, 4).map((p) => {
            const trimmed = p.replace(/\s+/g, " ").trim();
            return trimmed.slice(0, 140) + (trimmed.length > 140 ? "…" : "");
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
    if (!detectedTerms.includes(t) && !t.includes("Page") && !t.includes("Lecture") && !t.includes("University") && !t.includes("Chapter")) {
      detectedTerms.push(t);
    }
    if (detectedTerms.length >= 5) break;
  }

  const keyTerms: OrganizedKeyTerm[] = detectedTerms.length >= 2
    ? detectedTerms.map((term) => ({
        term,
        definition: `Fundamental concept in ${title}, detailing core theoretical principles, governing criteria, and practical problem-solving methods.`,
      }))
    : [
        {
          term: title.replace(/[-_]+/g, " ").trim(),
          definition: `Foundational topic exploring analytical frameworks, problem definitions, and governing equations.`,
        },
        {
          term: "Governing Principles & Equations",
          definition: "The core mathematical or theoretical relationships established in the material.",
        },
        {
          term: "Analytical Solutions & Applications",
          definition: "Methods and techniques for solving problem instances and evaluating results.",
        },
      ];

  const takeaways: string[] = [
    `Master the fundamental formulas and theorems presented in "${title}".`,
    "Review specific definitions, step-by-step mechanisms, and derivations from the lecture.",
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
    "Re-read the core sections and verify understanding of all key equations.",
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
 * Call Gemini API directly with automatic model resilience and generous token ceiling.
 */
async function callGeminiForNotes(prompt: string): Promise<OrganizedNoteContent> {
  const { text } = await geminiGenerateJson(prompt, {
    temperature: 0.2,
    maxOutputTokens: 16384,
  });
  if (!text) throw new Error("Gemini returned an empty response");
  return parseJsonObjectSafe<OrganizedNoteContent>(text);
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

  // Pre-clean all page/slide markers and redundant numbering before passing to AI
  const cleaned = cleanTranscript(transcript);
  // Support comprehensive multi-page documents (up to ~300k chars / ~50k words)
  const clippedTranscript = cleaned.slice(0, 300_000);

  const systemInstructions = `You are StudyStation's expert academic AI professor and masterclass study coach.
Your job is to transform the provided source document or lecture into organized, comprehensive, university-grade study notes.

CRITICAL INSTRUCTIONS ON CONTENT SYNTHESIS & ANTI-META DIRECTIVE:
1. STRICT ZERO META-COMMENTARY RULE:
   - NEVER write meta-commentary about the pages, slides, or document structure.
   - ABSOLUTELY FORBIDDEN PHRASES: "Page 1 introduces...", "Slide 2 outlines...", "This slide presents...", "The document describes...", "The presentation covers...", "As stated in the outline...".
   - Treat the input as a unified academic textbook or masterclass lecture. Teach the ACTUAL SUBJECT MATTER directly to the student.
   - Ignore any remaining slide or page markers completely. NEVER mention pages or slides in your output.
   - If the beginning contains an outline, agenda, or title slide, DO NOT summarize it as an agenda. Immediately synthesize the core technical substance, theories, principles, and applications found throughout the entire document.

2. DEPTH, SUBSTANCE, AND RIGOR:
   - Provide concrete, rigorous explanations of underlying concepts, theories, principles, mechanisms, and real-world examples.
   - Explain the "how" and "why" behind concepts in substantive, clear paragraphs. Do NOT produce superficial one-sentence summaries.
   - For mathematical, engineering, or scientific topics, include relevant formulas, step-by-step mechanisms, and derivations. Format all mathematical and scientific notation in LaTeX ($...$ for inline expressions, $$...$$ for standalone equations). Ensure all LaTeX backslashes are properly escaped in JSON (e.g. \\\\frac{a}{b}, \\\\Delta, \\\\theta).

3. COMPLETE THEMATIC SYNTHESIS:
   - Synthesize the ENTIRE document from first principles to the final conclusions. Group related concepts into cohesive thematic units (3 to 7 thematic sections).

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
- Ground every section and definition in the provided lecture or document. Do not hallucinate outside facts.
- Identify 3 to 7 logical thematic sections based on the natural flow of the material.
- Extract 5 to 10 critical technical or academic key terms with substantive definitions.
- Provide 4 to 6 active recall study questions with detailed model answers.
- Output ONLY valid JSON. No markdown backticks or commentary outside the JSON object.`;

  const userPrompt = `LECTURE TITLE: "${title}"
${courseTitle ? `COURSE: "${courseTitle}"` : ""}

LECTURE CONTENT:
${clippedTranscript}`;

  // 1. Try Gemini API directly if configured (recommended: fast, generous 1M context)
  if (hasGeminiKey()) {
    try {
      const combinedPrompt = `${systemInstructions}\n\n${userPrompt}`;
      const parsed = await callGeminiForNotes(combinedPrompt);
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
    } catch (geminiErr) {
      console.error("[NoteGenerator] Gemini note generation failed:", geminiErr);
    }
  }

  // 2. Try OpenRouter if configured
  if (hasOpenRouterKey()) {
    try {
      const model = process.env.OPENROUTER_STUDY_MODEL ?? process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
      const raw = await openRouterChat(
        [
          { role: "system", content: systemInstructions },
          { role: "user", content: userPrompt },
        ],
        { model, temperature: 0.2, maxTokens: 12000 }
      );
      const parsed = parseJsonObjectSafe<OrganizedNoteContent>(raw);
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
    } catch (openRouterErr) {
      console.error("[NoteGenerator] OpenRouter note generation failed:", openRouterErr);
    }
  }

  console.warn("[NoteGenerator] Falling back to intelligent structured organizer");
  // 3. Fallback to algorithmic structural organizer (cleaned of all page/slide markers)
  return generateStructuredFallback(transcript, title, courseTitle);
}
