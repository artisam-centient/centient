import { NextResponse } from "next/server";
import { checkRpcHealth } from "@/lib/stellar/rpc";

export const dynamic = "force-dynamic";

/**
 * Public Stellar RPC health (#244): whether this deployment reaches its RPC
 * endpoint, on the right network, and how far the ledger has got. 503 when it
 * doesn't, so an uptime check can watch it. Never names the RPC URL, which can
 * carry a provider key.
 */
export async function GET() {
  const check = await checkRpcHealth();
  return NextResponse.json(check, {
    status: check.status === "healthy" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
