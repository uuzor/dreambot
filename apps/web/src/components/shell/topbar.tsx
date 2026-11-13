"use client";

import Link from "next/link";
import { ArrowUpRight, Bell, Search } from "lucide-react";
import { Badge, LiveDot } from "@/components/ui/badge";
import { shortAddress } from "@/lib/format";
import { Wordmark } from "@/components/landing/wordmark";
import { useState } from "react";

export function Topbar({
  username,
  address,
  linked,
  source,
}: {
  username: string | null;
  address: string | null;
  linked: boolean;
  source: "live" | "demo";
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="lg:hidden">
          <Wordmark />
        </Link>

        <div className="hidden flex-1 items-center gap-2 lg:flex">
          <div className="flex h-9 w-full max-w-sm items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5">
            <Search size={14} className="text-dim" />
            <input
              placeholder="Search markets, agents, positions…"
              className="w-full bg-transparent text-[13px] text-chalk placeholder:text-dim focus:outline-none"
            />
            <kbd className="hidden rounded-md border border-line-2 px-1.5 py-0.5 font-mono text-[10px] text-dim sm:block">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {source === "demo" && (
            <Badge tone="warn" className="hidden sm:inline-flex">
              demo data
            </Badge>
          )}

          {address && (
            <div className="hidden items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2 sm:flex">
              <LiveDot tone={linked ? "long" : "warn"} />
              <span className="font-mono text-[11px] text-mute">
                {shortAddress(address)}
              </span>
            </div>
          )}

          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-line text-mute transition-colors hover:text-chalk"
          >
            <Bell size={15} />
            <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-accent" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface py-1.5 pr-3 pl-1.5 transition-colors hover:border-line-2"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 font-mono text-[10px] text-accent">
                {(username ?? "d").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-[12.5px] text-mute sm:block">
                {username ?? "demo_trader"}
              </span>
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/60">
                <div className="border-b border-line px-4 py-3">
                  <p className="text-[12.5px] font-medium text-chalk">
                    {username ?? "demo_trader"}
                  </p>
                  <p className="font-mono text-[10.5px] text-dim">
                    telegram · connected
                  </p>
                </div>
                <Link
                  href="/dashboard/settings"
                  className="block px-4 py-2.5 text-[12.5px] text-mute transition-colors hover:bg-surface-2 hover:text-chalk"
                >
                  Account settings
                </Link>
                <Link
                  href="/dashboard/risk"
                  className="block px-4 py-2.5 text-[12.5px] text-mute transition-colors hover:bg-surface-2 hover:text-chalk"
                >
                  Risk limits
                </Link>
                <a
                  href="/"
                  className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[12.5px] text-mute transition-colors hover:bg-surface-2 hover:text-chalk"
                >
                  Back to site
                  <ArrowUpRight size={13} />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
