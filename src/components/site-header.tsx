"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Menu, X } from "lucide-react";
import { AndroidIcon } from "@/components/android-icon";
import { Brand } from "@/components/brand";
import { useInstallApp } from "@/components/install-app";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { openInstallInstructions } = useInstallApp();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
          scrolled || menuOpen
            ? "border-b border-white/50 bg-white/70 shadow-[0_8px_32px_rgba(43,35,83,0.08)] backdrop-blur-2xl backdrop-saturate-150"
            : "border-b border-transparent bg-white/45 backdrop-blur-xl backdrop-saturate-125"
        }`}
        style={{ WebkitBackdropFilter: scrolled || menuOpen ? "blur(20px) saturate(1.5)" : "blur(16px) saturate(1.25)" }}
      >
        <div className="mx-auto flex h-[64px] max-w-[1200px] items-center justify-between px-5 sm:h-[72px] lg:px-8">
          <Brand />
          <nav className="hidden items-center gap-8 text-[14px] font-semibold text-[#555064] md:flex" aria-label="Main navigation">
            <a className="transition hover:text-[#7259e8]" href="#how-it-works">How it works</a>
            <a className="transition hover:text-[#7259e8]" href="#features">Features</a>
            <a className="transition hover:text-[#7259e8]" href="#students">For students</a>
            <a className="transition hover:text-[#7259e8]" href="#faq">FAQ</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={openInstallInstructions} className="inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold text-[#514a66] transition hover:bg-white/70" type="button">
              <Download className="size-4" /> Install
            </button>
            <Link href="/download" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#ded9ee]/80 bg-white/50 px-3.5 text-[13px] font-bold text-[#514a66] transition hover:border-[#7259e8] hover:text-[#7259e8]">
              <AndroidIcon className="size-3.5" /> Android
            </Link>
            <Link href="/auth/login" className="inline-flex h-10 items-center rounded-xl bg-[#17132d] px-5 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(23,19,45,.16)] transition hover:-translate-y-0.5 hover:bg-[#2b244b]">
              Sign in
            </Link>
          </div>
          <button
            onClick={() => setMenuOpen((value) => !value)}
            className="grid size-10 place-items-center rounded-xl border border-white/60 bg-white/70 text-[#17132d] shadow-sm backdrop-blur-md md:hidden"
            aria-label="Toggle navigation"
            type="button"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-white/40 bg-white/80 px-5 py-5 backdrop-blur-2xl md:hidden">
            <nav className="flex flex-col gap-1 text-[15px] font-semibold">
              {[["How it works", "#how-it-works"], ["Features", "#features"], ["For students", "#students"], ["FAQ", "#faq"]].map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 hover:bg-[#f7f5ff]">{label}</a>
              ))}
              <button onClick={openInstallInstructions} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-[#ded9ee] px-4 py-3 font-bold" type="button"><Download className="size-4" /> Install app</button>
              <a href="/download" className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-4 py-3 font-bold text-white"><AndroidIcon className="size-4" /> Download Android</a>
              <Link href="/auth/login" className="mt-1 rounded-xl bg-[#17132d] px-4 py-3 text-center font-bold text-white">Sign in</Link>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
