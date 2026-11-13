import { cn } from "@/lib/format";
import type { ReactNode } from "react";

/** The section header pattern from the reference: a mono index, a small mono
 *  eyebrow, then a heavy tightly-tracked headline. */
export function SectionHead({
  index,
  eyebrow,
  title,
  lede,
  align = "left",
  className,
}: {
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {(index || eyebrow) && (
        <div className="flex items-center gap-3">
          {index && (
            <span className="eyebrow text-accent tabular-nums">{index}</span>
          )}
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        </div>
      )}
      <h2 className="display max-w-3xl text-[clamp(2rem,5vw,3.5rem)] text-chalk">
        {title}
      </h2>
      {lede && (
        <p
          className={cn(
            "max-w-xl text-[15px] leading-relaxed text-mute",
            align === "center" && "mx-auto",
          )}
        >
          {lede}
        </p>
      )}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("px-5 py-20 sm:px-8 md:py-28", className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}
