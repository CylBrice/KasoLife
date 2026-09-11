"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 200);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed right-4 bottom-20 md:hidden z-20",
        "bg-gradient-to-r from-[#C24A63] to-[#1565C0] dark:from-[#14B8A6] dark:to-[#5B95DD]",
        "rounded-full w-12 h-12 flex items-center justify-center",
        "shadow-lg hover:shadow-xl",
        "transition-all duration-300 ease-out",
        "hover:scale-110 active:scale-95",
        "border-2 border-white/20 dark:border-white/10"
      )}
      aria-label="Scroll to top"
      title="Remonter en haut"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-10 h-10"
        fill="white"
      >
        {/* Triangle (pointe vers le haut) */}
        <polygon points="12,1 2,18 22,18" fill="white" />
        {/* Petit cercle au-dessous du triangle */}
        <circle cx="12" cy="21" r="2.5" fill="white" />
      </svg>
    </button>
  );
}
