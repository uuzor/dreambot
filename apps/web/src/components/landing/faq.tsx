import { Section, SectionHead } from "@/components/ui/section";

const FAQS = [
  {
    q: "Can DreamPilot move my funds?",
    a: "No. The bot key can place, cancel and reduce orders. There is no withdrawal or transfer path in the codebase.",
  },
  {
    q: "What happens if the worker stops?",
    a: "Open positions stay open, but your TP/SL levels are not being enforced — a linked bot key cannot arm exchange-side orders. Restart it, or close manually in DreamDEX.",
  },
  {
    q: "Does an agent trade without asking?",
    a: "Yes, inside limits you set, and only once you deploy it. New agents start paused. Pause or flatten at any time.",
  },
  {
    q: "Which network?",
    a: "Somnia Hideki testnet, chain id 50383. Mainnet is refused.",
  },
  {
    q: "Do I need Postgres or Redis?",
    a: "No. Without them it runs on an in-memory store and an in-process scheduler. With them, state and the queue survive restarts.",
  },
];

export function Faq() {
  return (
    <Section id="faq" className="border-t border-line">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,300px)_1fr]">
        <SectionHead index="04" eyebrow="FAQ" title="Questions" />

        <div className="divide-y divide-line border-y border-line">
          {FAQS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 transition-colors hover:text-chalk">
                <span className="text-[14.5px] font-medium text-chalk">{f.q}</span>
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-2 text-dim transition-transform duration-300 group-open:rotate-45">
                  <span className="text-[13px] leading-none">+</span>
                </span>
              </summary>
              <p className="max-w-2xl pb-6 text-[13.5px] leading-relaxed text-mute">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
