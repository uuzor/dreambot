// Bot configuration, read from the environment once.

import { z } from "zod";
import { Cipher } from "@dreampilot/store";

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  /** Comma-separated numeric ids. Empty means the bot is open to everyone. */
  WHITELIST_USER_IDS: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? s
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n))
        : [],
    ),
  NETWORK: z.string().default("hideki"),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  MASTER_ENCRYPTION_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DREAMPILOT_MODEL: z.string().default("claude-sonnet-4-5"),
  /** Master switch: with true, agents journal their intent and send nothing. */
  AGENTS_DRY_RUN: z
    .string()
    .default("true")
    .transform((s) => s !== "false" && s !== "0"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

export type BotConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

/**
 * The cipher for bot keys at rest. Created lazily and only when a key is
 * actually stored, so a read-only deployment does not need the secret.
 */
export function makeCipher(cfg: BotConfig): Cipher {
  if (!cfg.MASTER_ENCRYPTION_KEY) {
    throw new Error(
      "MASTER_ENCRYPTION_KEY is unset, so bot keys cannot be stored. Generate one with: openssl rand -hex 32",
    );
  }
  return new Cipher(cfg.MASTER_ENCRYPTION_KEY);
}

export { Cipher };
