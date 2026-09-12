"use client";

import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";

/**
 * Whitelist stricte : seules les balises et attributs inoffensifs sont autorisés.
 * - Balises de mise en forme texte + <marquee> pour les animations
 * - Attribut style limité aux propriétés CSS visuelles (pas d'url(), pas d'expression())
 * - Zéro event handler (onclick, onerror, etc.)
 * - Zéro script, iframe, form, object, embed
 */
const PURIFY_CONFIG = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "del", "mark", "small", "span", "br", "marquee"],
  ALLOWED_ATTR: ["style", "direction", "behavior", "scrollamount"],
  ALLOWED_URI_REGEXP: /^$/,        // aucun attribut href/src autorisé
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onmouseout", "onfocus", "onblur"],
  FORCE_BODY: false,
};

/** Sanitize côté client — appelée avant affichage ET avant envoi au backend */
export function sanitizeHtmlTitle(raw: string): string {
  if (typeof window === "undefined") return raw; // SSR : pas de DOM
  const clean = DOMPurify.sanitize(raw, PURIFY_CONFIG);
  // Retire en plus les expressions CSS dangereuses (ex: expression(), url())
  return clean.replace(/expression\s*\(/gi, "").replace(/url\s*\(/gi, "");
}

interface HtmlTitleInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Champ titre acceptant du HTML limité (animations, couleurs, gras…).
 * - Textarea pour la saisie brute
 * - Preview sanitizé en temps réel en dessous
 */
export function HtmlTitleInput({
  value,
  onChange,
  placeholder = "Titre (HTML autorisé : <b>, <i>, <marquee>, <span style=\"color:red\">…)",
  maxLength = 300,
  className = "",
  disabled = false,
}: HtmlTitleInputProps) {
  const [preview, setPreview] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreview(sanitizeHtmlTitle(value));
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  const hasHtml = /<[a-z][\s\S]*>/i.test(value);

  return (
    <div className={`flex flex-col gap-1 min-w-0 flex-1 ${className}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        rows={1}
        className="w-full resize-none rounded-xl border border-ink-line bg-ink-surface px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold leading-5 overflow-hidden"
        style={{ minHeight: "2.5rem" }}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }}
      />
      {/* Preview HTML sanitizé — visible uniquement si du HTML est détecté */}
      {hasHtml && preview && (
        <div className="rounded-xl border border-ink-line/50 bg-ink-raised px-3 py-1.5">
          <p className="text-[10px] text-sage-muted mb-0.5">Aperçu :</p>
          <div
            className="text-sm text-cream"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      )}
      {/* Compteur de caractères */}
      <p className="text-[10px] text-sage-muted text-right pr-0.5">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}
