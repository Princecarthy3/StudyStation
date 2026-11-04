"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, ZoomIn, ZoomOut } from "lucide-react";

type PdfPageViewerProps = {
  src: string;
  title?: string;
  className?: string;
};

/**
 * In-app PDF viewer that renders pages to canvas with prev/next controls.
 * Works on mobile Safari where native iframe/object PDF embeds are static.
 */
export function PdfPageViewer({ src, title, className }: PdfPageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);

  // Load document once per src
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPage(1);
    setNumPages(0);
    pdfRef.current = null;

    async function load() {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Worker from CDN matching package major version
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjs.getDocument({
          url: src,
          withCredentials: true,
          // Range requests help large lecture decks
          disableAutoFetch: false,
          disableStream: false,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        pdfRef.current = pdf as typeof pdfRef.current;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : "Could not open this PDF.");
      }
    }

    void load();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [src]);

  const renderPage = useCallback(async (pageNumber: number, currentScale: number) => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;

    setRendering(true);
    try {
      renderTaskRef.current?.cancel();
      const pageObj = (await pdf.getPage(pageNumber)) as {
        getViewport: (opts: { scale: number }) => { width: number; height: number };
        render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void };
      };

      // Fit width of container on mobile
      const containerWidth = containerRef.current?.clientWidth ?? 360;
      const unscaled = pageObj.getViewport({ scale: 1 });
      const fitScale = Math.max(0.5, (containerWidth - 16) / unscaled.width);
      const finalScale = currentScale * fitScale;
      const viewport = pageObj.getViewport({ scale: finalScale });

      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      // pdfjs v4+ accepts canvas in the render parameters
      const task = pageObj.render({
        canvasContext: context,
        viewport,
        canvas,
      } as { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      // Ignore cancelled render tasks
      if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "RenderingCancelledException") {
        return;
      }
      setError(err instanceof Error ? err.message : "Page could not be rendered.");
    } finally {
      setRendering(false);
    }
  }, []);

  useEffect(() => {
    if (!numPages || loading) return;
    void renderPage(page, scale);
  }, [page, scale, numPages, loading, renderPage]);

  // Re-render on resize (orientation change)
  useEffect(() => {
    if (!numPages) return;
    const onResize = () => {
      void renderPage(page, scale);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [numPages, page, scale, renderPage]);

  const go = (delta: number) => {
    setPage((current) => Math.min(numPages, Math.max(1, current + delta)));
  };

  return (
    <div className={`flex h-full min-h-0 flex-col bg-[#f3f1f7] ${className ?? ""}`}>
      {/* Page controls */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e8e4ef] bg-white/95 px-2 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={page <= 1 || loading}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#e4dff0] bg-white px-2.5 text-xs font-bold text-[#3d3650] disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <span className="text-xs font-extrabold tabular-nums text-[#2a2440]">
            {numPages ? `${page} / ${numPages}` : "—"}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.15).toFixed(2))))}
              className="grid size-8 place-items-center rounded-lg border border-[#e4dff0] bg-white text-[#3d3650]"
              aria-label="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))))}
              className="grid size-8 place-items-center rounded-lg border border-[#e4dff0] bg-white text-[#3d3650]"
              aria-label="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          disabled={!numPages || page >= numPages || loading}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#e4dff0] bg-white px-2.5 text-xs font-bold text-[#3d3650] disabled:opacity-40"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Canvas stage */}
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto">
        {(loading || rendering) && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#1d192e]/90 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg">
              <LoaderCircle className="size-3.5 animate-spin" />
              {loading ? "Loading document…" : "Rendering page…"}
            </span>
          </div>
        )}

        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-bold text-[#3d3650]">Could not display this document in-app.</p>
            <p className="max-w-sm text-xs text-[#7a738a]">{error}</p>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-xl bg-[#7259e8] px-4 text-xs font-extrabold text-white"
            >
              Open in browser instead
            </a>
          </div>
        ) : (
          <div className="flex justify-center p-2 sm:p-4">
            <canvas
              ref={canvasRef}
              className="max-w-full rounded-lg bg-white shadow-md"
              aria-label={title ? `${title} — page ${page}` : `PDF page ${page}`}
            />
          </div>
        )}
      </div>

      {/* Mobile-friendly bottom pager */}
      {numPages > 1 && (
        <div className="flex shrink-0 items-center gap-2 border-t border-[#e8e4ef] bg-white px-3 py-2 sm:hidden">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={page <= 1}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#f3f0fa] text-sm font-extrabold text-[#3d3650] disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={page >= numPages}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#7259e8] text-sm font-extrabold text-white disabled:opacity-40"
          >
            Next page
          </button>
        </div>
      )}
    </div>
  );
}
