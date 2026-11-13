"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  FileCode2,
  LayoutDashboard,
  LineChart,
  Settings,
  ShieldHalf,
} from "lucide-react";
import { cn } from "@/lib/format";
import { Wordmark } from "@/components/landing/wordmark";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/positions", label: "Positions", icon: LineChart },
  { href: "/dashboard/journal", label: "Journal", icon: FileCode2 },
  { href: "/dashboard/risk", label: "Risk", icon: ShieldHalf },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-line lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Link href="/">
          <Wordmark />
        </Link>
      </div>

      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13.5px] transition-colors",
                    active
                      ? "bg-surface-2 font-medium text-chalk"
                      : "text-mute hover:bg-surface hover:text-chalk",
                  )}
                >
                  <item.icon
                    size={16}
                    className={active ? "text-accent" : "text-dim"}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <div className="flex items-center gap-2">
            <Activity size={13} className="text-accent" />
            <span className="font-mono text-[10.5px] tracking-wide text-mute">
              hideki · 50383
            </span>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-dim">
            Testnet only. Mainnet is refused by the client.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur-xl lg:hidden">
      <ul className="flex items-stretch justify-around px-2 py-1.5">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] transition-colors",
                  active ? "text-chalk" : "text-dim",
                )}
              >
                <item.icon size={17} className={active ? "text-accent" : undefined} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
