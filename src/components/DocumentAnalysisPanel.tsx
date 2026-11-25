import { useState } from "react";
import { Download, FileText, LoaderCircle, ScanText } from "lucide-react";
import { Button, Card, Select } from "./ui";
import { canExtractDocumentText, extractDocumentText, identifyDocumentKeyFindings, type DocumentKeyFindings } from "../lib/documentTextExtraction";
import type { DocumentAttachment, DocumentCategory } from "../types";

interface DocumentAnalysisResult {
  document: DocumentAttachment;
  text: string;
  findings: DocumentKeyFindings;
  warnings: string[];
  error?: string;
}

export function DocumentAnalysisPanel({ documents, categories, createFileUrl }: {
  documents: DocumentAttachment[];
  categories: DocumentCategory[];
  createFileUrl: (storagePath: string) => Promise<string>;
}) {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [results, setResults] = useState<DocumentAnalysisResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const matchingDocuments = selectedCategory === "all"
    ? documents
    : documents.filter((document) => document.categoryId === selectedCategory);
  const attachedDocuments = matchingDocuments.filter((document) => Boolean(document.storagePath));
  const supportedDocuments = attachedDocuments.filter((document) => canExtractDocumentText(document.fileName));

  async function analyseCategory() {
    if (!selectedCategory) return;
    setBusy(true);
    setError("");
    setResults([]);
    const analysed: DocumentAnalysisResult[] = [];
    try {
      for (let index = 0; index < supportedDocuments.length; index += 1) {
        const document = supportedDocuments[index];
        setProgress(`Reading ${index + 1} of ${supportedDocuments.length}: ${document.fileName}`);
        try {
          const source = await createFileUrl(document.storagePath);
          const response = await fetch(source);
          if (!response.ok) throw new Error(`The private file could not be downloaded (HTTP ${response.status}).`);
          const extraction = await extractDocumentText(document.fileName, await response.arrayBuffer());
          analysed.push({
            document,
            text: extraction.text,
            findings: identifyDocumentKeyFindings(extraction.text),
            warnings: extraction.warnings,
          });
        } catch (caught) {
          analysed.push({
            document,
            text: "",
            findings: { companyReferences: [], roleDetails: [], employmentDates: [], salaryDetails: [], otherTerms: [] },
            warnings: [],
            error: caught instanceof Error ? caught.message : "The document could not be analysed.",
          });
        }
        setResults([...analysed]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The selected documents could not be analysed.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  function downloadReport() {
    const report = results.map(({ document, findings, warnings, error: documentError }) => [
      `DOCUMENT: ${document.title} (${document.fileName})`,
      documentError ? `Analysis error: ${documentError}` : "",
      ...Object.entries({
        "Possible company / employer references": findings.companyReferences,
        "Possible job details": findings.roleDetails,
        "Possible employment dates": findings.employmentDates,
        "Possible salary details": findings.salaryDetails,
        "Other important terms": findings.otherTerms,
      }).flatMap(([heading, lines]) => lines.length ? [`${heading}:`, ...lines.map((line) => `- ${line}`)] : []),
      warnings.length ? `Notes:\n${warnings.map((warning) => `- ${warning}`).join("\n")}` : "",
    ].filter(Boolean).join("\n")).join("\n\n");
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `document-analysis-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const findingGroups: { key: keyof DocumentKeyFindings; label: string }[] = [
    { key: "companyReferences", label: "Possible company / employer references" },
    { key: "roleDetails", label: "Possible job details" },
    { key: "employmentDates", label: "Possible employment dates" },
    { key: "salaryDetails", label: "Possible salary details" },
    { key: "otherTerms", label: "Other important terms" },
  ];

  return <div className="document-analysis">
    <Card className="document-analysis-intro">
      <div className="document-analysis-title"><ScanText size={20} /><div><h2 className="section-title">Analyse Documents Data</h2>
        <p className="section-description">Choose a category to read its attached files and find possible employer names, job details, dates, salary information, and employment terms.</p></div></div>
      <p className="document-analysis-privacy">This is local text/OCR scanning with pattern-based suggestions, not generative AI. Files are read from private storage into this browser; no AI service receives them, and results are not saved. OCR uses English and may take time on scanned PDFs. Verify suggestions against the source.</p>
    </Card>
    <Card className="document-analysis-controls">
      <label className="field-wrap"><span className="field-label">Category to analyse</span>
        <Select aria-label="Category to analyse" value={selectedCategory} disabled={busy} onChange={(event) => {
          setSelectedCategory(event.target.value);
          setResults([]);
          setError("");
        }}>
          <option value="">Choose a category</option>
          <option value="all">All categories</option>
          {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
        </Select>
      </label>
      {selectedCategory && <p className="section-description">{matchingDocuments.length} {matchingDocuments.length === 1 ? "document" : "documents"} in this selection · {supportedDocuments.length} supported files{attachedDocuments.length > supportedDocuments.length ? ` · ${attachedDocuments.length - supportedDocuments.length} unsupported formats` : ""}{matchingDocuments.length > attachedDocuments.length ? ` · ${matchingDocuments.length - attachedDocuments.length} without a file` : ""}</p>}
      <Button type="button" onClick={() => void analyseCategory()} disabled={!selectedCategory || !supportedDocuments.length || busy}>
        {busy ? <><LoaderCircle size={14} className="spin" />Analysing…</> : <><ScanText size={14} />Analyse selected documents</>}
      </Button>
      {progress && <p className="document-analysis-progress" role="status">{progress}</p>}
    </Card>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {results.length > 0 && <div className="document-analysis-results-heading"><div><h2 className="section-title">Analysis results</h2><p className="section-description">Possible matches only—verify details against the original documents.</p></div>
      <Button type="button" variant="outline" onClick={downloadReport}><Download size={14} />Download text report</Button></div>}
    <div className="document-analysis-results">{results.map((result) => <Card className="document-analysis-result" key={result.document.id}>
      <div className="document-analysis-result-title"><FileText size={16} /><div><h3>{result.document.title}</h3><p>{result.document.fileName}{result.document.isArchived ? " · Archived" : ""}</p></div></div>
      {result.error ? <p className="document-analysis-error" role="alert">{result.error}</p> : <>
        {findingGroups.map(({ key, label }) => result.findings[key].length > 0 && <section className="document-analysis-findings" key={key}>
          <h4>{label}</h4><ul>{result.findings[key].map((line, index) => <li key={`${key}-${index}`}>{line}</li>)}</ul>
        </section>)}
        {!Object.values(result.findings).some((items) => items.length > 0) && <p className="document-analysis-empty">No matching details were detected. Open the extracted text to review it manually.</p>}
        {result.warnings.map((warning) => <p className="document-analysis-warning" key={warning}>{warning}</p>)}
        {result.text && <details className="document-analysis-text"><summary>View extracted text</summary><pre>{result.text}</pre></details>}
      </>}
    </Card>)}</div>
  </div>;
}
