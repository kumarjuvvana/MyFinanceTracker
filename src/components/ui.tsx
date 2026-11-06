import { useEffect, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { X } from "lucide-react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" };

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return <button className={`button button-${variant} button-${size} ${className}`} {...props} />;
}

export function Card({ children, className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`} {...props}>{children}</section>;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field ${className}`} {...props} />;
}

type ExternalLinkInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & { value: string };

export function ExternalLinkInput({ value, ...props }: ExternalLinkInputProps) {
  let safeLink = false;
  try {
    safeLink = new URL(value).protocol === "https:";
  } catch {
    safeLink = false;
  }

  return <>
    <Input {...props} type="url" value={value} />
    {safeLink && <a className="external-link-preview" href={value} target="_blank" rel="noopener noreferrer">Open link in new tab</a>}
  </>;
}

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

function parseDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { year: "", month: "", day: "" };
  return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) };
}

function daysInMonth(year: string, month: string) {
  if (!year || !month) return 31;
  const monthNumber = Number(month);
  if (monthNumber === 2) {
    const yearNumber = Number(year);
    return yearNumber % 4 === 0 && (yearNumber % 100 !== 0 || yearNumber % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(monthNumber) ? 30 : 31;
}

export function DateInput({ value, onValueChange, className = "", required = false, disabled = false, min, max, autoFocus = false, ...props }: DateInputProps) {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches);
  const [parts, setParts] = useState(() => parseDateParts(value));

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const updateViewport = () => setMobile(query.matches);
    updateViewport();
    query.addEventListener("change", updateViewport);
    return () => query.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => setParts(parseDateParts(value)), [value]);

  function updatePart(part: keyof typeof parts, next: string) {
    const updated = { ...parts, [part]: next };
    const maxDay = daysInMonth(updated.year, updated.month);
    if (Number(updated.day) > maxDay) updated.day = String(maxDay);
    setParts(updated);
    if (/^\d{4}$/.test(updated.year) && Number(updated.year) >= 1 && Number(updated.year) <= 9999 &&
      Number(updated.month) >= 1 && Number(updated.month) <= 12 &&
      Number(updated.day) >= 1 && Number(updated.day) <= daysInMonth(updated.year, updated.month)) {
      const nextValue = `${updated.year.padStart(4, "0")}-${updated.month.padStart(2, "0")}-${updated.day.padStart(2, "0")}`;
      if ((!min || nextValue >= min) && (!max || nextValue <= max)) onValueChange(nextValue);
    } else if (!updated.year && !updated.month && !updated.day) {
      onValueChange("");
    }
  }

  const monthLabel = props["aria-label"] || "Date";
  const mobileRequired = mobile && (required || Boolean(parts.year || parts.month || parts.day));
  return <div className={`date-input ${className}`}>
    <input {...props} className="field date-input-native" type="date" value={value} autoFocus={autoFocus && !mobile} required={required && !mobile} disabled={disabled} min={min} max={max} onChange={(event) => onValueChange(event.target.value)} />
    <div className="date-input-mobile" role="group" aria-label={monthLabel}>
      <select className="field" aria-label={`${monthLabel} month`} value={parts.month} required={mobileRequired} disabled={disabled} onChange={(event) => updatePart("month", event.target.value)}>
        <option value="">Month</option>
        {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1)}>{new Date(2000, index).toLocaleDateString(undefined, { month: "short" })}</option>)}
      </select>
      <select className="field" aria-label={`${monthLabel} day`} value={parts.day} required={mobileRequired} disabled={disabled} onChange={(event) => updatePart("day", event.target.value)}>
        <option value="">Day</option>
        {Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, index) => <option key={index + 1} value={String(index + 1)}>{index + 1}</option>)}
      </select>
      <input className="field date-year-input" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="YYYY" aria-label={`${monthLabel} year`} value={parts.year} required={mobileRequired} disabled={disabled} onChange={(event) => updatePart("year", event.target.value.replace(/\D/g, ""))} />
    </div>
  </div>;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`field ${className}`} {...props} />;
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`field-wrap ${className}`}><span className="field-label">{label}</span>{children}</label>;
}

export function EmptyState({ title, description, icon }: { title: string; description: string; icon: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><p className="empty-title">{title}</p><p className="empty-copy">{description}</p></div>;
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        {children}
      </section>
    </div>
  );
}

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "blue"; className?: string }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}
