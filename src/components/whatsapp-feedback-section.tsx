"use client";

import { useState } from "react";
import { MessageSquarePlus, ExternalLink, Copy, Check, Users, Sparkles } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import {
  SUPPORT_WHATSAPP_NUMBER,
  SUPPORT_WHATSAPP_DISPLAY,
  STUDYSTATION_WHATSAPP_COMMUNITY_URL,
} from "@/lib/windows-download";

type FeedbackType = "review" | "bug" | "feature" | "general";

const TEMPLATES: Record<FeedbackType, { label: string; template: (name: string, uni: string) => string }> = {
  review: {
    label: "StudyStation Review ⭐",
    template: (name, uni) =>
      `Hi Prince,\n\nHere is my review of StudyStation:\n\n• Rating: 5/5 ⭐\n• What I love most: \n• How it helps my studies: \n• Student name: ${name || "[Your Name]"}\n• University: ${uni || "[Your University]"}\n\nKeep up the great work!`,
  },
  bug: {
    label: "Report an Issue / Bug 🐞",
    template: (name) =>
      `Hi Prince,\n\nI want to report an issue on StudyStation:\n\n• What happened: \n• Where it happened (Page / Feature): \n• Device / Browser: \n• Student: ${name || "[Your Name]"}\n\nThanks!`,
  },
  feature: {
    label: "Feature Request 💡",
    template: (name) =>
      `Hi Prince,\n\nI have a feature suggestion for StudyStation:\n\n• Idea / Request: \n• Why this would help students: \n• Suggested by: ${name || "[Your Name]"}`,
  },
  general: {
    label: "General Feedback 💬",
    template: (name) =>
      `Hi Prince,\n\nI wanted to share some feedback about StudyStation:\n\n• Message: \n• From: ${name || "[Your Name]"}`,
  },
};

export function WhatsAppFeedbackSection({
  studentName = "",
  university = "",
}: {
  studentName?: string;
  university?: string;
}) {
  const [selectedType, setSelectedType] = useState<FeedbackType>("review");
  const [customText, setCustomText] = useState(() => TEMPLATES.review.template(studentName, university));
  const [copied, setCopied] = useState(false);

  function handleTypeChange(type: FeedbackType) {
    setSelectedType(type);
    setCustomText(TEMPLATES[type].template(studentName, university));
    setCopied(false);
  }

  const encodedMessage = encodeURIComponent(customText.trim());
  const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodedMessage}`;

  function copyToClipboard() {
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(customText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <section className="profile-panel rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-7 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#f0edf4] pb-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <WhatsAppIcon className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-[#28233a] flex items-center gap-2">
              Send Review or Report on WhatsApp
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Direct to Developer
              </span>
            </h2>
            <p className="mt-1 text-xs text-[#85808d]">
              Have a review, bug report, or feature suggestion? Edit the template below and chat with Prince directly on WhatsApp ({SUPPORT_WHATSAPP_DISPLAY}).
            </p>
          </div>
        </div>
      </div>

      {/* Official WhatsApp Student Community Banner */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 to-teal-50/50 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
            <Users className="size-4.5" />
          </span>
          <div>
            <h3 className="text-xs font-black text-[#1e2a22] flex items-center gap-2">
              StudyStation Student WhatsApp Group
              <span className="rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5">
                Official Community
              </span>
            </h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#526356]">
              Connect with fellow students, get study updates, share lecture tips, and request features directly with the community.
            </p>
          </div>
        </div>
        <a
          href={STUDYSTATION_WHATSAPP_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 active:scale-95"
        >
          <WhatsAppIcon className="size-3.5" />
          Join Group
          <ExternalLink className="size-3 opacity-80" />
        </a>
      </div>

      <div className="pt-5 space-y-4">
        {/* Template selector pills */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#7a7388]">
            Choose message template
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(TEMPLATES) as FeedbackType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeChange(type)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  selectedType === type
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                    : "border border-[#e5e1eb] bg-white text-[#554e63] hover:border-emerald-300 hover:bg-emerald-50/40"
                }`}
              >
                {TEMPLATES[type].label}
              </button>
            ))}
          </div>
        </div>

        {/* Editable textarea */}
        <div>
          <label className="text-xs font-bold text-[#625b6d] flex items-center justify-between">
            <span>Edit your message before sending:</span>
            <button
              type="button"
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7259e8] hover:underline"
            >
              {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
              {copied ? "Copied text" : "Copy text"}
            </button>
          </label>
          <textarea
            rows={7}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#ded9ee] p-3.5 text-xs leading-relaxed text-[#28233a] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-sans"
            placeholder="Write your message here..."
          />
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-[#918b9c]">
            Opens WhatsApp on your device with your message ready to send.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-extrabold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-95"
          >
            <WhatsAppIcon className="size-4" />
            Send via WhatsApp
            <ExternalLink className="size-3.5 opacity-80" />
          </a>
        </div>
      </div>
    </section>
  );
}
