"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers3,
  LoaderCircle,
  Maximize2,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Timer,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import type { StudyLabAction, StudyLabOutput } from "@/lib/study-lab-validation";
import { cleanFlashcardText } from "@/lib/clean-flashcard";

type LectureSource = {
  id: string;
  title: string;
  course_id: string | null;
  created_at: string;
};

type Generation = {
  id: string;
  task: string;
  status: string;
  input_metadata: {
    action?: StudyLabAction;
    lectureId?: string;
    lectureTitle?: string;
    difficulty?: string;
    questionType?: string;
    sourceTruncated?: boolean;
  } | null;
  output: StudyLabOutput | null;
  model: string | null;
  error_code: string | null;
  created_at: string;
};

const actionLabels: Record<StudyLabAction, string> = {
  summary: "Revision summary",
  explain: "Explain a concept",
  ask: "Ask from this lecture",
  flashcards: "Flashcards",
  quiz: "Practice quiz",
  simplify: "Simplify material",
};

const actionDescriptions: Record<StudyLabAction, string> = {
  summary: "Get a structured overview, key terms, and a revision checklist.",
  explain: "Ask for a clear explanation of a concept from the selected lecture.",
  ask: "Ask a direct question and receive an answer grounded in the transcript.",
  flashcards: "Create active-recall cards from the key ideas.",
  quiz: "Build a multiple-choice practice quiz with explanations.",
  simplify: "Rephrase a challenging passage in simpler language.",
};

const initialActions: StudyLabAction[] = ["summary", "explain", "ask", "flashcards", "quiz", "simplify"];

async function responseError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return data?.error ?? fallback;
}

async function fetchStudyLabData() {
  const response = await fetch("/api/study-lab", { cache: "no-store" });
  if (!response.ok) throw new Error(await responseError(response, "The study lab could not be loaded."));
  return await response.json() as { lectures: LectureSource[]; generations: Generation[] };
}

export function AiStudyLab({
  onNavigate,
}: {
  onNavigate?: (view: "quizzes" | "flashcards" | "planner" | "notes") => void;
} = {}) {
  const [sources, setSources] = useState<LectureSource[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [action, setAction] = useState<StudyLabAction>("summary");
  const [difficulty, setDifficulty] = useState("standard");
  const [questionType, setQuestionType] = useState<"multiple_choice" | "true_false" | "fill_in" | "mixed">("multiple_choice");
  const [count, setCount] = useState(8);
  const [countInput, setCountInput] = useState("8");
  const [instructions, setInstructions] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedOutput, setEditedOutput] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Record<number, boolean>>({});
  const [quizFullscreen, setQuizFullscreen] = useState(false);
  const [flashcardsFullscreen, setFlashcardsFullscreen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [quizMode, setQuizMode] = useState<"practice" | "test">("practice");
  const [testTimeLeftSeconds, setTestTimeLeftSeconds] = useState(600);
  const [testTimerRunning, setTestTimerRunning] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [activeCardFlipped, setActiveCardFlipped] = useState(false);
  const [activeCardsMastered, setActiveCardsMastered] = useState(0);

  useEffect(() => {
    if (!quizFullscreen && !flashcardsFullscreen && !documentModalOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setQuizFullscreen(false);
        setFlashcardsFullscreen(false);
        setDocumentModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quizFullscreen, flashcardsFullscreen, documentModalOpen]);

  useEffect(() => {
    if (!quizFullscreen || quizMode !== "test" || !testTimerRunning) return;
    const interval = setInterval(() => {
      setTestTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTestTimerRunning(false);
          setShowQuizResults(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [quizFullscreen, quizMode, testTimerRunning]);

  const current = useMemo(() => generations.find((item) => item.id === selectedId) ?? null, [generations, selectedId]);

  const load = useCallback(async () => {
    try {
      const data = await fetchStudyLabData();
      setSources(data.lectures);
      setGenerations(data.generations);
      setSelectedSource((previous) => data.lectures.some((lecture) => lecture.id === previous) ? previous : data.lectures[0]?.id ?? "");
      setSelectedId(data.generations[0]?.id ?? "");
      setEditedOutput(data.generations[0]?.output ? JSON.stringify(data.generations[0].output, null, 2) : "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The study lab could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchStudyLabData().then((data) => {
      if (!active) return;
      setSources(data.lectures);
      setGenerations(data.generations);
      setSelectedSource(data.lectures[0]?.id ?? "");
      setSelectedId(data.generations[0]?.id ?? "");
      setEditedOutput(data.generations[0]?.output ? JSON.stringify(data.generations[0].output, null, 2) : "");
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "The study lab could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function selectGeneration(generation: Generation | undefined) {
    setSelectedId(generation?.id ?? "");
    setEditing(false);
    setAnswers({});
    setShowQuizResults(false);
    setQuizFullscreen(false);
    setFlashcardsFullscreen(false);
    setDocumentModalOpen(false);
    setTestTimerRunning(false);
    setActiveCardIndex(0);
    setActiveCardFlipped(false);
    setActiveCardsMastered(0);
    setRevealedCards({});
    setEditedOutput(generation?.output ? JSON.stringify(generation.output, null, 2) : "");
  }

  async function generate() {
    setError("");
    setNotice("");

    if ((action === "ask" || action === "explain" || action === "simplify") && question.trim().length < 2) {
      setError(action === "ask" ? "Please enter your question first." : action === "explain" ? "Please enter the concept you want explained." : "Please enter the material to simplify.");
      return;
    }

    setGenerating(true);
    try {
      const maxCount = action === "quiz" ? 50 : 20;
      const parsed = Math.round(Number(countInput));
      const finalCount = Number.isFinite(parsed) && parsed >= 3 ? Math.min(maxCount, parsed) : 8;

      const response = await fetch("/api/study-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lectureId: selectedSource,
          difficulty,
          questionType: action === "quiz" ? questionType : undefined,
          count: finalCount,
          instructions,
          question,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Study material could not be generated."));
      const data = await response.json() as { generation: Generation; sourceTruncated: boolean };
      setGenerations((previous) => [data.generation, ...previous.filter((item) => item.id !== data.generation.id)].slice(0, 30));
      selectGeneration(data.generation);
      setNotice(
        data.generation.input_metadata?.action === "quiz"
          ? "Your practice quiz is ready! Click 'Start Practice Quiz' below to begin."
          : data.generation.input_metadata?.action === "flashcards"
            ? "Your flashcard deck is ready! Click 'Study Flashcards Now' below to begin."
            : data.sourceTruncated
              ? "Generated and saved. The transcript was long, so only its first section was used."
              : "Generated and saved to your study library."
      );
      setQuestion("");
      setInstructions("");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Study material could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdit() {
    if (!current) return;
    setError("");
    let output: unknown;
    try {
      output = JSON.parse(editedOutput);
    } catch {
      setError("The edited output is not valid JSON.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/study-lab/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Your edits could not be saved."));
      setGenerations((previous) => previous.map((item) => item.id === current.id ? { ...item, output: output as StudyLabOutput } : item));
      setEditing(false);
      setNotice("Your edits are saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Your edits could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCurrent() {
    if (!current) return;
    setError("");
    setSaving(true);
    try {
      const response = await fetch(`/api/study-lab/${current.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "The study material could not be deleted."));
      const remaining = generations.filter((item) => item.id !== current.id);
      setGenerations(remaining);
      selectGeneration(remaining[0]);
      setNotice("Study material deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The study material could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  const quizScore = current?.output && "questions" in current.output
    ? current.output.questions.reduce((score, item, index) => score + (answers[index] === item.correctIndex ? 1 : 0), 0)
    : 0;

  return <div className="fade-up space-y-5">
    <header>
      <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">AI STUDY LAB</p>
      <h1 className="mt-1 text-[25px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[29px]">Study from your lectures</h1>
      <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[#7d7789]">StudyStation retrieves relevant lecture content to ground each response, then uses the AI model’s reasoning and subject knowledge to explain and connect ideas. Review generated material against your class materials.</p>
    </header>

    {error && <p role="alert" className="rounded-xl bg-[#fff1ef] px-4 py-3 text-xs leading-5 text-[#a44e48]">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-[#f1efff] px-4 py-3 text-xs font-semibold text-[#5b47bd]">{notice}</p>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#f0edff] text-[#7259e8]"><WandSparkles className="size-4" /></span><div><h2 className="text-[15px] font-extrabold">Create study material</h2><p className="mt-0.5 text-[10px] text-[#8a8494]">Grounded in your selected lecture, with AI reasoning for added clarity.</p></div></div>

        {loading ? <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#817b8e]"><LoaderCircle className="size-4 animate-spin" /> Loading your sources…</div>
          : sources.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-[#e3deeb] bg-[#fbfaff] px-4 py-7 text-center"><BookOpen className="mx-auto size-6 text-[#9c91c2]" /><p className="mt-3 text-sm font-extrabold">No completed lecture transcripts yet</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[#8a8494]">Upload and transcribe a lecture in Lecture Studio first. Only your own completed transcripts can be used.</p></div>
            : <>
              <label className="mt-5 block text-[10px] font-extrabold text-[#5d5768]">SOURCE LECTURE
                <span className="relative mt-1.5 block"><select value={selectedSource} onChange={(event) => setSelectedSource(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[#e7e3ec] bg-white px-3 pr-9 text-xs font-semibold outline-none focus:border-[#aa9af0]">{sources.map((lecture) => <option key={lecture.id} value={lecture.id}>{lecture.title}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-[#8a8494]" /></span>
              </label>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {initialActions.map((item) => <button key={item} type="button" onClick={() => setAction(item)} className={`rounded-xl border p-3 text-left transition ${action === item ? "border-[#9a88ec] bg-[#f4f1ff] ring-1 ring-[#d9d1fb]" : "border-[#ebe7f0] hover:border-[#d0c8e8]"}`}><span className="block text-xs font-extrabold">{actionLabels[item]}</span><span className="mt-1 block text-[9px] leading-4 text-[#8a8494]">{actionDescriptions[item]}</span></button>)}
              </div>

              {(action === "ask" || action === "explain" || action === "simplify") && <label className="mt-4 block text-[10px] font-extrabold text-[#5d5768]">{action === "ask" ? "YOUR QUESTION" : action === "explain" ? "CONCEPT TO EXPLAIN" : "MATERIAL TO SIMPLIFY"}
                <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={3} placeholder={action === "ask" ? "What is the main difference between…?" : action === "explain" ? "For example: oxidative phosphorylation" : "Paste a difficult passage or name a concept"} className="mt-1.5 w-full resize-y rounded-xl border border-[#e7e3ec] p-3 text-xs leading-5 outline-none focus:border-[#aa9af0]" />
              </label>}

              <div className={`mt-4 grid gap-3 ${action === "quiz" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <label className="text-[10px] font-extrabold text-[#5d5768]">DIFFICULTY
                  <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-3 text-xs font-semibold outline-none focus:border-[#aa9af0]"><option value="introductory">Introductory</option><option value="standard">Standard</option><option value="advanced">Advanced</option></select>
                </label>
                {action === "quiz" && (
                  <label className="text-[10px] font-extrabold text-[#5d5768]">QUESTION FORMAT
                    <select
                      value={questionType}
                      onChange={(event) => setQuestionType(event.target.value as "multiple_choice" | "true_false" | "fill_in" | "mixed")}
                      className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] bg-white px-3 text-xs font-semibold outline-none focus:border-[#aa9af0]"
                    >
                      <option value="multiple_choice">Multiple Choice (Objs)</option>
                      <option value="true_false">True / False</option>
                      <option value="fill_in">Fill-in-the-blanks (Fill-ins)</option>
                      <option value="mixed">Mixed (All Question Types)</option>
                    </select>
                  </label>
                )}
                {(action === "quiz" || action === "flashcards") && (
                  <div>
                    <label className="text-[10px] font-extrabold text-[#5d5768]">
                      {action === "quiz" ? "QUESTION COUNT (UP TO 50)" : "CARD COUNT"}
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={action === "quiz" ? "e.g. 25 (up to 50)" : "e.g. 10"}
                        value={countInput}
                        onChange={(event) => {
                          const val = event.target.value.replace(/[^0-9]/g, "");
                          setCountInput(val);
                          const num = Number(val);
                          if (Number.isFinite(num) && num > 0) {
                            setCount(num);
                          }
                        }}
                        onBlur={() => {
                          const max = action === "quiz" ? 50 : 20;
                          if (!countInput || countInput.trim() === "") {
                            setCountInput("8");
                            setCount(8);
                          } else {
                            const num = Math.round(Number(countInput));
                            const clamped = Math.min(max, Math.max(3, num));
                            setCountInput(String(clamped));
                            setCount(clamped);
                          }
                        }}
                        className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs font-semibold outline-none focus:border-[#aa9af0]"
                      />
                      <span className="mt-1 flex items-center justify-between text-[10px] font-medium text-[#7a7485]">
                        <span>Limit: <strong>3</strong> – <strong>{action === "quiz" ? 50 : 20}</strong> {action === "quiz" ? "questions" : "cards"}</span>
                        <span className="font-bold text-[#7259e8]">{action === "quiz" ? "Max: 50 questions" : "Max: 20"}</span>
                      </span>
                    </label>

                    {/* Quick Question Count Chips for Quizzes */}
                    {action === "quiz" && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] font-bold text-[#8a8496]">Presets:</span>
                        {[5, 10, 15, 25, 50].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setCountInput(String(preset));
                              setCount(preset);
                            }}
                            className={`rounded-lg px-2 py-0.5 text-[9px] font-black transition ${
                              countInput === String(preset)
                                ? "bg-[#7259e8] text-white shadow-2xs"
                                : "border border-[#e6e1ed] bg-white text-[#5d566d] hover:bg-[#faf9fd]"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <label className="mt-4 block text-[10px] font-extrabold text-[#5d5768]">OPTIONAL INSTRUCTIONS
                <input value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={1000} placeholder="Focus on definitions, examples, or a particular topic" className="mt-1.5 h-10 w-full rounded-xl border border-[#e7e3ec] px-3 text-xs font-medium outline-none focus:border-[#aa9af0]" />
              </label>
              <button type="button" disabled={generating || !selectedSource} onClick={() => void generate()} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7259e8] text-xs font-extrabold text-white transition hover:bg-[#8069ed] disabled:cursor-not-allowed disabled:opacity-60">{generating ? <><LoaderCircle className="size-4 animate-spin" /> Creating your material…</> : <><Sparkles className="size-4" /> Generate and save</>}</button>
              <p className="mt-3 text-center text-[9px] leading-4 text-[#9993a0]">Limit: 20 generations per hour. Source text is limited to 24,000 characters per request.</p>
            </>}
      </section>

      <section className="rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9a94a3]">Your library</p><h2 className="mt-1 text-[15px] font-extrabold">Recent generations</h2></div><button type="button" onClick={() => {setLoading(true); setError(""); void load();}} disabled={loading} className="grid size-8 place-items-center rounded-lg border border-[#ebe7f0] text-[#777180] hover:bg-[#f8f6fb]" aria-label="Refresh generations"><RotateCcw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /></button></div>
        {generations.length ? <div className="mt-4 max-h-[340px] space-y-1 overflow-y-auto">{generations.map((generation) => <button key={generation.id} type="button" onClick={() => selectGeneration(generation)} className={`w-full rounded-xl px-3 py-2.5 text-left ${generation.id === selectedId ? "bg-[#f3f0ff]" : "hover:bg-[#faf9fc]"}`}><span className="block truncate text-[11px] font-extrabold">{generation.output && "title" in generation.output ? generation.output.title : generation.input_metadata?.lectureTitle ?? actionLabels[generation.input_metadata?.action ?? "summary"]}</span><span className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[#918b99]"><span>{actionLabels[generation.input_metadata?.action ?? "summary"]}</span><span>{new Date(generation.created_at).toLocaleDateString()}</span></span>{generation.status !== "completed" && <span className="mt-1 block text-[9px] font-bold text-[#b26a2c]">Generation failed. Try again.</span>}</button>)}</div>
          : <p className="mt-4 rounded-xl bg-[#fbfaff] px-3 py-5 text-center text-[11px] leading-5 text-[#8a8494]">Generated summaries, questions, and practice materials will appear here.</p>}

        {current && <div className="mt-5 border-t border-[#eeeaf2] pt-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-[#8e8796]">{actionLabels[current.input_metadata?.action ?? "summary"]}</p><h3 className="mt-1 text-sm font-extrabold">{current.output && "title" in current.output ? current.output.title : current.input_metadata?.lectureTitle}</h3><p className="mt-1 text-[9px] text-[#9993a0]">Source: {current.input_metadata?.lectureTitle ?? "Lecture"}{current.input_metadata?.sourceTruncated ? " · source excerpt" : ""}</p></div><div className="flex shrink-0 gap-1"><button type="button" disabled={saving} onClick={() => {setEditedOutput(JSON.stringify(current.output, null, 2)); setEditing((value) => !value);}} className="rounded-lg border border-[#e9e5ef] px-2 py-1.5 text-[9px] font-extrabold text-[#5d5768] disabled:opacity-50">{editing ? "Cancel" : "Edit"}</button><button type="button" disabled={saving} onClick={() => void removeCurrent()} className="grid size-7 place-items-center rounded-lg text-[#aa625c] hover:bg-[#fff1ef] disabled:opacity-50" aria-label="Delete study material"><Trash2 className="size-3.5" /></button></div></div>

          {editing ? <div className="mt-3"><textarea value={editedOutput} onChange={(event) => setEditedOutput(event.target.value)} rows={14} aria-label="Edit generated study material JSON" className="w-full rounded-xl border border-[#e7e3ec] p-3 font-mono text-[10px] leading-4 outline-none focus:border-[#aa9af0]" /><button type="button" disabled={saving} onClick={() => void saveEdit()} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#17132d] text-[10px] font-extrabold text-white disabled:opacity-60">{saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save edits</button></div>
            : current.output && "questions" in current.output ? (
              <QuizReadyCard
                generation={current}
                quizMode={quizMode}
                setQuizMode={setQuizMode}
                onStartQuiz={() => {
                  if (quizMode === "test") {
                    const qCount = current.output && "questions" in current.output ? current.output.questions.length : 10;
                    setTestTimeLeftSeconds(Math.max(5, qCount * 1) * 60);
                    setTestTimerRunning(true);
                  } else {
                    setTestTimerRunning(false);
                  }
                  setQuizFullscreen(true);
                }}
                onGoToQuizzes={onNavigate ? () => onNavigate("quizzes") : undefined}
              />
            ) : current.output && "cards" in current.output ? (
              <FlashcardsReadyCard
                generation={current}
                onStartFlashcards={() => {
                  setActiveCardIndex(0);
                  setActiveCardFlipped(false);
                  setActiveCardsMastered(0);
                  setFlashcardsFullscreen(true);
                }}
                onGoToFlashcards={onNavigate ? () => onNavigate("flashcards") : undefined}
              />
            ) : (
              <DocumentReadyCard
                generation={current}
                onPreview={() => setDocumentModalOpen(true)}
              />
            )}
        </div>}
      </section>

      {/* Blurred background preview modal for summaries, explanations, answers, and simplifications */}
      {documentModalOpen && current?.output && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#17132d]/60 backdrop-blur-md p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDocumentModalOpen(false);
          }}
        >
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[24px] border border-[#e5ddfa] bg-white shadow-2xl overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-[#ece8f4] bg-[#faf9fc] px-5 py-4">
              <div className="min-w-0 pr-3">
                <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#7259e8]">
                  {actionLabels[current.input_metadata?.action ?? "summary"]} · AI Revision
                </p>
                <h3 className="truncate text-base font-black text-[#17132d]">
                  {current.output && "title" in current.output && typeof current.output.title === "string"
                    ? current.output.title
                    : current.input_metadata?.lectureTitle ?? "Document Overview"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDocumentModalOpen(false)}
                className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#e6e2eb] bg-white text-[#5f586d] hover:bg-[#f4f1fb]"
                aria-label="Exit document preview"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
              <OutputView
                key={`modal-${current.id}`}
                generation={current}
                answers={answers}
                setAnswers={setAnswers}
                showQuizResults={showQuizResults}
                setShowQuizResults={setShowQuizResults}
                revealedCards={revealedCards}
                setRevealedCards={setRevealedCards}
                quizScore={quizScore}
              />
            </div>
          </div>
        </div>
      )}

      {quizFullscreen && current?.output && "questions" in current.output && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-white">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ece8f4] bg-[#faf9fc] px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7259e8]">
                {quizMode === "test" ? "Timed Test Mode" : "Practice Quiz"}
              </p>
              <h2 className="truncate text-sm font-black text-[#17132d] sm:text-base">
                {current.input_metadata?.action === "quiz" ? "Quiz" : "Practice"} · {sources.find((s) => s.id === current.input_metadata?.lectureId)?.title ?? "Lecture"}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Quiz Mode Selector in Header */}
              <div className="hidden sm:flex rounded-xl border border-[#e2dcf2] bg-white p-0.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setQuizMode("practice");
                    setTestTimerRunning(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    quizMode === "practice" ? "bg-[#7259e8] text-white shadow-xs" : "text-[#625b73]"
                  }`}
                >
                  Practice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuizMode("test");
                    const qCount = current.output && "questions" in current.output ? current.output.questions.length : 10;
                    setTestTimeLeftSeconds(Math.max(5, qCount * 1) * 60);
                    setTestTimerRunning(true);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    quizMode === "test" ? "bg-[#7259e8] text-white shadow-xs" : "text-[#625b73]"
                  }`}
                >
                  Timed Test ⏱️
                </button>
              </div>

              {quizMode === "test" && (
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black tabular-nums ${
                    testTimeLeftSeconds < 60
                      ? "bg-[#fff1ef] text-[#dc2626] animate-pulse border border-[#fca5a5]"
                      : testTimeLeftSeconds < 180
                        ? "bg-[#fffbeb] text-[#d97706] border border-[#fde68a]"
                        : "bg-[#f5f2ff] text-[#7259e8] border border-[#dcd4f5]"
                  }`}
                >
                  <Clock className="size-3.5" />
                  {Math.floor(testTimeLeftSeconds / 60)}:{String(testTimeLeftSeconds % 60).padStart(2, "0")}
                </div>
              )}

              {showQuizResults && (
                <span className="rounded-full bg-[#f3f0ff] px-2.5 py-1 text-[10px] font-extrabold text-[#7259e8]">
                  Score {quizScore}/{current.output.questions.length}
                </span>
              )}
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setQuizFullscreen(false);
                    onNavigate("quizzes");
                  }}
                  className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ded7f4] bg-white px-3 text-[10px] font-bold text-[#574f67] hover:bg-[#f6f4fd]"
                >
                  Quizzes Library <ArrowRight className="size-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setQuizFullscreen(false)}
                className="grid size-9 place-items-center rounded-xl border border-[#e6e2eb] bg-white text-[#5f586d] hover:bg-[#f4f1fb]"
                aria-label="Exit full screen quiz"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
            <div className="mx-auto max-w-2xl">
              <OutputView
                key={`fs-${current.id}`}
                generation={current}
                answers={answers}
                setAnswers={setAnswers}
                showQuizResults={showQuizResults}
                setShowQuizResults={setShowQuizResults}
                revealedCards={revealedCards}
                setRevealedCards={setRevealedCards}
                quizScore={quizScore}
              />
            </div>
          </div>
        </div>
      )}

      {flashcardsFullscreen && current?.output && "cards" in current.output && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-white">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ece8f4] bg-[#faf9fc] px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7259e8]">Flashcard Deck</p>
              <h2 className="truncate text-sm font-black text-[#17132d] sm:text-base">
                {current.input_metadata?.lectureTitle ? `${current.input_metadata.lectureTitle} — Flashcards` : "Flashcard Deck"}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-[#f3f0ff] px-2.5 py-1 text-[10px] font-extrabold text-[#7259e8]">
                Card {activeCardIndex + 1} of {current.output.cards.length}
              </span>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setFlashcardsFullscreen(false);
                    onNavigate("flashcards");
                  }}
                  className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ded7f4] bg-white px-3 text-[10px] font-bold text-[#574f67] hover:bg-[#f6f4fd]"
                >
                  Flashcards Library <ArrowRight className="size-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setFlashcardsFullscreen(false)}
                className="grid size-9 place-items-center rounded-xl border border-[#e6e2eb] bg-white text-[#5f586d] hover:bg-[#f4f1fb]"
                aria-label="Exit full screen flashcards"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-xl space-y-6">
              <div className="flex items-center justify-between text-xs text-[#8a8494]">
                <span className="font-extrabold text-[#7259e8]">CARD {activeCardIndex + 1} OF {current.output.cards.length}</span>
                <span className="font-semibold text-[#287451]">{activeCardsMastered} marked as known</span>
              </div>

              <button
                type="button"
                onClick={() => setActiveCardFlipped((val) => !val)}
                className="flashcard-face flex min-h-[260px] w-full flex-col items-center justify-center rounded-[28px] border-2 border-[#e5ddfa] bg-gradient-to-br from-white to-[#faf9fe] p-8 text-center shadow-md transition hover:border-[#a898eb] hover:shadow-lg"
              >
                <span className="flashcard-chip rounded-full px-3 py-1 text-[9px] font-black shadow-xs">
                  {activeCardFlipped ? "ANSWER" : "QUESTION · TAP TO REVEAL"}
                </span>
                <p className="flashcard-text mt-6 text-lg font-black leading-relaxed text-[#17132d]">
                  {activeCardFlipped ? cleanFlashcardText(current.output.cards[activeCardIndex].back) : current.output.cards[activeCardIndex].front}
                </p>
              </button>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!current.output || !("cards" in current.output)) return;
                    const len = current.output.cards.length;
                    setActiveCardIndex((i) => (i - 1 + len) % len);
                    setActiveCardFlipped(false);
                  }}
                  className="flashcard-nav inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#e9e5ef] bg-white px-4 text-xs font-bold text-[#3d3650] hover:bg-[#faf9fe]"
                >
                  <ChevronLeft className="size-4" /> Previous
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!current.output || !("cards" in current.output)) return;
                    setActiveCardsMastered((m) => m + 1);
                    const len = current.output.cards.length;
                    setActiveCardIndex((i) => (i + 1) % len);
                    setActiveCardFlipped(false);
                  }}
                  className="flashcard-know inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#e9f7ef] px-4 text-xs font-extrabold text-[#287451] hover:bg-[#d8f2e3]"
                >
                  <CheckCircle2 className="size-4" /> Got it
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!current.output || !("cards" in current.output)) return;
                    const len = current.output.cards.length;
                    setActiveCardIndex((i) => (i + 1) % len);
                    setActiveCardFlipped(false);
                  }}
                  className="flashcard-nav inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#e9e5ef] bg-white px-4 text-xs font-bold text-[#3d3650] hover:bg-[#faf9fe]"
                >
                  Next <ChevronRight className="size-4" />
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCardIndex(0);
                    setActiveCardFlipped(false);
                    setActiveCardsMastered(0);
                  }}
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#868093] hover:text-[#17132d]"
                >
                  <RotateCcw className="size-3" /> Restart deck from beginning
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>;
}

function QuizReadyCard({
  generation,
  quizMode,
  setQuizMode,
  onStartQuiz,
  onGoToQuizzes,
}: {
  generation: Generation;
  quizMode: "practice" | "test";
  setQuizMode: (mode: "practice" | "test") => void;
  onStartQuiz: () => void;
  onGoToQuizzes?: () => void;
}) {
  const output = generation.output;
  if (!output || !("questions" in output)) return null;

  const count = output.questions.length;
  const difficulty = generation.input_metadata?.difficulty || "standard";
  const questionType = generation.input_metadata?.questionType || "multiple_choice";
  const formatLabel =
    questionType === "true_false"
      ? "True / False"
      : questionType === "fill_in"
        ? "Fill-in-the-blanks"
        : questionType === "mixed"
          ? "Mixed Types"
          : "Multiple Choice";

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#dcd4f5] bg-gradient-to-br from-[#faf8ff] via-[#f7f5ff] to-[#f0ebff] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a3e4c4] bg-[#e9f7ef] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#287451]">
          <span className="size-1.5 animate-pulse rounded-full bg-[#287451]" />
          Ready to Practice
        </span>
        <span className="rounded-md border border-[#ded5f8] bg-white px-2 py-0.5 text-[8px] font-bold text-[#7259e8]">
          Practice Quiz
        </span>
      </div>

      <h4 className="mt-3 text-sm font-black leading-snug text-[#17132d]">
        {output.title || generation.input_metadata?.lectureTitle || "Practice Quiz"}
      </h4>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-extrabold text-[#5a5268]">
        <span className="rounded-lg border border-[#ece7f4] bg-white px-2.5 py-1 shadow-xs">
          {count} {count === 1 ? "question" : "questions"}
        </span>
        <span className="rounded-lg border border-[#ece7f4] bg-white px-2.5 py-1 capitalize shadow-xs">
          {difficulty}
        </span>
        <span className="rounded-lg border border-[#ece7f4] bg-white px-2.5 py-1 shadow-xs">
          {formatLabel}
        </span>
      </div>

      {/* Mode Selector */}
      <div className="mt-3.5 rounded-xl border border-[#e2dcf2] bg-white/80 p-1">
        <p className="px-2 pt-1 text-[8px] font-black uppercase tracking-wider text-[#8a8496]">Select Mode</p>
        <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] font-extrabold">
          <button
            type="button"
            onClick={() => setQuizMode("practice")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${
              quizMode === "practice"
                ? "bg-[#7259e8] text-white shadow-xs"
                : "text-[#5d566d] hover:bg-[#faf9fd]"
            }`}
          >
            <BookOpen className="size-3" /> Practice (Untimed)
          </button>
          <button
            type="button"
            onClick={() => setQuizMode("test")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${
              quizMode === "test"
                ? "bg-[#7259e8] text-white shadow-xs"
                : "text-[#5d566d] hover:bg-[#faf9fd]"
            }`}
          >
            <Clock className="size-3" /> Timed Test ⏱️
          </button>
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-[#756f82]">
        {quizMode === "test"
          ? `Timed exam condition with live countdown clock. Answers are submitted and scored after the test.`
          : "Untimed practice mode: review answers and explanations as you go at your own pace."}
      </p>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onStartQuiz}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#7259e8] text-xs font-black text-white shadow-sm transition hover:bg-[#8069ed]"
        >
          {quizMode === "test" ? (
            <><Clock className="size-3.5" /> Start Timed Test</>
          ) : (
            <><Play className="size-3.5 fill-current" /> Start Practice Quiz</>
          )}
        </button>

        {onGoToQuizzes && (
          <button
            type="button"
            onClick={onGoToQuizzes}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#dcd5f0] bg-white text-[10px] font-extrabold text-[#5d566d] transition hover:bg-[#faf9fd]"
          >
            Go to Quizzes Library <ArrowRight className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function FlashcardsReadyCard({
  generation,
  onStartFlashcards,
  onGoToFlashcards,
}: {
  generation: Generation;
  onStartFlashcards: () => void;
  onGoToFlashcards?: () => void;
}) {
  const output = generation.output;
  if (!output || !("cards" in output)) return null;

  const count = output.cards.length;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#dcd4f5] bg-gradient-to-br from-[#faf8ff] via-[#f7f5ff] to-[#f0ebff] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a3e4c4] bg-[#e9f7ef] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#287451]">
          <span className="size-1.5 animate-pulse rounded-full bg-[#287451]" />
          Deck Ready
        </span>
        <span className="rounded-md border border-[#ded5f8] bg-white px-2 py-0.5 text-[8px] font-bold text-[#7259e8]">
          Flashcard Deck
        </span>
      </div>

      <h4 className="mt-3 text-sm font-black leading-snug text-[#17132d]">
        {generation.input_metadata?.lectureTitle ? `${generation.input_metadata.lectureTitle} — Flashcards` : "Study Flashcards"}
      </h4>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-extrabold text-[#5a5268]">
        <span className="rounded-lg border border-[#ece7f4] bg-white px-2.5 py-1 shadow-xs">
          {count} {count === 1 ? "card" : "cards"}
        </span>
        <span className="rounded-lg border border-[#ece7f4] bg-white px-2.5 py-1 shadow-xs">
          Active Recall
        </span>
        <span className="rounded-lg border border-[#ece7f4] bg-white px-2.5 py-1 shadow-xs">
          Direct Answers
        </span>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-[#756f82]">
        Your active-recall flashcard deck is generated and ready. Practice flipping the cards to lock in key terms and direct definitions.
      </p>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onStartFlashcards}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#7259e8] text-xs font-black text-white shadow-sm transition hover:bg-[#8069ed]"
        >
          <Layers3 className="size-3.5" /> Study Flashcards Now
        </button>

        {onGoToFlashcards && (
          <button
            type="button"
            onClick={onGoToFlashcards}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#dcd5f0] bg-white text-[10px] font-extrabold text-[#5d566d] transition hover:bg-[#faf9fd]"
          >
            Go to Flashcards Library <ArrowRight className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function DocumentReadyCard({
  generation,
  onPreview,
}: {
  generation: Generation;
  onPreview: () => void;
}) {
  const output = generation.output;
  if (!output) return null;

  const action = generation.input_metadata?.action || "summary";
  const actionLabel = actionLabels[action] || "Study Document";
  const title = output && "title" in output && typeof output.title === "string"
    ? output.title
    : (generation.input_metadata?.lectureTitle ? `${generation.input_metadata.lectureTitle} — ${actionLabel}` : actionLabel);

  const isSections = "sections" in output;
  const sectionCount = isSections ? output.sections.length : 0;
  const keyTermsCount = isSections ? output.keyTerms.length : 0;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#dcd4f5] bg-gradient-to-br from-[#faf8ff] via-[#f7f5ff] to-[#f0ebff] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a3e4c4] bg-[#e9f7ef] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#287451]">
          <span className="size-1.5 animate-pulse rounded-full bg-[#287451]" />
          Document Ready
        </span>
        <span className="rounded-md border border-[#ded5f8] bg-white px-2 py-0.5 text-[8px] font-bold text-[#7259e8]">
          {actionLabel}
        </span>
      </div>

      <h4 className="mt-3 text-sm font-black leading-snug text-[#17132d]">
        {title}
      </h4>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-extrabold text-[#5a5268]">
        {sectionCount > 0 && (
          <span className="rounded-lg border border-[#ece7f4] bg-white px-2.5 py-1 shadow-xs">
            {sectionCount} {sectionCount === 1 ? "section" : "sections"}
          </span>
        )}
        {keyTermsCount > 0 && (
          <span className="rounded-lg border border-[#ece7f4] bg-white px-2.5 py-1 shadow-xs">
            {keyTermsCount} key terms
          </span>
        )}
        <span className="rounded-lg border border-[#ece7f4] bg-white px-2.5 py-1 capitalize shadow-xs">
          {generation.input_metadata?.difficulty || "standard"}
        </span>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-[#756f82]">
        Your {actionLabel.toLowerCase()} has been synthesized with concrete academic rigor and is ready to preview.
      </p>

      <div className="mt-4">
        <button
          type="button"
          onClick={onPreview}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#7259e8] text-xs font-black text-white shadow-sm transition hover:bg-[#8069ed]"
        >
          <BookOpen className="size-3.5" /> Read Full Document
        </button>
      </div>
    </div>
  );
}

function OutputView({ generation, answers, setAnswers, showQuizResults, setShowQuizResults, revealedCards, setRevealedCards, quizScore }: {
  generation: Generation;
  answers: Record<number, number>;
  setAnswers: (value: Record<number, number>) => void;
  showQuizResults: boolean;
  setShowQuizResults: (value: boolean) => void;
  revealedCards: Record<number, boolean>;
  setRevealedCards: (value: Record<number, boolean>) => void;
  quizScore: number;
}) {
  const [attemptSaving, setAttemptSaving] = useState(false);
  const [attemptMessage, setAttemptMessage] = useState("");
  const [attemptError, setAttemptError] = useState("");
  const output = generation.output;
  async function saveQuizAttempt(
    generationId: string,
    questionCount: number,
    selectedAnswers: Record<number, number>,
    setResultsVisible: (value: boolean) => void,
    setSaving: (value: boolean) => void,
    setMessage: (value: string) => void,
    setError: (value: string) => void,
  ) {
    const answersToSave = Array.from({ length: questionCount }, (_, index) => selectedAnswers[index]);
    if (answersToSave.some((answer) => !Number.isInteger(answer))) {
      setMessage("");
      setError("Answer every question before saving your attempt.");
      return;
    }
    setResultsVisible(true);
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/study-lab/${generationId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersToSave }),
      });
      const data = await response.json().catch(() => null) as { error?: string; attempt?: { score: number; total: number } } | null;
      if (!response.ok || !data?.attempt) throw new Error(data?.error ?? "The quiz score could not be saved.");
      setMessage(`Saved to your progress: ${data.attempt.score} / ${data.attempt.total}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "The quiz score could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  if (!output) return <p className="mt-4 text-xs text-[#8a8494]">No completed output is available.</p>;

  if ("cards" in output) return <div className="mt-3 space-y-2">{output.cards.map((card, index) => <button key={`${index}-${card.front}`} type="button" onClick={() => setRevealedCards({ ...revealedCards, [index]: !revealedCards[index] })} className="flashcard-face w-full rounded-xl border border-[#ebe7f0] p-3 text-left hover:shadow-sm"><span className="flashcard-chip inline-block rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide">{revealedCards[index] ? "BACK" : `CARD ${index + 1} · TAP TO REVEAL`}</span><span className="flashcard-text mt-1 block text-[10px] font-semibold leading-4">{revealedCards[index] ? cleanFlashcardText(card.back) : card.front}</span></button>)}</div>;

  if ("questions" in output) {
    const letters = ["A", "B", "C", "D", "E", "F"];
    const totalAnswered = Object.keys(answers).length;
    const percent = output.questions.length > 0 ? Math.round((quizScore / output.questions.length) * 100) : 0;

    return (
      <div className="mt-3 space-y-4">
        {/* Progress & Score Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f5ff] p-3 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#17132d]">{output.questions.length} questions</span>
            <span className="text-[#8e879a]">·</span>
            <span className="text-[#655d73]">
              {totalAnswered} of {output.questions.length} answered
            </span>
          </div>
          {showQuizResults && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${percent >= 70 ? "bg-[#e9f7ef] text-[#287451]" : "bg-[#fff1ef] text-[#a44e48]"}`}>
              Score: {quizScore} / {output.questions.length} ({percent}%)
            </span>
          )}
        </div>

        {/* Questions */}
        {output.questions.map((item, index) => {
          const isCorrect = answers[index] === item.correctIndex;
          const qType = item.type || (item.choices.length === 2 && item.choices[0].toLowerCase() === "true" ? "true_false" : /__+/.test(item.question) ? "fill_in" : "multiple_choice");

          return (
            <fieldset
              key={`${index}-${item.question.slice(0, 30)}`}
              className={`rounded-2xl border p-4 transition ${
                showQuizResults
                  ? isCorrect
                    ? "border-[#a7e8c7] bg-[#f9fdfa]"
                    : "border-[#f7c2be] bg-[#fffbfb]"
                  : answers[index] !== undefined
                    ? "border-[#c8bef6] bg-white"
                    : "border-[#ebe7f0] bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <legend className="px-1 text-[11px] font-black leading-5 text-[#17132d]">
                  <span className="mr-1.5 inline-block text-[#7259e8]">Q{index + 1}.</span>
                  {item.question}
                </legend>
                <span className="shrink-0">
                  {qType === "true_false" ? (
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-700">True / False</span>
                  ) : qType === "fill_in" ? (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-700">Fill in blank</span>
                  ) : (
                    <span className="rounded-md border border-[#e2daf8] bg-[#f4f1ff] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#7259e8]">Multiple Choice</span>
                  )}
                </span>
              </div>

              {/* Choices rendering */}
              <div className={`mt-3 ${qType === "true_false" ? "grid grid-cols-2 gap-2" : "space-y-2"}`}>
                {item.choices.map((choice, choiceIndex) => {
                  const isSelected = answers[index] === choiceIndex;
                  const isChoiceCorrect = choiceIndex === item.correctIndex;
                  const letter = letters[choiceIndex] || String(choiceIndex + 1);

                  let choiceClass = "border-[#ece8f2] bg-white hover:border-[#cfc6f4] hover:bg-[#faf9fe]";
                  if (showQuizResults) {
                    if (isChoiceCorrect) {
                      choiceClass = "border-[#83dcaf] bg-[#eefaf3] text-[#1c6643] font-bold shadow-sm";
                    } else if (isSelected && !isChoiceCorrect) {
                      choiceClass = "border-[#f5b8b5] bg-[#fff2f1] text-[#9c3833] line-through";
                    } else {
                      choiceClass = "border-[#f0ecf5] bg-white opacity-60";
                    }
                  } else if (isSelected) {
                    choiceClass = "border-[#8e78ea] bg-[#f4f1ff] text-[#17132d] font-bold shadow-sm";
                  }

                  return (
                    <label
                      key={`${choiceIndex}-${choice}`}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-[10px] leading-4 transition ${choiceClass}`}
                    >
                      <input
                        type="radio"
                        name={`question-${index}`}
                        checked={isSelected}
                        onChange={() => {
                          setAnswers({ ...answers, [index]: choiceIndex });
                          setShowQuizResults(false);
                          setAttemptMessage("");
                          setAttemptError("");
                        }}
                        className="mt-0.5 size-3.5 shrink-0 accent-[#7259e8]"
                      />
                      <span className="min-w-0 flex-1">
                        {qType !== "true_false" && <b className="mr-1 text-[#7259e8]">{letter}.</b>}
                        {choice}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Explanation callout */}
              {showQuizResults && (
                <div className="mt-3 rounded-xl border border-[#e8e4f2] bg-[#fcfbfe] p-3 text-[10px] leading-relaxed">
                  <div className="flex items-center gap-1.5 font-black">
                    {isCorrect ? (
                      <span className="flex items-center gap-1 text-[#287451]">
                        <Check className="size-3.5" /> Correct!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[#a44e48]">
                        <X className="size-3.5" /> Correct answer: {item.choices[item.correctIndex]}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[#655e72]">{item.explanation}</p>
                </div>
              )}
            </fieldset>
          );
        })}

        {attemptError && <p role="alert" className="rounded-xl bg-[#fff1ef] p-3 text-[10px] font-semibold text-[#a44e48]">{attemptError}</p>}
        {attemptMessage && <p role="status" className="rounded-xl bg-[#e9f7ef] p-3 text-[10px] font-semibold text-[#287451]">{attemptMessage}</p>}

        <button
          type="button"
          disabled={attemptSaving}
          onClick={() => void saveQuizAttempt(generation.id, output.questions.length, answers, setShowQuizResults, setAttemptSaving, setAttemptMessage, setAttemptError)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#17132d] py-3 text-xs font-black text-white shadow-sm transition hover:bg-[#28214d] disabled:opacity-60"
        >
          {attemptSaving ? (
            <><LoaderCircle className="size-4 animate-spin" /> Saving score…</>
          ) : showQuizResults ? (
            "Save another attempt"
          ) : (
            `Check answers (${totalAnswered}/${output.questions.length}) & save attempt`
          )}
        </button>
      </div>
    );
  }

  if ("sections" in output) return <div className="mt-3 space-y-3"><p className="whitespace-pre-wrap text-[10px] leading-5 text-[#5f596b]">{output.summary}</p>{output.sections.map((section, sIdx) => <div key={`${sIdx}-${section.heading}`}><h4 className="text-[10px] font-extrabold text-[#17132d]">{section.heading}</h4><p className="mt-1 whitespace-pre-wrap text-[9px] leading-4 text-[#777180]">{section.body}</p></div>)}{output.keyTerms.length > 0 && <div><h4 className="text-[10px] font-extrabold text-[#17132d]">Key terms</h4><ul className="mt-1 space-y-1">{output.keyTerms.map((term, tIdx) => <li key={`${tIdx}-${term.term}`} className="text-[9px] leading-4"><b className="text-[#17132d]">{term.term}:</b> <span className="text-[#777180]">{term.definition}</span></li>)}</ul></div>}<div className="rounded-xl bg-[#f7f5ff] p-3"><h4 className="text-[10px] font-extrabold text-[#17132d]">Revision checklist</h4><ul className="mt-2 space-y-1">{output.revisionChecklist.map((item, cIdx) => <li key={`${cIdx}-${item}`} className="flex gap-2 text-[9px] leading-4 text-[#655d74]"><span>•</span>{item}</li>)}</ul></div></div>;

  return <div className="mt-3"><p className="whitespace-pre-wrap text-[10px] leading-5 text-[#5f596b]">{output.answer}</p><ul className="mt-3 space-y-1.5">{output.keyPoints.map((point) => <li key={point} className="flex gap-2 text-[9px] leading-4 text-[#777180]"><span className="font-black text-[#7259e8]">•</span>{point}</li>)}</ul><p className="mt-3 flex items-center gap-1.5 text-[8px] font-semibold text-[#9a94a3]"><Sparkles className="size-3" /> Based on the selected lecture transcript.</p></div>;
}

