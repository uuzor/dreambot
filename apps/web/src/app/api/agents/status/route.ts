import { NextResponse } from "next/server";
import { setAgentStatus } from "@dreampilot/ops";
import type { AgentStatus } from "@dreampilot/store";
import { opsDeps } from "@/lib/data";
import { fail, requireSession } from "@/lib/api";

const ALLOWED: AgentStatus[] = ["running", "paused", "stopped"];

/** Pause, resume or stop one of the signed-in user's agents. */
export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  let body: { agentId?: number; status?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fail("Malformed request.");
  }

  const agentId = Number(body.agentId);
  const status = body.status as AgentStatus;
  if (!Number.isFinite(agentId)) return fail("A numeric agentId is required.");
  if (!ALLOWED.includes(status)) return fail(`status must be one of: ${ALLOWED.join(", ")}`);

  try {
    const deps = await opsDeps();
    const result = await setAgentStatus(deps, auth.id, agentId, status);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err) {
    return fail(`Could not update the agent: ${(err as Error).message}`, 500);
  }
}
