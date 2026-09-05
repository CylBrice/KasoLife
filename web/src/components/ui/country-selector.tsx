"use client";

import { useState, useRef, useEffect } from "react";
import { ALL_COUNTRIES, filterCountries, getCountryByCode } from "@/utils/countries";
import { CountryFlag } from "./country-flag";
import { ChevronDown } from "lucide-react";

interface CountrySelectorProps {
  value: string;
  onChange: (code: string) => void;
}

export function CountrySelector({ value, onChange }: CountrySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = getCountryByCode(value);
  const filtered = search ? filterCountries(search) : ALL_COUNTRIES;

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 40);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-1.5 rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream hover:border-gold/50 transition-colors"
      >
        <CountryFlag code={value} size={18} />
        <span className="text-sage">{selected?.dialCode}</span>
        <ChevronDown className="h-3.5 w-3.5 text-sage-muted" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-ink-line bg-ink-surface shadow-lg">
          <div className="border-b border-ink-line p-2">
            <input
              ref={searchRef}
              type="text"
              placeholder="Chercher un pays…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg bg-ink-raised px-3 py-1.5 text-sm text-cream placeholder:text-sage-muted focus:outline-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-sage-muted">Aucun résultat</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-cream hover:bg-ink-raised transition-colors text-left"
                >
                  <CountryFlag code={c.code} size={18} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-sage-muted">{c.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
