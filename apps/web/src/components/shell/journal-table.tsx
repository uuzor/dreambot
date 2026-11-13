"use client";

import { useState } from "react";
import { ChevronRight, Link2, ShieldCheck } from "lucide-react";
import type { JournalLine } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/format";

const KIND_TONE: Record<string, string> = {
  tick: "text-dim",
  thought: "text-mute",
  proposal: "text-accent",
  verdict: "text-warn",
  order: "text-long",
};

/** Renders the journal and, importantly, checks the chain. Verification is done
 *  in the browser against the same rule the writer uses: each line's `prev` must
 *  equal the previous line's `hash`. */
export function JournalTable({ lines }: { lines: JournalLine[] }) {
  const [open, setOpen] = useState<number | null>(lines[lines.length - 1]?.seq ?? null);

  const intact = lines.every(
    (l, i) => i === 0 || l.prev === lines[i - 1]!.hash,
  );

  if (lines.length === 0) {
    return (
      <div className="gridlines rounded-[24px] border border-line px-6 py-12 text-center">
        <p className="text-[12.5px] text-dim">
          No journal entries yet. They appear as the agent ticks.
        </p>
      </div>
    );
  }

  return (
    <div className="panel bevel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-mute">
            {lines.length} entries
          </span>
          <Badge tone={intact ? "long" : "short"}>
            <ShieldCheck size={10} />
            {intact ? "chain intact" : "chain broken"}
          </Badge>
        </div>
        <span className="font-mono text-[10.5px] text-dim">
          last hash {lines[lines.length - 1]?.hash.slice(0, 12)}…
        </span>
      </div>

      <ul className="divide-y divide-line">
        {lines.map((l) => {
          const expanded = open === l.seq;
          const linked = l.seq === 1 || l.prev === lines[l.seq - 2]?.hash;
          return (
            <li key={l.seq}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : l.seq)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface-2/50"
              >
                <span className="tnum w-8 shrink-0 font-mono text-[10.5px] text-dim">
                  {l.seq}
                </span>
                <span
                  className={cn(
                    "w-20 shrink-0 font-mono text-[10.5px] tracking-wide uppercase",
                    KIND_TONE[l.kind] ?? "text-mute",
                  )}
                >
                  {l.kind}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-mute">
                  {JSON.stringify(l.data)}
                </span>
                <span
                  className={cn(
                    "hidden shrink-0 items-center gap-1 font-mono text-[10px] sm:flex",
                    linked ? "text-long" : "text-short",
                  )}
                >
                  <Link2 size={10} />
                  {linked ? "linked" : "broken"}
                </span>
                <ChevronRight
                  size={14}
                  className={cn(
                    "shrink-0 text-dim transition-transform",
                    expanded && "rotate-90",
                  )}
                />
              </button>

              {expanded && (
                <div className="border-t border-line bg-ink/60 px-5 py-4">
                  <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-mute">
                    {JSON.stringify(l.data, null, 2)}
                  </pre>
                  <div className="mt-4 grid gap-2 border-t border-line pt-3 font-mono text-[10.5px] sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-dim">prev</span>
                      <span className="truncate text-mute">{l.prev.slice(0, 24)}…</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-dim">hash</span>
                      <span className="truncate text-mute">{l.hash.slice(0, 24)}…</span>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
