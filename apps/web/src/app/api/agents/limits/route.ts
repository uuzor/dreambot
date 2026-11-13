import { NextResponse } from "next/server";
import { setAgentLimits } from "@dreampilot/ops";
import { opsDeps } from "@/lib/data";
import { fail, requireSession } from "@/lib/api";

/**
 * Update one agent's risk limits.
 *
 * The numbers are validated by the same schema the risk engine uses, so a limit
 * set here is exactly as enforceable as one set with `/risk`.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("Malformed request.");
  }

  const agentId = Number(body.agentId);
  if (!Number.isFinite(agentId)) return fail("A numeric agentId is required.");

  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  const limits = {
    maxLeverage: num(body.maxLeverage),
    marginPerTrade: num(body.marginPerTrade),
    maxTotalMargin: num(body.maxTotalMargin),
    maxOpenPositions: num(body.maxOpenPositions),
    maxDailyLoss: num(body.maxDailyLoss),
  };
  if (Object.values(limits).some((v) => !Number.isFinite(v))) {
    return fail("All five limit values are required and must be numbers.");
  }

  try {
    const deps = await opsDeps();
    const result = await setAgentLimits(deps, auth.id, agentId, limits);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return fail(`Could not update limits: ${(err as Error).message}`, 500);
  }
}
