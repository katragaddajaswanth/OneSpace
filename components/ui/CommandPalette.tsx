"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

type SearchResult = { id: string; title: string; subtitle?: string; href: string; type: string };
type PaletteItem = SearchResult & { type: string };

const navigationItems: PaletteItem[] = [
  { id: "dashboard", title: "Dashboard", subtitle: "Your university overview", href: "/", type: "navigation" },
  { id: "profile", title: "Profile", subtitle: "Manage your profile", href: "/profile", type: "navigation" },
  { id: "university", title: "My University", subtitle: "Explore your university", href: "/university", type: "navigation" },
  { id: "academic", title: "Academic Hub", subtitle: "Courses and academic records", href: "/academic-hub", type: "navigation" },
  { id: "projects", title: "Project Nexus", subtitle: "Discover and build projects", href: "/projects", type: "navigation" },
  { id: "communities", title: "Communities", subtitle: "Connect with university members", href: "/communities", type: "navigation" },
  { id: "mentorship", title: "Mentorship", subtitle: "Find guidance and expertise", href: "/mentorship", type: "navigation" },
  { id: "opportunities", title: "Career & Opportunities", subtitle: "Find internships and jobs", href: "/opportunities", type: "navigation" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=8`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        setResults(response.ok ? data.results ?? [] : []);
        setActiveIndex(0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const items = query.trim().length >= 2
    ? results
    : navigationItems;

  function choose(item: PaletteItem) {
    onClose();
    router.push(item.href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") onClose();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && items[activeIndex]) choose(items[activeIndex]);
    if (event.key === "Tab") {
      event.preventDefault();
      inputRef.current?.focus();
    }
  }

  if (!open) return null;

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={handleKeyDown}>
        <div className="command-palette-search">
          <span aria-hidden="true">⌕</span>
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, projects, skills..." aria-label="Search One-Space" />
          <kbd>ESC</kbd>
        </div>
        <div className="command-palette-results" role="listbox" aria-label="Search results">
          {loading && <div className="command-palette-empty">Searching One-Space…</div>}
          {!loading && items.length === 0 && <div className="command-palette-empty">No results found. Try a person, project or skill.</div>}
          {!loading && items.map((item, index) => (
            <button type="button" key={`${item.type}-${item.id}`} role="option" aria-selected={index === activeIndex} className={`command-palette-item ${index === activeIndex ? "is-active" : ""}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(item)}>
              <span className="command-palette-item-icon" aria-hidden="true">{item.type === "navigation" ? "↗" : item.type.slice(0, 1).toUpperCase()}</span>
              <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
              <span className="command-palette-item-type">{item.type}</span>
            </button>
          ))}
        </div>
        <div className="command-palette-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
      </div>
    </div>
  );
}
