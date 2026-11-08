import { useMemo, useState, type MouseEvent } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { Button, Card, EmptyState, FilterDrawer, Input, Select } from "./ui";
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
  const [section, setSection] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const allResults = useMemo(() => searchTrackerData(data, ""), [data]);
  const activeQuery = query.trim().length >= 2 ? query : "";
  const normalizedSearch = activeQuery.toLocaleLowerCase().trim();
  const searchTerms = normalizedSearch.split(/\s+/).filter(Boolean);
  const searchedResults = useMemo(() => searchTerms.length
    ? allResults.filter((result) => {
      const searchableText = result.fields.map(({ label, value }) => `${label} ${value}`).join(" ").toLocaleLowerCase();
      return searchTerms.every((term) => searchableText.includes(term));
    })
    : allResults, [allResults, normalizedSearch]);
  const sections = useMemo(() => [...new Set(allResults.map((result) => result.collection))]
    .sort((a, b) => a.localeCompare(b)), [allResults]);
  const categories = useMemo(() => [...new Set(allResults.flatMap((result) => result.categories))]
    .sort((a, b) => a.localeCompare(b)), [allResults]);
  const statuses = useMemo(() => [...new Set(allResults.flatMap((result) => result.statuses))]
    .sort((a, b) => a.localeCompare(b)), [allResults]);
  const providers = useMemo(() => [...new Set(allResults.flatMap((result) => result.providers))]
    .sort((a, b) => a.localeCompare(b)), [allResults]);
  const hasActiveFilters = Boolean(section || category || status || provider || dateFrom || dateTo);
  const results = useMemo(() => searchedResults.filter((result) =>
    (!section || result.collection === section) &&
    (!category || result.categories.includes(category)) &&
    (!status || result.statuses.includes(status)) &&
    (!provider || result.providers.includes(provider)) &&
    (!(dateFrom || dateTo) || result.dates.some((date) =>
      (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)))), [
    searchedResults, section, category, status, provider, dateFrom, dateTo,
  ]);
  const selected = results.find((result) => result.key === selectedKey);
  const canShowResults = Boolean(activeQuery || hasActiveFilters);

  function clearFilters() {
    setSection("");
    setCategory("");
    setStatus("");
    setProvider("");
    setDateFrom("");
    setDateTo("");
  }

  function openResult(event: MouseEvent<HTMLAnchorElement>, key: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(key);
  }

  return <>
    <div className="page-head"><div><p className="eyebrow">Search your Daybook</p><h1 className="page-title">Global search</h1><p className="page-subtitle">Find records across your lists, notes, documents, and trackers.</p></div></div>
    <Card className="global-search-card">
      <div className="toolbar filter-toolbar global-search-filter-toolbar">
        <div className="search-wrap"><Search size={15} /><Input autoFocus={!selectedKey} aria-label="Search all records" placeholder="Search by keyword or text…" value={query} onChange={(event) => onQueryChange(event.target.value)} /></div>
        <FilterDrawer activeCount={[section, category, status, provider, dateFrom, dateTo].filter(Boolean).length}>
          <label className="field-wrap"><span className="field-label">Section</span><Select aria-label="Filter by section" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">All sections</option>
            {sections.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select></label>
          <label className="field-wrap"><span className="field-label">Category</span><Select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select></label>
          <label className="field-wrap"><span className="field-label">Status</span><Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select></label>
          <label className="field-wrap"><span className="field-label">Provider</span><Select aria-label="Filter by provider" value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="">All providers</option>
            {providers.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select></label>
          <label className="field-wrap"><span className="field-label">From date</span><Input aria-label="Filter from date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className="field-wrap"><span className="field-label">To date</span><Input aria-label="Filter to date" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
          {hasActiveFilters && <Button variant="outline" size="sm" type="button" onClick={clearFilters}>Clear filters</Button>}
        </FilterDrawer>
      </div>
      <p className="section-description global-search-hint">Searches saved record details and notes. Passwords and encrypted credential data are never indexed. Right-click a result to open its details in a new tab.</p>
    </Card>
    {canShowResults
      ? <div className="global-search-results" aria-live="polite">
        <div className="global-search-count">{results.length ? `${results.length} matching ${results.length === 1 ? "record" : "records"}` : "No matching records"}</div>
        {results.length ? results.slice(0, 100).map((result) => <a className="global-search-result" href={resultHref(activeQuery.trim(), result.key)} key={result.key} onClick={(event) => openResult(event, result.key)}>
          <div className="global-search-result-top"><strong>{result.title}</strong><span>{result.collection}</span></div>
          {result.snippet && <p>{result.snippet}</p>}
          <small>Open details <ArrowUpRight size={12} /></small>
        </a>) : <Card><EmptyState icon={<Search size={18} />} title="No matches found" description="Try another word or a shorter phrase." /></Card>}
        {results.length > 100 && <p className="global-search-limit">Showing the first 100 matches. Add a keyword or filter to narrow the results.</p>}
      </div>
      : <Card className="global-search-empty"><EmptyState icon={<Search size={18} />} title="Search or filter your records" description="Enter at least two characters, or choose filters to browse matching records." /></Card>}
    {selected && <ResultDetails result={selected} onClose={() => onSelect(null)} onGoToPage={onGoToPage} />}
  </>;
}
