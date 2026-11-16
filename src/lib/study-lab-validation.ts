export type StudyLabAction = "summary" | "explain" | "ask" | "flashcards" | "quiz" | "simplify";

export type SummaryOutput = {
  title: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
  keyTerms: Array<{ term: string; definition: string }>;
  revisionChecklist: string[];
};

export type ExplanationOutput = {
  title: string;
  answer: string;
  keyPoints: string[];
};

export type FlashcardsOutput = {
  cards: Array<{ front: string; back: string }>;
};

export type QuizOutput = {
  title: string;
  questions: Array<{
    question: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
  }>;
};

export type StudyLabOutput = SummaryOutput | ExplanationOutput | FlashcardsOutput | QuizOutput;

function text(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function textList(value: unknown, min: number, max: number, maxLength: number) {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every((item) => text(item, maxLength));
}

export function validateStudyOutput(action: StudyLabAction, value: unknown): value is StudyLabOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;

  if (action === "summary") {
    return text(output.title, 160)
      && text(output.summary, 5000)
      && Array.isArray(output.sections)
      && output.sections.length >= 1
      && output.sections.length <= 12
      && output.sections.every((section) => section && typeof section === "object"
        && text((section as Record<string, unknown>).heading, 160)
        && text((section as Record<string, unknown>).body, 3000))
      && Array.isArray(output.keyTerms)
      && output.keyTerms.length <= 20
      && output.keyTerms.every((term) => term && typeof term === "object"
        && text((term as Record<string, unknown>).term, 160)
        && text((term as Record<string, unknown>).definition, 1000))
      && textList(output.revisionChecklist, 1, 15, 500);
  }

  if (action === "explain" || action === "ask" || action === "simplify") {
    return text(output.title, 160)
      && text(output.answer, 6000)
      && textList(output.keyPoints, 1, 12, 500);
  }

  if (action === "flashcards") {
    return Array.isArray(output.cards)
      && output.cards.length >= 3
      && output.cards.length <= 20
      && output.cards.every((card) => card && typeof card === "object"
        && text((card as Record<string, unknown>).front, 500)
        && text((card as Record<string, unknown>).back, 1200));
  }

  return text(output.title, 200)
    && Array.isArray(output.questions)
    && output.questions.length >= 1
    && output.questions.length <= 30
    && output.questions.every((question) => {
      if (!question || typeof question !== "object") return false;
      const item = question as Record<string, unknown>;
      const choices = item.choices;
      const correctIndex = Number(item.correctIndex);
      return text(item.question, 800)
        && Array.isArray(choices)
        && choices.length >= 2
        && choices.length <= 6
        && choices.every((c) => text(c, 400))
        && Number.isFinite(correctIndex)
        && Number.isInteger(correctIndex)
        && correctIndex >= 0
        && correctIndex < (choices as unknown[]).length
        && text(item.explanation, 1500);
    });
}

/** Normalize model quiz JSON into a stable shape the UI expects. */
export function normalizeQuizOutput(value: unknown, requestedCount: number): QuizOutput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const title = typeof raw.title === "string" && raw.title.trim()
    ? raw.title.trim().slice(0, 200)
    : "Practice quiz";
  const list = Array.isArray(raw.questions) ? raw.questions
    : Array.isArray(raw.quiz) ? raw.quiz
      : Array.isArray(raw.items) ? raw.items
        : [];
  const questions: QuizOutput["questions"] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const questionText = typeof item.question === "string" ? item.question.trim()
      : typeof item.prompt === "string" ? item.prompt.trim()
        : typeof item.text === "string" ? item.text.trim()
          : "";
    if (!questionText) continue;
    let choices: string[] = [];
    if (Array.isArray(item.choices)) {
      choices = item.choices.map((c) => String(c ?? "").trim()).filter(Boolean);
    } else if (Array.isArray(item.options)) {
      choices = item.options.map((c) => String(c ?? "").trim()).filter(Boolean);
    }
    while (choices.length < 4) choices.push(`Option ${choices.length + 1}`);
    choices = choices.slice(0, 4);
    let correctIndex = Number(item.correctIndex);
    if (!Number.isInteger(correctIndex)) {
      if (typeof item.answer === "string") {
        const idx = choices.findIndex((c) => c.toLowerCase() === String(item.answer).toLowerCase());
        correctIndex = idx >= 0 ? idx : 0;
      } else if (typeof item.correct === "number") {
        correctIndex = Number(item.correct);
      } else {
        correctIndex = 0;
      }
    }
    correctIndex = Math.max(0, Math.min(3, Math.trunc(correctIndex)));
    const explanation = typeof item.explanation === "string" && item.explanation.trim()
      ? item.explanation.trim().slice(0, 1500)
      : "Review the lecture notes for this concept.";
    questions.push({
      question: questionText.slice(0, 800),
      choices: choices.map((c) => c.slice(0, 400)),
      correctIndex,
      explanation,
    });
    if (questions.length >= Math.min(30, Math.max(1, requestedCount || 30))) break;
  }
  if (!questions.length) return null;
  return { title, questions };
}

