"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";

/**
 * Offline / online status banner for the mobile (and desktop) app shell.
 */
export function NetworkStatusBanner() {
  const [online, setOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    const update = () => {
      const next = typeof navigator !== "undefined" ? navigator.onLine : true;
      setOnline((prev) => {
        if (!prev && next) {
          wasOffline.current = true;
          setShowRestored(true);
        }
        if (!next) {
          wasOffline.current = true;
          setShowRestored(false);
        }
        return next;
      });
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!showRestored) return;
    const id = window.setTimeout(() => setShowRestored(false), 2800);
    return () => window.clearTimeout(id);
  }, [showRestored]);

  if (!online) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-[#2b2038] px-4 py-2.5 text-[12px] font-bold text-white shadow-lg sm:top-auto sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2 sm:rounded-2xl"
      >
        <WifiOff className="size-3.5 shrink-0" />
        You’re offline. Changes will sync when you’re back online.
      </div>
    );
  }

  if (showRestored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-[#1f7a55] px-4 py-2.5 text-[12px] font-bold text-white shadow-lg sm:top-auto sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2 sm:rounded-2xl"
      >
        <Wifi className="size-3.5 shrink-0" />
        You’re back online
      </div>
    );
  }

  return null;
}

type PullToRefreshProps = {
  children: ReactNode;
  /** Extra class on the scroll container */
  className?: string;
};

/**
 * Mobile pull-to-refresh. Activates when the user pulls down from the top of the page.
 */
export function PullToRefresh({ children, className = "" }: PullToRefreshProps) {
  const router = useRouter();
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const THRESHOLD = 72;

  const canPull = useCallback(() => {
    if (typeof window === "undefined") return false;
    // Only when scrolled to top
    return window.scrollY <= 2 || document.documentElement.scrollTop <= 2;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      if (!canPull()) {
        pulling.current = false;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? 0;
      pulling.current = true;
    },
    [canPull, refreshing],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;
      if (!canPull()) {
        pulling.current = false;
        setPull(0);
        return;
      }
      const y = e.touches[0]?.clientY ?? 0;
      const delta = y - startY.current;
      if (delta > 0) {
        // Resist overscroll feel
        const resisted = Math.min(delta * 0.45, 120);
        setPull(resisted);
      } else {
        setPull(0);
      }
    },
    [canPull, refreshing],
  );

  const onTouchEnd = useCallback(() => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      // Soft full refresh of server components + client data
      try {
        router.refresh();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, 900);
    } else {
      setPull(0);
    }
  }, [pull, refreshing, router]);

  const indicatorHeight = refreshing ? THRESHOLD : pull;
  const ready = pull >= THRESHOLD || refreshing;

  return (
    <div
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        aria-hidden={!ready && pull === 0}
        className="pointer-events-none flex items-center justify-center overflow-hidden transition-[height] duration-150 ease-out lg:hidden"
        style={{ height: indicatorHeight }}
      >
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-sm ${
            ready
              ? "border-[#cfc4ff] bg-[#f3f0ff] text-[#5b47bd]"
              : "border-[#e8e4ef] bg-white/90 text-[#8a8494]"
          }`}
        >
          {refreshing ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" />
              Refreshing…
            </>
          ) : (
            <>
              <RefreshCw className={`size-3.5 ${ready ? "text-[#7259e8]" : ""}`} style={{ transform: `rotate(${Math.min(pull, 90)}deg)` }} />
              {ready ? "Release to refresh" : "Pull to refresh"}
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
