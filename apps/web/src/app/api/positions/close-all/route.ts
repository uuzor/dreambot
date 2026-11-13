import { NextResponse } from "next/server";
import { closeAll } from "@dreampilot/ops";
import { opsDeps } from "@/lib/data";
import { fail, requireSession } from "@/lib/api";

/**
 * Pause every agent and close every open position for the signed-in user.
 *
 * This sends real orders, so it is gated on a signed session like every other
 * control route. Paper mode, when the operator has it on, still applies.
 */
export async function POST(): Promise<NextResponse> {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;

  try {
    const deps = await opsDeps();
    const result = await closeAll(deps, auth.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return fail(`Could not close positions: ${(err as Error).message}`, 500);
  }
}
