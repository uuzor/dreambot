import type { Metadata } from "next";
import { Sidebar, MobileNav } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { ConnectTelegram } from "@/components/shell/connect-telegram";
import { loadDashboard } from "@/lib/data";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Agents, positions, PnL and the decision journal.",
};

// The dashboard reflects live positions and whether the user has started the
// bot, so it must render per request. Without this Next prerenders it at build
// time and the data — and the connect status — freeze at deploy.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await loadDashboard();

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          username={data.user.username}
          address={data.account?.address ?? null}
          linked={Boolean(data.account?.linked)}
          source={data.source}
          telegramUrl={data.telegram.url}
        />
        <main className="flex-1 px-4 pt-6 pb-24 sm:px-6 lg:pb-10">
          <div className="mx-auto w-full max-w-[1400px]">
            <ConnectTelegram telegram={data.telegram} />
          </div>
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
