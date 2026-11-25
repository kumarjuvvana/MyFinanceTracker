import { useEffect, useState } from "react";

const MAX_PREVIEW_ROWS = 300;
const MAX_PREVIEW_COLUMNS = 26;

interface SpreadsheetPreview {
  name: string;
  columns: string[];
  rows: { number: number; values: string[] }[];
  truncated: boolean;
}

export function OfficeDocumentViewer({ source, format }: {
  source: string;
  format: "docx" | "xlsx";
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [documentHtml, setDocumentHtml] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [worksheets, setWorksheets] = useState<SpreadsheetPreview[]>([]);
  const [activeSheet, setActiveSheet] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setDocumentHtml("");
    setWarnings([]);
    setWorksheets([]);
    setActiveSheet("");

    async function loadOfficeDocument() {
      try {
        const response = await fetch(source);
        if (!response.ok) throw new Error(`The file could not be loaded (HTTP ${response.status}).`);
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        if (format === "docx") {
          const [mammoth, purifier] = await Promise.all([import("mammoth"), import("dompurify")]);
          if (cancelled) return;
          const result = await mammoth.default.convertToHtml({ arrayBuffer });
          if (cancelled) return;
          setDocumentHtml(purifier.default.sanitize(result.value));
          setWarnings(result.messages
            .filter((message) => message.type === "warning")
            .map((message) => message.message)
            .slice(0, 3));
          return;
        }

        const xlsx = await import("@e965/xlsx");
        if (cancelled) return;
        const workbook = xlsx.read(arrayBuffer, { type: "array", sheetRows: MAX_PREVIEW_ROWS + 1 });
        const previewSheets = workbook.SheetNames.map((name): SpreadsheetPreview => {
          const worksheet = workbook.Sheets[name];
          const reference = worksheet?.["!ref"];
          if (!reference) return { name, columns: [], rows: [], truncated: false };

          const range = xlsx.utils.decode_range(reference);
          const lastRow = Math.min(range.e.r, range.s.r + MAX_PREVIEW_ROWS - 1);
          const lastColumn = Math.min(range.e.c, range.s.c + MAX_PREVIEW_COLUMNS - 1);
          const columns = Array.from(
            { length: lastColumn - range.s.c + 1 },
            (_, index) => xlsx.utils.encode_col(range.s.c + index),
          );
          const rows = Array.from({ length: lastRow - range.s.r + 1 }, (_, rowIndex) => {
            const row = range.s.r + rowIndex;
            const values = columns.map((_, columnIndex) => {
              const address = xlsx.utils.encode_cell({ r: row, c: range.s.c + columnIndex });
              const cell = worksheet[address];
              return cell ? xlsx.utils.format_cell(cell) : "";
            });
            return { number: row + 1, values };
          });
          return {
            name,
            columns,
            rows,
            truncated: range.e.r > lastRow || range.e.c > lastColumn,
          };
        });
        if (!cancelled) {
          setWorksheets(previewSheets);
          setActiveSheet(previewSheets[0]?.name ?? "");
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "The file preview could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOfficeDocument();
    return () => {
      cancelled = true;
    };
  }, [format, source]);

  const currentSheet = worksheets.find((worksheet) => worksheet.name === activeSheet);
  if (loading) return <div className="office-document-message" role="status">Loading {format.toUpperCase()} preview…</div>;
  if (error) return <div className="office-document-message" role="alert">Could not preview this file: {error}</div>;

  if (format === "docx") {
    return <div className="office-document-content">
      {warnings.length > 0 && <p className="office-document-notice">Some Word formatting may not appear in this preview.</p>}
      <article className="docx-document-content" dangerouslySetInnerHTML={{ __html: documentHtml }} />
    </div>;
  }

  return <div className="spreadsheet-preview">
    {worksheets.length > 1 && <label className="spreadsheet-sheet-picker">
      <span>Worksheet</span>
      <select className="field" aria-label="Choose worksheet" value={activeSheet} onChange={(event) => setActiveSheet(event.target.value)}>
        {worksheets.map((worksheet) => <option key={worksheet.name} value={worksheet.name}>{worksheet.name}</option>)}
      </select>
    </label>}
    {currentSheet?.rows.length
      ? <div className="spreadsheet-table-wrap"><table className="spreadsheet-table">
        <thead><tr><th>Row</th>{currentSheet.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{currentSheet.rows.map((row) => <tr key={row.number}>
          <th>{row.number}</th>
          {row.values.map((value, index) => <td key={`${row.number}-${index}`}>{value}</td>)}
        </tr>)}</tbody>
      </table></div>
      : <p className="office-document-message">This worksheet has no previewable cells.</p>}
    {currentSheet?.truncated && <p className="office-document-notice">Preview is limited to the first {MAX_PREVIEW_ROWS} rows and {MAX_PREVIEW_COLUMNS} columns.</p>}
  </div>;
}
