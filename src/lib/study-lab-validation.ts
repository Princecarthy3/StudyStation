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

export type QuizQuestionType = "multiple_choice" | "true_false" | "fill_in";

export type QuizQuestion = {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  type?: QuizQuestionType;
};

export type QuizOutput = {
  title: string;
  questions: QuizQuestion[];
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

  return text(output.title, 300)
    && Array.isArray(output.questions)
    && output.questions.length >= 1
    && output.questions.length <= 30
    && output.questions.every((question) => {
      if (!question || typeof question !== "object") return false;
      const item = question as Record<string, unknown>;
      const choices = item.choices;
      const correctIndex = Number(item.correctIndex);
      return text(item.question, 1500)
        && Array.isArray(choices)
        && choices.length >= 2
        && choices.length <= 8
        && choices.every((c) => text(c, 800))
        && Number.isFinite(correctIndex)
        && Number.isInteger(correctIndex)
        && correctIndex >= 0
        && correctIndex < (choices as unknown[]).length
        && text(item.explanation, 2500);
    });
}

/** Normalize model quiz JSON into a stable shape the UI expects. */
export function normalizeQuizOutput(value: unknown, requestedCount: number): QuizOutput | null {
  if (!value) return null;

  let raw: Record<string, unknown>;
  if (Array.isArray(value)) {
    raw = { questions: value };
  } else if (typeof value === "object") {
    raw = value as Record<string, unknown>;
  } else {
    return null;
  }

  const title = typeof raw.title === "string" && raw.title.trim()
    ? raw.title.trim().slice(0, 300)
    : "Practice quiz";

  // Find candidate array of questions across common keys
  const list = Array.isArray(raw.questions) ? raw.questions
    : Array.isArray(raw.quiz) ? raw.quiz
      : Array.isArray(raw.items) ? raw.items
        : Array.isArray(raw.practiceQuiz) ? raw.practiceQuiz
          : Array.isArray(raw.practice_questions) ? raw.practice_questions
            : Array.isArray(raw.practiceQuestions) ? raw.practiceQuestions
              : Array.isArray(raw.questions_list) ? raw.questions_list
                : Array.isArray(raw.test) ? raw.test
                  : Array.isArray(raw.exam) ? raw.exam
                    : Array.isArray(raw.data) ? raw.data
                      : (Object.values(raw).find((v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && Boolean(
                          (v[0] as Record<string, unknown>).question
                          || (v[0] as Record<string, unknown>).prompt
                          || (v[0] as Record<string, unknown>).statement
                          || (v[0] as Record<string, unknown>).text
                        )) as unknown[] | undefined) ?? [];

  const questions: QuizQuestion[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const questionText = typeof item.question === "string" ? item.question.trim()
      : typeof item.prompt === "string" ? item.prompt.trim()
        : typeof item.statement === "string" ? item.statement.trim()
          : typeof item.stem === "string" ? item.stem.trim()
            : typeof item.questionText === "string" ? item.questionText.trim()
              : typeof item.text === "string" ? item.text.trim()
                : "";
    if (!questionText) continue;

    // Detect question type
    let type: QuizQuestionType = "multiple_choice";
    const rawType = String(item.type || item.questionType || item.format || "").toLowerCase();
    if (["true_false", "true/false", "tf", "boolean"].includes(rawType)) {
      type = "true_false";
    } else if (["fill_in", "fill-in", "fill_in_the_blank", "fill-ins", "blank"].includes(rawType)) {
      type = "fill_in";
    }

    // Extract choices
    let choices: string[] = [];
    if (Array.isArray(item.choices)) {
      choices = item.choices.map((c) => String(c ?? "").trim()).filter(Boolean);
    } else if (Array.isArray(item.options)) {
      choices = item.options.map((c) => String(c ?? "").trim()).filter(Boolean);
    } else if (Array.isArray(item.answers)) {
      choices = item.answers.map((c) => String(c ?? "").trim()).filter(Boolean);
    } else if (Array.isArray(item.alternatives)) {
      choices = item.alternatives.map((c) => String(c ?? "").trim()).filter(Boolean);
    }

    // Auto-detect True/False if choices are True and False
    const hasTrueFalseChoices = choices.length === 2
      && choices.some((c) => c.toLowerCase() === "true")
      && choices.some((c) => c.toLowerCase() === "false");
    if (hasTrueFalseChoices) {
      type = "true_false";
    }

    // Auto-detect fill-in if contains blank underscores
    if (type !== "true_false" && (/__+/.test(questionText) || /\[blank\]/i.test(questionText))) {
      type = "fill_in";
    }

    if (type === "true_false") {
      // Standardize True/False choices
      choices = ["True", "False"];
    } else {
      // Multiple Choice / Fill-in
      if (choices.length < 2) {
        choices = ["Option A", "Option B", "Option C", "Option D"];
      } else if (choices.length === 2 && !hasTrueFalseChoices) {
        choices.push("Option C", "Option D");
      } else if (choices.length === 3) {
        choices.push("None of the above");
      }
      choices = choices.slice(0, 6);
    }

    // Calculate correctIndex
    let correctIndex = -1;
    const rawIdx = item.correctIndex ?? item.correct_index ?? item.answerIndex ?? item.correctAnswerIndex ?? item.correct;
    if (typeof rawIdx === "number" && Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < choices.length) {
      correctIndex = rawIdx;
    } else if (typeof rawIdx === "string" && /^[0-9]+$/.test(rawIdx.trim())) {
      const parsedNum = Number(rawIdx.trim());
      if (parsedNum >= 0 && parsedNum < choices.length) correctIndex = parsedNum;
    }

    if (correctIndex === -1) {
      const ans = String(item.answer ?? item.correctAnswer ?? item.correct_answer ?? item.solution ?? "").trim();
      if (ans) {
        const letter = ans.toUpperCase();
        if (letter === "A" && choices.length >= 1) correctIndex = 0;
        else if (letter === "B" && choices.length >= 2) correctIndex = 1;
        else if (letter === "C" && choices.length >= 3) correctIndex = 2;
        else if (letter === "D" && choices.length >= 4) correctIndex = 3;
        else {
          const exactIdx = choices.findIndex((c) => c.toLowerCase() === ans.toLowerCase());
          if (exactIdx >= 0) {
            correctIndex = exactIdx;
          } else {
            const partialIdx = choices.findIndex((c) => c.toLowerCase().includes(ans.toLowerCase()) || ans.toLowerCase().includes(c.toLowerCase()));
            if (partialIdx >= 0) correctIndex = partialIdx;
          }
        }
      }
    }

    if (correctIndex < 0 || correctIndex >= choices.length) {
      correctIndex = 0;
    }

    // Explanation
    const explanationRaw = item.explanation ?? item.reason ?? item.rationale ?? item.feedback ?? item.why;
    const explanation = typeof explanationRaw === "string" && explanationRaw.trim()
      ? explanationRaw.trim().slice(0, 2000)
      : `The correct answer is "${choices[correctIndex]}". Review the lecture notes for further context.`;

    questions.push({
      question: questionText.slice(0, 1200),
      choices: choices.map((c) => c.slice(0, 600)),
      correctIndex,
      explanation,
      type,
    });

    if (questions.length >= Math.min(30, Math.max(1, requestedCount || 30))) break;
  }

  if (!questions.length) return null;
  return { title, questions };
}

