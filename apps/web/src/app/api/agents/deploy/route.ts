import { NextResponse } from "next/server";
import { deployAgent } from "@dreampilot/ops";
import { opsDeps } from "@/lib/data";
import { fail, requireSession } from "@/lib/api";

/**
 * Create and launch an agent from the dashboard.
 *
 * The web app is now a control surface, so this route performs the same
 * operation `/deploy` does in Telegram, through the same code. It is gated on a
 * signed session: the Telegram account behind the cookie owns the agent, and no
 * amount of query-string fiddling can deploy into someone else's account.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: { strategy?: string; market?: string; thesis?: string; limits?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fail("Malformed request.");
  }

  const strategy = typeof body.strategy === "string" ? body.strategy : "";
  const market = typeof body.market === "string" ? body.market : "";
  if (!strategy || !market) return fail("A strategy and a market are required.");

  const limits = body.limits ?? {};
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

  try {
    const deps = await opsDeps();
    const result = await deployAgent(deps, {
      telegramId: auth.id,
      strategy,
      market,
      thesis: typeof body.thesis === "string" && body.thesis.trim() ? body.thesis.trim() : null,
      limits: {
        maxLeverage: num(limits.maxLeverage, 2),
        marginPerTrade: num(limits.marginPerTrade, 25),
        maxTotalMargin: num(limits.maxTotalMargin, 100),
        maxOpenPositions: num(limits.maxOpenPositions, 1),
        maxDailyLoss: num(limits.maxDailyLoss, 25),
      },
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return fail(`Could not deploy: ${(err as Error).message}`, 500);
  }
}
