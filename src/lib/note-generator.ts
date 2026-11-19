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

function stripPageNoise(text: string): string {
  return text
    .replace(/^-{2,}\s*Page\s*\d+\s*-{2,}\s*/gim, "\n")
    .replace(/^---\s*Page\s*\d+\s*---\s*/gim, "\n")
    .replace(/\bCourse Lecturer:\s*[^\n.]+\.?/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Neutral fallback — never invents course-specific topics (e.g. Loops) from weak keyword matches.
 */
function generateStructuredFallback(transcript: string, title: string, courseTitle?: string): OrganizedNoteContent {
  const cleaned = stripPageNoise(transcript);
  const sentences = cleaned
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && !/course lecturer|---\s*page/i.test(s));

  const summary =
    sentences.slice(0, 5).join(" ") ||
    `Study notes for "${title}"${courseTitle ? ` (${courseTitle})` : ""}.`;

  // Split into up to 4 sequential sections from content, not keyword taxonomies
  const chunks: string[] = [];
  const target = Math.max(1, Math.min(4, Math.ceil(sentences.length / 4)));
  for (let i = 0; i < sentences.length && chunks.length < 4; i += target) {
    chunks.push(sentences.slice(i, i + target).join(" "));
  }
  if (!chunks.length) chunks.push(cleaned.slice(0, 2000));

  const sectionTitles = [
    "1. Overview & Main Ideas",
    "2. Core Details",
    "3. Applications & Examples",
    "4. Further Points",
  ];

  const sections: OrganizedNoteSection[] = chunks.map((body, idx) => {
    const bullets = body
      .split(/(?<=[.?!])\s+/)
      .filter((s) => s.length > 25)
      .slice(0, 5);
    return {
      heading: sectionTitles[idx] || `Section ${idx + 1}`,
      body,
      bullets,
      takeaways: [`Summarize the main point of "${sectionTitles[idx]?.replace(/^\d+\.\s*/, "") || "this section"}" in your own words.`],
    };
  });

  const displayTitle = title.replace(/^\d{4}[-T0-9.:]+$/, "Lecture notes").trim() || "Lecture notes";

  return {
    title: `${displayTitle} — Study Notes`,
    summary,
    keyTerms: [
      {
        term: displayTitle.slice(0, 80),
        definition: sentences[0] || "Primary topic discussed in this recording.",
      },
    ],
    sections,
    takeaways: [
      "Restate the speaker's main message in 2–3 sentences from memory.",
      "List the features, steps, or ideas that were emphasized.",
      "Note any actions the speaker recommended (upload, join, schedule, etc.).",
    ],
    studyQuestions: [
      {
        question: "What was the main topic of this lecture or recording?",
        answer: summary.slice(0, 280),
      },
      {
        question: "What key points should you remember for revision?",
        answer: sentences.slice(0, 3).join(" "),
      },
      {
        question: "What practical next step did the material suggest?",
        answer: "Review the sections above and apply the recommended actions in the app or coursework.",
      },
    ],
    actionChecklist: [
      "Re-read the summary and highlight unfamiliar terms.",
      "Answer the active-recall questions without looking first.",
      "Add a short revision block for this lecture in the Study Planner.",
    ],
  };
}

async function callGeminiForNotes(prompt: string): Promise<OrganizedNoteContent> {
  const { text } = await geminiGenerateJson(prompt, {
    temperature: 0.25,
    maxOutputTokens: 8192,
  });
  if (!text) throw new Error("Gemini returned an empty response");
  return parseJsonObject<OrganizedNoteContent>(text);
}

function looksLikeGoodNotes(note: OrganizedNoteContent): boolean {
  if (!note.summary || note.summary.trim().length < 40) return false;
  if (!Array.isArray(note.sections) || note.sections.length === 0) return false;
  // Reject obvious fallback-style garbage section titles when AI somehow returns them
  const joined = note.sections.map((s) => s.heading).join(" ").toLowerCase();
  if (/loops\s*&\s*iteration|variables\s*&\s*data types|core methodology|primary findings/i.test(joined)) {
    // Only reject if body is basically the raw transcript repeated
    const bodyJoin = note.sections.map((s) => s.body).join(" ");
    if (bodyJoin.length < 80) return false;
  }
  return true;
}

/**
 * Generate university-grade structured notes from a lecture transcript or extracted document text.
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
  const SINGLE_PASS_LIMIT = 40_000;
  const MAP_CHUNK = 14_000;

  const systemInstructions = `You are StudyStation's expert academic AI professor and study coach.
Transform the provided lecture transcript or document into organized, comprehensive, university-grade study notes.

CRITICAL RULES:
1. Base EVERY section, term, and takeaway on the actual content. Never invent topics that are not in the material (e.g. do not add "Loops & Iteration" unless the lecture is about loops).
2. NEVER describe pages, slides, or file structure. Forbidden: "Page 1 introduces", "This slide shows", "Course Lecturer", page numbers.
3. Write as if teaching the subject to a student. Clear paragraphs + concrete bullets.
4. Group related ideas into 3–7 thematic sections with meaningful headings drawn from the content itself.
5. keyTerms must be real terms/names/features from the material with accurate definitions (not placeholders like "Core Methodology").
6. summary: 2–4 substantive paragraphs capturing the core message and important details.
7. studyQuestions: deep active-recall questions grounded in the content, with concise answers.
8. Return ONLY valid JSON matching the schema. No markdown fences.

JSON schema:
{
  "title": "Clear note title reflecting the actual subject",
  "summary": "2-4 detailed paragraphs",
  "keyTerms": [{"term": "string", "definition": "string"}],
  "sections": [{
    "heading": "1. Thematic heading from the content",
    "body": "In-depth explanation in paragraphs",
    "bullets": ["Concrete detail 1", "Concrete detail 2"],
    "takeaways": ["Key insight for exams or practice"]
  }],
  "takeaways": ["High-yield takeaway 1", "High-yield takeaway 2"],
  "studyQuestions": [{"question": "string", "answer": "string"}],
  "actionChecklist": ["Next revision step 1", "Next revision step 2"]
}`;

  async function synthesize(sourceText: string, mode: "full" | "final"): Promise<OrganizedNoteContent | null> {
    const userPrompt =
      mode === "final"
        ? `LECTURE TITLE: "${title}"
${courseTitle ? `COURSE: "${courseTitle}"` : ""}

Merge the partial digests below into ONE coherent set of study notes.
Use only ideas present in the digests. Drop duplicates. Do not invent unrelated academic topics.

PARTIAL DIGESTS:
${sourceText}`
        : `LECTURE TITLE: "${title}"
${courseTitle ? `COURSE: "${courseTitle}"` : ""}

SOURCE MATERIAL:
${sourceText}

Produce rich, well-organized study notes. Section headings must reflect what is actually discussed.`;

    if (hasGeminiKey()) {
      try {
        const parsed = await callGeminiForNotes(`${systemInstructions}\n\n${userPrompt}`);
        if (looksLikeGoodNotes(parsed)) {
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
        const model =
          process.env.OPENROUTER_STUDY_MODEL ?? process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
        const raw = await openRouterChat(
          [
            { role: "system", content: systemInstructions },
            { role: "user", content: userPrompt },
          ],
          { model, temperature: 0.25, maxTokens: 8000 },
        );
        const parsed = parseJsonObject<OrganizedNoteContent>(raw);
        if (looksLikeGoodNotes(parsed)) {
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

  // Short / medium material: single high-quality pass (matches previous good results)
  if (cleanedFull.length <= SINGLE_PASS_LIMIT) {
    const result = await synthesize(cleanedFull, "full");
    if (result) return sanitizeNoteContent(result, title);
    return sanitizeNoteContent(generateStructuredFallback(cleanedFull, title, courseTitle), title);
  }

  // Long multi-page docs only: map digests then reduce
  const digests: string[] = [];
  for (let offset = 0, part = 1; offset < cleanedFull.length && part <= 12; offset += MAP_CHUNK, part += 1) {
    const chunk = cleanedFull.slice(offset, offset + MAP_CHUNK);
    if (chunk.trim().length < 200) continue;
    const mapPrompt = `Extract study digests from this part of a university lecture or document.
Return plain text with:
- Key concepts and definitions
- Important procedures, features, or examples
- Facts a student should revise
Do NOT mention page numbers or slides. Do NOT invent topics absent from the text.
TITLE: ${title}
PART ${part}:
${chunk}`;
    try {
      if (hasGeminiKey()) {
        const text = await geminiChat(
          [
            {
              role: "system",
              content: "Extract study digests as plain structured text. No JSON. No page or slide references. Only content present in the source.",
            },
            { role: "user", content: mapPrompt },
          ],
          { temperature: 0.15, maxOutputTokens: 2048 },
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
            temperature: 0.15,
            maxTokens: 1800,
          },
        );
        if (raw?.trim()) digests.push(`### Part ${part}\n${raw.trim()}`);
      }
    } catch (err) {
      console.warn(`Note map pass ${part} failed:`, err);
      digests.push(`### Part ${part}\n${chunk.slice(0, 2500)}`);
    }
  }

  if (digests.length) {
    const reduced = await synthesize(digests.join("\n\n").slice(0, 60_000), "final");
    if (reduced) return sanitizeNoteContent(reduced, title);
  }

  return sanitizeNoteContent(generateStructuredFallback(cleanedFull, title, courseTitle), title);
}

function sanitizeNoteContent(note: OrganizedNoteContent, title: string): OrganizedNoteContent {
  const cleanText = (s: string) =>
    (s || "")
      .replace(/^-{2,}\s*Page\s*\d+\s*-{2,}.*$/gim, "")
      .replace(/\bCourse Lecturer:[^.]*\.?/gi, "")
      .replace(/\s{2,}/g, " ")
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
    .map((k) => ({ term: cleanText(k.term), definition: cleanText(k.definition) }))
    .filter(
      (k) =>
        k.term &&
        k.definition &&
        !/core methodology|primary findings|central subject/i.test(k.term),
    );

  return {
    title: cleanText(note.title) || `${title} — Study Notes`,
    summary: cleanText(note.summary || ""),
    keyTerms: keyTerms.slice(0, 15),
    sections: sections.slice(0, 10),
    takeaways: (note.takeaways || []).map(cleanText).filter(Boolean).slice(0, 8),
    studyQuestions: (note.studyQuestions || [])
      .map((q) => ({
        question: cleanText(q.question),
        answer: q.answer ? cleanText(q.answer) : undefined,
      }))
      .filter((q) => q.question)
      .slice(0, 8),
    actionChecklist: (note.actionChecklist || []).map(cleanText).filter(Boolean).slice(0, 6),
  };
}
