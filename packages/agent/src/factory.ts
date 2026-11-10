// Build the venue an agent trades through.
//
// Two shapes, and the difference is the whole custody story:
//
//   * The caller supplies a linked account and its bot key. The venue is LIVE:
//     it reads the user's DreamDEX account and signs with the bot key, which can
//     place, cancel and reduce but never withdraw.
//   * Otherwise the venue is PAPER: real prices, simulated fills, nothing sent.
//
// Both implement the same `Venue` interface, so the strategy and the runner do
// not know or care which one they were handed.

import { createReadOnly, createTradingContext } from "@dreampilot/somnia";
import { PaperVenue, type PriceSource } from "./paper-venue.js";
import { SomniaVenue } from "./somnia-venue.js";
import type { MarketInfo, Venue } from "./venue.js";

export interface LiveVenueInput {
  account: `0x${string}`;
  botPrivateKey: `0x${string}`;
  network: string;
}

export interface BuildVenueOptions {
  network: string;
  /** Present when the user linked an account. Absent means paper. */
  live?: LiveVenueInput;
  /** Operator master switch. When true, a linked account is paper-traded too. */
  dryRun: boolean;
  /** Starting balance for a paper venue. */
  paperStartingUsd?: number;
}

export interface BuiltVenue {
  venue: Venue;
  paper: boolean;
  /** Why it is paper, for a message the user can act on. */
  note?: string;
}

/** A read-only market feed, used by the paper venue so it still shows real marks. */
function priceSource(network: string): PriceSource {
  const ctx = createReadOnly({ network });
  const reader = new SomniaVenue({ ctx, account: "0x0000000000000000000000000000000000000000", dryRun: true });
  return {
    markets: (markets: string[]): Promise<MarketInfo[]> => reader.markets(markets),
  };
}

export function buildVenue(opts: BuildVenueOptions): BuiltVenue {
  if (opts.live && !opts.dryRun) {
    const ctx = createTradingContext({
      network: opts.live.network,
      owner: opts.live.account,
      botPrivateKey: opts.live.botPrivateKey,
    });
    return {
      venue: new SomniaVenue({ ctx, account: opts.live.account, dryRun: false }),
      paper: false,
    };
  }
  return {
    venue: new PaperVenue(priceSource(opts.network), opts.paperStartingUsd ?? 1000),
    paper: true,
    note: opts.dryRun
      ? "the operator has paper mode on, so agents simulate fills against real prices"
      : "no linked account, so this agent simulates fills against real prices",
  };
}
