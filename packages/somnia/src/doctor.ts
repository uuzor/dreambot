// Read-only health check against the configured DreamDEX perps deployment.
//
// This never signs and never needs a key. Run it before deploying to confirm the
// network, the market list and the mark reads all work:
//
//   npm run doctor
//
// It is the fastest way to tell "the venue changed" apart from "my key is wrong".

import { createReadOnly, perpMarkets, liveMark, liveFunding } from "./index.js";

const network = process.env.NETWORK ?? "hideki";

async function main(): Promise<void> {
  console.log(`DreamPilot doctor - network "${network}"`);
  const ctx = createReadOnly({ network });
  console.log(`  chain id   ${ctx.config.chainId}`);
  console.log(`  indexer    ${ctx.config.indexerUrl}`);

  const markets = await perpMarkets(ctx.exchange, true);
  console.log(`  markets    ${markets.length} perp market(s)`);
  if (markets.length === 0) {
    throw new Error("no perp markets returned; the indexer or the addresses may have moved");
  }

  let priced = 0;
  for (const market of markets.slice(0, 8)) {
    const mark = await liveMark(ctx.exchange, market);
    const funding = await liveFunding(ctx.exchange, market);
    if (mark !== undefined) priced++;
    console.log(
      `    ${market.display.padEnd(12)} mark ${(mark ?? 0).toFixed(4).padStart(14)}` +
        `  funding ${(funding.apr * 100).toFixed(2).padStart(8)}% APR`,
    );
  }
  if (priced === 0) throw new Error("no market returned a mark; the oracle feed may be down");
  console.log(`\nOK - ${priced}/${Math.min(8, markets.length)} sampled markets are priced.`);
  // The SDK opens a WebSocket that keeps the loop alive; the read is done.
  process.exit(0);
}

main().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
