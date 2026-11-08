import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  ShieldAlert,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { ForceLightTheme } from "@/components/force-light-theme";
import { ANDROID_APK_URL, ANDROID_VERSION } from "@/lib/android-download";
import { footerLinkGroups } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Download StudyStation for Android | StudyStation",
  description:
    "Download StudyStation for Android. Capture lectures, generate AI-powered notes, summarize learning materials and organize your university studies.",
  alternates: {
    canonical: "/download",
  },
  openGraph: {
    title: "Download StudyStation for Android",
    description:
      "Install StudyStation on your Android device. Capture lectures, generate notes, and study smarter anywhere.",
    url: "/download",
  },
};

const steps = [
  "Tap Download for Android.",
  "Wait for the APK to download.",
  "Open the downloaded APK.",
  "If Android requests permission, allow installation from that source.",
  "Tap Install.",
  "Open StudyStation and sign in.",
];

export default function DownloadPage() {
  return (
    <div className="public-surface min-h-screen bg-[#fbfaff] text-[#17132d]">
      <ForceLightTheme />
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-12 sm:pt-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-[#6e677c] transition hover:text-[#7259e8]"
        >
          <ArrowLeft className="size-4" /> Back to homepage
        </Link>

        <div className="mt-8 rounded-[28px] border border-[#e8e4f1] bg-white p-6 shadow-sm sm:p-10">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#7259e8] to-[#5b47bd] text-white shadow-lg shadow-[#7259e8]/25">
              <Smartphone className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[.14em] text-[#7259e8]">Android APK</p>
              <h1 className="mt-1 text-[28px] font-black tracking-tight sm:text-[34px]">
                Download StudyStation for Android
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-[#605a72]">
                Get StudyStation on your Android device and take your learning experience wherever you go.
                Capture lectures, generate notes, revise with AI, and plan your semester.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={ANDROID_APK_URL}
              className="inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#7259e8] to-[#6147dd] px-7 text-[15px] font-extrabold text-white shadow-[0_16px_36px_rgba(114,89,232,.32)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(114,89,232,.4)]"
              aria-label="Download StudyStation for Android"
            >
              <Download className="size-5" />
              Download for Android
            </a>
            <span className="text-center text-[13px] font-bold text-[#8a8494] sm:text-left">
              Version {ANDROID_VERSION} · Direct APK install
            </span>
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-[#f0e4c8] bg-[#fff9e9] p-4 text-[13px] leading-relaxed text-[#685c41]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              This is a <strong>direct APK installation</strong>, not a Google Play install. Android may ask for
              permission to install apps downloaded from outside the Play Store — that is expected for this
              release.
            </p>
          </div>

          <div className="mt-10">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#7259e8]" />
              <h2 className="text-[15px] font-extrabold">Installation guide</h2>
            </div>
            <ol className="mt-4 space-y-3">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-[14px] leading-snug text-[#3d3650]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#eeeaff] text-[12px] font-black text-[#7259e8]">
                    {index + 1}
                  </span>
                  <span className="pt-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <ul className="mt-8 space-y-2 rounded-2xl bg-[#f7f5ff] p-5 text-[13px] text-[#4e4560]">
            {[
              "Works on Android phones and tablets",
              "Sign in with your existing StudyStation account",
              "When a new version is released, download the latest APK from this page",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-[#7259e8]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-[#eeeaf2] pt-6">
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#e5e1eb] bg-white px-4 text-[13px] font-extrabold text-[#3d3650] transition hover:border-[#7259e8] hover:text-[#7259e8]"
            >
              <ArrowLeft className="size-4" /> Homepage
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#17132d] px-4 text-[13px] font-extrabold text-white"
            >
              Create free account <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-[12px] text-[#8a8494]">
          Looking for the browser app? You can also{" "}
          <Link href="/" className="font-bold text-[#7259e8]">
            open StudyStation on the web
          </Link>{" "}
          and install it as a progressive web app.
        </p>
      </main>

      <footer className="border-t border-[#ebe8f3] bg-white px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Brand />
          <div className="flex flex-wrap justify-center gap-4 text-[12px] font-bold text-[#6e677c]">
            {footerLinkGroups
              .flatMap((g) => g.links)
              .slice(0, 6)
              .map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-[#7259e8]">
                  {link.label}
                </Link>
              ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
