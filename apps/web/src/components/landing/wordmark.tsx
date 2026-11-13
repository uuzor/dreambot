import { cn } from "@/lib/format";

/** The mark: a bracket around a rising tick, which reads as both "agent" and
 *  "price". Drawn rather than imported so it inherits currentColor. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      <rect x="1" y="1" width="22" height="22" rx="7" stroke="currentColor" strokeOpacity="0.25" />
      <path
        d="M6.5 15.5 10 11l3 3 4.5-6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.5" cy="8" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Mark className="text-accent" />
      <span className="display text-[17px] tracking-[-0.03em] text-chalk">
        DreamPilot
      </span>
    </span>
  );
}
