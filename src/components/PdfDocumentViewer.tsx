import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "./ui";

export function PdfDocumentViewer({ source }: { source: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageViewportRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PDFDocumentProxy | null = null;
    setLoading(true);
    setRendering(false);
    setError("");
    setPageNumber(1);
    setPageCount(0);

    async function loadPdf() {
      try {
        const [pdfjs, workerAsset] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]);
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerAsset.default;
        const pdf = await pdfjs.getDocument({ url: source }).promise;
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        loadedDocument = pdf;
        documentRef.current = pdf;
        setPageCount(pdf.numPages);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "The PDF preview could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPdf();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      documentRef.current = null;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [source]);

  useEffect(() => {
    const element = pageViewportRef.current;
    if (!element) return;
    const measure = () => setViewportWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const pdf = documentRef.current;
    const canvas = canvasRef.current;
    if (loading || !pdf || !canvas || viewportWidth <= 0) return;
    const currentPdf = pdf;
    const currentCanvas = canvas;

    let cancelled = false;
    let renderTask: RenderTask | null = null;
    setRendering(true);
    setError("");

    async function renderPage() {
      try {
        const pdfPage = await currentPdf.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(viewportWidth / baseViewport.width, 2.5);
        const viewport = pdfPage.getViewport({ scale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const context = currentCanvas.getContext("2d");
        if (!context) throw new Error("This browser cannot draw the PDF preview.");

        currentCanvas.width = Math.ceil(viewport.width * outputScale);
        currentCanvas.height = Math.ceil(viewport.height * outputScale);
        currentCanvas.style.width = `${Math.floor(viewport.width)}px`;
        currentCanvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = pdfPage.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "The PDF page could not be rendered.");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      if (renderTaskRef.current === renderTask) renderTaskRef.current = null;
    };
  }, [loading, pageNumber, viewportWidth, pageCount]);

  return <div className="pdf-document-viewer">
    <div className="pdf-document-toolbar">
      <Button type="button" size="sm" variant="outline" aria-label="Previous PDF page" disabled={loading || pageNumber <= 1} onClick={() => setPageNumber((current) => Math.max(1, current - 1))}><ChevronLeft size={14} />Previous</Button>
      <span role="status">{loading ? "Loading PDF…" : error ? "Preview unavailable" : `Page ${pageNumber} of ${pageCount}${rendering ? " · Rendering…" : ""}`}</span>
      <Button type="button" size="sm" variant="outline" aria-label="Next PDF page" disabled={loading || pageNumber >= pageCount} onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}>Next<ChevronRight size={14} /></Button>
    </div>
    <div className="pdf-document-page" ref={pageViewportRef}>
      {loading && <p className="pdf-document-message">Loading PDF preview…</p>}
      {!loading && error && <p className="pdf-document-message" role="alert">Could not show this PDF in the app: {error}</p>}
      {!loading && !error && <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} />}
    </div>
  </div>;
}
