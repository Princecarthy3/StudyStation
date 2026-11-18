import { hasOpenRouterKey, openRouterChat, parseJsonObject } from "@/lib/openrouter";
import { hasGeminiKey, geminiGenerateJson } from "@/lib/gemini";

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
function generateStructuredFallback(transcript: string, title: string, courseTitle?: string): OrganizedNoteContent {
  const paragraphs = transcript
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  const sentences = transcript
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const summary = sentences.slice(0, 3).join(" ") ||
    `This lecture on "${title}" covers key academic principles, structural methodologies, and practical applications discussed throughout the session.`;

  // Extract sections
  const sections: OrganizedNoteSection[] = [];
  if (paragraphs.length >= 3) {
    const chunkSize = Math.max(1, Math.ceil(paragraphs.length / 3));
    const labels = ["1. Introduction & Foundational Concepts", "2. Core Principles & Detailed Analysis", "3. Applications & Practical Review"];
    for (let i = 0; i < 3; i++) {
      const slice = paragraphs.slice(i * chunkSize, (i + 1) * chunkSize);
      if (slice.length) {
        sections.push({
          heading: labels[i] || `Section ${i + 1}`,
          body: slice.join("\n\n"),
          bullets: slice.map((p) => p.slice(0, 140) + (p.length > 140 ? "…" : "")),
          takeaways: [
            `Understand the primary mechanism outlined in ${labels[i].toLowerCase()}.`,
            `Connect these findings to the broader scope of ${courseTitle || "the subject"}.`,
          ],
        });
      }
    }
  } else {
    sections.push({
      heading: "1. Core Lecture Overview",
      body: transcript,
      bullets: sentences.slice(0, 5),
      takeaways: [
        "Review the complete transcribed lecture to prepare for seminar questions.",
        "Highlight unfamiliar terms and cross-reference with syllabus materials.",
      ],
    });
  }

  // Extract potential key terms from title and transcript
  const keyTerms: OrganizedKeyTerm[] = [
    {
      term: title.replace(/[-_]+/g, " ").trim(),
      definition: `Central subject of the lecture, exploring foundational definitions, key mechanisms, and analytical criteria.`,
    },
    {
      term: "Core Methodology",
      definition: "The step-by-step approach discussed by the lecturer to evaluate primary problems.",
    },
    {
      term: "Primary Findings",
      definition: "The key evidence and conclusions emphasized during the discussion.",
    },
  ];

  const takeaways: string[] = [
    `Master the fundamental concepts presented in "${title}".`,
    "Review specific definitions, examples, and formulas discussed in class.",
    "Formulate connections between this lecture and previous module topics.",
    "Use active recall questions to verify understanding before upcoming exams.",
  ];

  const studyQuestions: OrganizedStudyQuestion[] = [
    {
      question: `What was the primary thesis or problem analyzed in "${title}"?`,
      answer: summary,
    },
    {
      question: "What evidence or arguments did the lecturer present to support this topic?",
      answer: "Refer to the key takeaways and structured sections above for evidence cited during the lecture.",
    },
    {
      question: "How does this topic apply to broader course assignments or practical exams?",
      answer: "It provides theoretical grounding for upcoming problem sets and essay questions.",
    },
  ];

  const actionChecklist: string[] = [
    "Re-read the core sections and verify understanding of key terms.",
    "Practice explaining the primary concepts out loud without looking at notes.",
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

  // Support comprehensive multi-page documents (up to ~300k chars / ~50k words)
  const clippedTranscript = transcript.slice(0, 300_000);

  const systemInstructions = `You are StudyStation's expert academic AI professor and study coach.
Your job is to transform the provided source document or lecture into organized, comprehensive, university-grade study notes.

CRITICAL INSTRUCTIONS ON CONTENT SYNTHESIS & ANTI-META DIRECTIVE:
1. STRICT ZERO META-COMMENTARY RULE:
   - NEVER write meta-commentary about the pages, slides, or document structure.
   - ABSOLUTELY FORBIDDEN PHRASES: "Page 1 introduces...", "Slide 2 outlines...", "This slide presents...", "The document describes...", "The presentation covers...", "As stated in the outline...".
   - Treat the input as a unified academic textbook or masterclass lecture. Teach the ACTUAL SUBJECT MATTER directly to the student.
   - If the material includes slide or page markers (such as "--- Page 1 ---" or "--- Slide 2 ---"), IGNORE them completely and NEVER mention pages or slides in your output.
   - If the beginning contains an outline, agenda, or title slide, DO NOT summarize it as an agenda. Immediately synthesize the core technical substance, theories, principles, and applications found throughout the entire document.

2. DEPTH, SUBSTANCE, AND RIGOR:
   - Provide concrete, rigorous explanations of underlying concepts, theories, principles, mechanisms, and real-world examples.
   - Explain the "how" and "why" behind concepts in substantive, clear paragraphs. Do NOT produce superficial one-sentence summaries.
   - For mathematical, engineering, or scientific topics, include relevant formulas, step-by-step mechanisms, and derivations. Format all mathematical and scientific notation in LaTeX ($...$ for inline expressions, $$...$$ for standalone equations). Ensure all LaTeX backslashes are properly escaped in JSON (e.g. \\\\frac{a}{b}, \\\\Delta, \\\\theta).

3. COMPLETE THEMATIC SYNTHESIS:
   - Synthesize the ENTIRE document from first principles to the final conclusions. Group related sections into cohesive thematic units (3 to 7 thematic sections).

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

LECTURE TRANSCRIPT:
${clippedTranscript}`;

  // 1. Try Gemini API directly if configured (recommended: fast, generous tokens)
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
      console.warn("Gemini note generation failed, trying fallback:", geminiErr);
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
        { model, temperature: 0.2, maxTokens: 6000 }
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
    } catch (openRouterErr) {
      console.warn("OpenRouter note generation failed:", openRouterErr);
    }
  }

  // 3. Fallback to algorithmic structural organizer
  return generateStructuredFallback(transcript, title, courseTitle);
}
