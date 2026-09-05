"use client";

interface CountryFlagProps {
  code?: string;
  size?: number;
  className?: string;
}

export function CountryFlag({ code, size = 20, className = "" }: CountryFlagProps) {
  if (!code) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/24x18/${code.toLowerCase()}.png`}
      alt={code}
      width={size}
      height={Math.round(size * 0.75)}
      className={`inline-block rounded-sm object-cover ${className}`}
    />
  );
}
