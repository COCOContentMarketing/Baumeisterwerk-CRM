import type { SVGProps } from "react";

// Gleiche Drachen-Silhouette wie in app/icon.svg (Favicon).
// fill="currentColor" laesst die Farbe per CSS (text-* / color) steuern.
export function DragonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      role="img"
      aria-label="Drache"
      {...props}
    >
      <g fill="currentColor" fillRule="evenodd">
        <path d="M28 28 L4 4 L2 18 L10 14 L10 26 L16 20 L18 32 L22 26 Z" />
        <path d="M44 18 L44 4 L48 8 L52 4 L50 14 L54 14 L62 16 L62 18 L54 20 L46 20 Z" />
        <path d="M44 18 C38 18 32 22 28 28 L32 32 C36 28 42 24 46 20 Z" />
        <path d="M28 28 L24 30 L16 36 L14 40 L16 44 L32 44 L32 32 Z" />
        <path d="M14 40 Q8 46 6 54 L2 60 L4 62 L6 60 L8 62 L10 60 L10 54 Q14 48 18 44 Z" />
        <path d="M30 36 L30 48 L26 50 L30 52 L26 54 L30 56 L36 52 L36 36 Z" />
        <path d="M16 40 L16 50 L12 52 L16 54 L12 56 L16 58 L20 54 L20 40 Z" />
      </g>
    </svg>
  );
}
