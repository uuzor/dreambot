import { Section, SectionHead } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";

/** The two lists are the product's actual guarantee, so they are shown as a
 *  table rather than described. */
const GUARANTEES = [
  {
    k: "Can do",
    tone: "long" as const,
    items: ["Place orders", "Cancel orders", "Reduce positions", "Read balances and markets"],
  },
  {
    k: "Cannot do",
    tone: "short" as const,
    items: ["Withdraw funds", "Transfer out", "Change ownership", "Touch another account"],
  },
];

const POINTS = [
  ["Limits the model cannot skip", "Leverage, margin, exposure and daily loss are clamped before anything is sent."],
  ["Paper first", "Agents run against live prices without reaching the venue until you arm them."],
  ["Exits watched", "A linked key cannot arm exchange-side TP/SL, so the worker watches marks and closes for you."],
  ["Runs with what you have", "Postgres and Redis when you have them; in-memory when you do not."],
] as const;

export function Benefits() {
  return (
    <Section id="safety" className="border-t border-line">
      <SectionHead
        index="03"
        eyebrow="Safety"
        title={
          <>
            One key that trades.
            <br />
            <span className="text-mute">Zero keys that withdraw.</span>
          </>
        }
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {GUARANTEES.map((g) => (
          <div key={g.k} className="panel bevel p-6">
            <Badge tone={g.tone}>{g.k}</Badge>
            <ul className="mt-5 space-y-3">
              {g.items.map((it) => (
                <li key={it} className="flex items-center gap-3 text-[13.5px] text-mute">
                  <span
                    className={
                      g.tone === "long"
                        ? "h-1 w-1 shrink-0 rounded-full bg-long"
                        : "h-1 w-1 shrink-0 rounded-full bg-short"
                    }
                  />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-px overflow-hidden rounded-[28px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {POINTS.map(([k, v]) => (
          <div key={k} className="bg-surface p-5">
            <h3 className="text-[13.5px] font-semibold text-chalk">{k}</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Badge tone="warn">Testnet only</Badge>
        <p className="text-[12.5px] text-dim">Somnia Hideki, chain 50383. Mainnet is refused.</p>
      </div>
    </Section>
  );
}
