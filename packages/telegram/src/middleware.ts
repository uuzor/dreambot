// grammY middleware: identify the user, enforce the allow-list, and gate the
// commands that need a linked account or an accepted disclosure.

import type { Context, MiddlewareFn } from "grammy";
import type { AppContext } from "./app.js";
import type { Account, User } from "@dreampilot/store";

export interface SessionState {
  user?: User;
  account?: Account;
}

export type Ctx = Context & { app: AppContext; state: SessionState };

/** The bot context with its dependencies attached. */
export type AppCtx = Context & { app: AppContext; state: SessionState };

/**
 * Resolve the Telegram user to a row, enforcing the allow-list first so a
 * blocked user never reaches a handler or creates a row.
 */
export const ensureUser: MiddlewareFn<Context> = async (ctx, next) => {
  const c = ctx as AppCtx;
  if (!ctx.from) return;
  const { app } = c;

  if (app.config.WHITELIST_USER_IDS.length > 0 && !app.config.WHITELIST_USER_IDS.includes(ctx.from.id)) {
    await ctx.reply("This bot is currently private. Contact the operator for access.");
    return;
  }

  c.state.user = await app.store.upsertUser(ctx.from.id, ctx.from.username ?? null);
  return next();
};

/** Load the linked account, if any, into state. */
export const loadAccount: MiddlewareFn<Context> = async (ctx, next) => {
  const c = ctx as AppCtx;
  if (!c.state.user) return next();
  c.state.account = await c.app.store.getAccount(c.state.user.telegram_id);
  return next();
};

export const requireTos: MiddlewareFn<Context> = async (ctx, next) => {
  const c = ctx as AppCtx;
  if (!c.state.user?.tos_accepted_at) {
    await ctx.reply(
      "Please read and accept the risk disclosure first. Send /tos, then tap Accept.",
    );
    return;
  }
  return next();
};

export const requireLinked: MiddlewareFn<Context> = async (ctx, next) => {
  const c = ctx as AppCtx;
  if (!c.state.account) {
    await ctx.reply(
      "You have not connected a trading account yet. Send /connect to create your bot key and link it in the DreamDEX app.",
    );
    return;
  }
  return next();
};

export const requireTosAndLinked: MiddlewareFn<Context> = async (ctx, next) => {
  const c = ctx as AppCtx;
  if (!c.state.user?.tos_accepted_at) {
    await ctx.reply("Please read and accept the risk disclosure first. Send /tos, then tap Accept.");
    return;
  }
  if (!c.state.account) {
    await ctx.reply("Connect a trading account first. Send /connect.");
    return;
  }
  return next();
};
