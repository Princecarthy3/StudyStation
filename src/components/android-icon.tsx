import type { SVGProps } from "react";

/** Simple Android robot mark for download CTAs (not a trademark lockup). */
export function AndroidIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M17.6 9.48l1.84-3.18a.5.5 0 10-.87-.5l-1.86 3.22A7.92 7.92 0 0012 8c-1.58 0-3.04.46-4.27 1.25L5.87 5.8a.5.5 0 10-.87.5l1.84 3.18A7.97 7.97 0 004 15.5V16a1 1 0 001 1h1v3.5a1.5 1.5 0 003 0V17h6v3.5a1.5 1.5 0 003 0V17h1a1 1 0 001-1v-.5c0-2.4-1.05-4.55-2.4-6.02zM8.5 13.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm7 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
    </svg>
  );
}
