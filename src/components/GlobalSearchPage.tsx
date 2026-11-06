import { useMemo, type MouseEvent } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { Button, Card, EmptyState, Input } from "./ui";
import { searchTrackerData, type GlobalSearchResult } from "../lib/globalSearch";
import type { Page, TrackerData } from "../types";

interface GlobalSearchPageProps {
  data: TrackerData;
  query: string;
  selectedKey: string | null;
  onQueryChange: (query: string) => void;
  onSelect: (key: string | null) => void;
  onGoToPage: (page: Page) => void;
}

function resultHref(query: string, key: string) {
  const params = new URLSearchParams({ page: "Global search", q: query, record: key });
  return `${window.location.pathname}?${params.toString()}`;
}

function ResultDetails({ result, onClose, onGoToPage }: {
  result: GlobalSearchResult;
  onClose: () => void;
  onGoToPage: (page: Page) => void;
}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="modal modal-wide global-search-detail" role="dialog" aria-modal="true" aria-labelledby="global-search-detail-title">
      <div className="modal-head"><div><p className="eyebrow">{result.collection}</p><h2 id="global-search-detail-title">{result.title}</h2></div><button className="icon-button" type="button" aria-label="Close record details" onClick={onClose}><X size={16} /></button></div>
      <div className="global-search-fields">{result.fields.map((field, index) =>
        <div className="global-search-field" key={`${field.label}-${index}`}><span>{field.label}</span><p>{field.value}</p></div>)}</div>
      <div className="modal-actions"><Button variant="outline" type="button" onClick={onClose}>Close</Button><Button type="button" onClick={() => onGoToPage(result.page)}>Open {result.page}<ArrowUpRight size={14} /></Button></div>
    </section>
  </div>;
}

export function GlobalSearchPage({ data, query, selectedKey, onQueryChange, onSelect, onGoToPage }: GlobalSearchPageProps) {
  const results = useMemo(() => searchTrackerData(data, query), [data, query]);
  const selected = results.find((result) => result.key === selectedKey);
  const minQueryLength = query.trim().length >= 2;

  function openResult(event: MouseEvent<HTMLAnchorElement>, key: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(key);
  }

  return <>
    <div className="page-head"><div><p className="eyebrow">Search your Daybook</p><h1 className="page-title">Global search</h1><p className="page-subtitle">Find records across your lists, notes, documents, and trackers.</p></div></div>
    <Card className="global-search-card">
      <label className="global-search-input"><Search size={17} /><Input autoFocus={!selectedKey} aria-label="Search all records" placeholder="Search by keyword or text…" value={query} onChange={(event) => onQueryChange(event.target.value)} /></label>
      <p className="section-description global-search-hint">Searches saved record details and notes. Passwords and encrypted credential data are never indexed. Right-click a result to open its details in a new tab.</p>
    </Card>
    {query.trim() && (minQueryLength
      ? <div className="global-search-results" aria-live="polite">
        <div className="global-search-count">{results.length ? `${results.length} matching ${results.length === 1 ? "record" : "records"}` : "No matching records"}</div>
        {results.length ? results.slice(0, 100).map((result) => <a className="global-search-result" href={resultHref(query.trim(), result.key)} key={result.key} onClick={(event) => openResult(event, result.key)}>
          <div className="global-search-result-top"><strong>{result.title}</strong><span>{result.collection}</span></div>
          {result.snippet && <p>{result.snippet}</p>}
          <small>Open details <ArrowUpRight size={12} /></small>
        </a>) : <Card><EmptyState icon={<Search size={18} />} title="No matches found" description="Try another word or a shorter phrase." /></Card>}
        {results.length > 100 && <p className="global-search-limit">Showing the first 100 matches. Add another keyword to narrow the results.</p>}
      </div>
      : <Card className="global-search-empty"><EmptyState icon={<Search size={18} />} title="Start typing to search" description="Enter at least two characters to find matching records." /></Card>)}
    {!query.trim() && <Card className="global-search-empty"><EmptyState icon={<Search size={18} />} title="Start typing to search" description="Enter at least two characters to find matching records." /></Card>}
    {selected && <ResultDetails result={selected} onClose={() => onSelect(null)} onGoToPage={onGoToPage} />}
  </>;
}
