import type { Metadata } from "next";
import { Sidebar, MobileNav } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { loadDashboard } from "@/lib/data";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Agents, positions, PnL and the decision journal.",
};

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
        />
        <main className="flex-1 px-4 pt-6 pb-24 sm:px-6 lg:pb-10">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
