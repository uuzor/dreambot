// Everything the handlers need, built once at boot.
//
// A handler receives this through grammY's context, so no command reaches for a
// global. That is what lets the tests drive the same handlers with an in-memory
// store and a stub venue.

import type { Cipher, Store } from "@dreampilot/store";
import type { BotConfig } from "./config.js";

export interface AppContext {
  config: BotConfig;
  store: Store;
  cipher: Cipher;
  /** The journal root; one file per agent lives under it. */
  journalRoot: string;
  /** Notify a user's chat that something happened, e.g. a fill or a refusal. */
  notify(telegramId: number, text: string): Promise<void>;
}
