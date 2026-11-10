// @dreampilot/telegram - the multi-user Telegram interface.

export { loadConfig, makeCipher, Cipher, type BotConfig } from "./config.js";
export type { AppContext } from "./app.js";
export { createBot, COMMANDS } from "./bot.js";
export { generateBotKey, addressOf, type GeneratedBotKey } from "./keys.js";
export {
  ensureUser,
  loadAccount,
  requireTos,
  requireLinked,
  requireTosAndLinked,
  type AppCtx,
  type SessionState,
} from "./middleware.js";
export {
  startCmd,
  helpCmd,
  tosCmd,
  onTosCallback,
  connectCmd,
  connectWithAddressCmd,
  agentsCmd,
  riskCmd,
  applyRiskLimits,
  deployCmd,
  positionsCmd,
  pauseCmd,
  resumeCmd,
  closeAllCmd,
  pnlCmd,
  statusCmd,
  journalCmd,
  journalPathFor,
  fundCmd,
  fundBuildCmd,
  withdrawBuildCmd,
  notifyCmd,
  walletDeepLink,
} from "./commands.js";
export * from "./format.js";
export {
  decideNotice,
  formatNotice,
  DEFAULT_NOTIFY,
  REFUSAL_WINDOW_MS,
  type NotifyPrefs,
  type NotifyState,
  type NoticeDecision,
} from "./notify.js";
