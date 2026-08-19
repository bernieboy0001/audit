"use client";

export default function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="AUDIT logo: a shield carrying a heartbeat line"
      style={{ display: "block" }}
    >
      <path
        d="M32 4 L56 13 v17 c0 16-12 26-24 30 C20 56 8 46 8 30 V13 Z"
        fill="#0e1219"
        stroke="#5aa7ff"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <polyline
        points="15,37 27,37 32,26 38,43 44,32 48,32"
        fill="none"
        stroke="#37d399"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="48" cy="20" r="3" fill="#ffb454" />
    </svg>
  );
}