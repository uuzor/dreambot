// Funding and withdrawing perps margin, as UNSIGNED calls.
//
// The MarginBank holds one cross-margin balance per account. Funding it is
// approve(collateral -> bank) then deposit(amount); withdrawing is a single
// call. Both must be signed by the ACCOUNT OWNER, never by the bot key: a linked
// bot key is granted place/cancel/reduce only, so it cannot move collateral.
//
// DreamPilot therefore BUILDS these calls and hands them over rather than
// sending them. That is what keeps the custody story true - there is no code
// path here that could move a user's money, because the bot key cannot sign one.

import {
  erc20WriteAbi,
  marginBankWriteAbi,
  type SomniaMarkets,
  type UnsignedCall,
} from "@somnia-chain/markets-sdk";
import { createPublicClient, encodeFunctionData, http, parseAbi } from "viem";
import { makeChain } from "./config.js";
import type { SomniaContext } from "./exchange.js";
import type { PerpMarket } from "./markets.js";

const ERC20_READ_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const MAX_UINT256 = (1n << 256n) - 1n;

/**
 * The chain reads a plan needs, injectable so the builders can be tested with no
 * RPC and no network.
 */
export interface FundingReads {
  /** The bank's collateral token, from its own system config. */
  collateralOf(marginBank: `0x${string}`): Promise<`0x${string}`>;
  decimalsOf(token: `0x${string}`): Promise<number>;
  allowanceOf(token: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`): Promise<bigint>;
}

/** The real reads, over the configured RPC. */
export function liveReads(ctx: SomniaContext): FundingReads {
  const publicClient = createPublicClient({
    chain: makeChain(ctx.config),
    transport: http(ctx.config.rpcUrl),
  });
  return {
    collateralOf: async (marginBank) => {
      const sys = await ctx.exchange.client.getPerpSystemConfig(marginBank);
      return sys.collateralToken as `0x${string}`;
    },
    decimalsOf: (token) =>
      publicClient.readContract({
        address: token,
        abi: ERC20_READ_ABI,
        functionName: "decimals",
      }) as Promise<number>,
    allowanceOf: (token, owner, spender) =>
      publicClient.readContract({
        address: token,
        abi: ERC20_READ_ABI,
        functionName: "allowance",
        args: [owner, spender],
      }) as Promise<bigint>,
  };
}

/** Collateral in raw units, from a human amount. Throws on a non-finite amount. */
export function toRawCollateral(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`amount must be a positive number, got ${amount}`);
  }
  // Scale through a string so 0.1 does not become 0.09999999999999999.
  const scaled = BigInt(Math.round(amount * 10 ** decimals));
  if (scaled <= 0n) {
    throw new Error(`${amount} is smaller than one raw unit at ${decimals} decimals.`);
  }
  return scaled;
}

export interface FundingPlan {
  marginBank: `0x${string}`;
  collateral: `0x${string}`;
  collateralDecimals: number;
  amountRaw: bigint;
  /**
   * The ERC-20 approval the bank needs, sent BEFORE the deposit. Absent when the
   * existing allowance already covers the amount, so a funded user is not asked
   * to approve twice.
   */
  approval?: UnsignedCall;
  /** The deposit itself. */
  deposit: UnsignedCall;
}

/**
 * Build the approve+deposit pair that funds `owner`'s cross-margin balance.
 *
 * The calls are unsigned and carry no signer. They are to be signed by `owner`.
 */
export async function buildFundingPlan(
  exchange: SomniaMarkets,
  market: PerpMarket,
  owner: `0x${string}`,
  amount: number,
  reads: FundingReads,
): Promise<FundingPlan> {
  const marginBank = market.info.marginBank;
  const collateral = await reads.collateralOf(marginBank);
  const decimals = await reads.decimalsOf(collateral);
  const amountRaw = toRawCollateral(amount, decimals);
  const chainId = market.market.chainId;

  const deposit: UnsignedCall = {
    chainId,
    to: marginBank,
    data: encodeFunctionData({ abi: marginBankWriteAbi, functionName: "deposit", args: [amountRaw] }),
    value: 0n,
    description: `deposit ${amount} collateral into the perps margin account`,
    functionName: "deposit",
  };

  const allowance = await reads.allowanceOf(collateral, owner, marginBank);
  if (allowance >= amountRaw) return { marginBank, collateral, collateralDecimals: decimals, amountRaw, deposit };

  const approval: UnsignedCall = {
    chainId,
    to: collateral,
    data: encodeFunctionData({ abi: erc20WriteAbi, functionName: "approve", args: [marginBank, MAX_UINT256] }),
    value: 0n,
    description: `approve the margin bank to pull ${market.info.quoteSymbol}`,
    functionName: "approve",
  };
  return { marginBank, collateral, collateralDecimals: decimals, amountRaw, approval, deposit };
}

export interface WithdrawPlan {
  marginBank: `0x${string}`;
  collateral: `0x${string}`;
  collateralDecimals: number;
  amountRaw: bigint;
  withdraw: UnsignedCall;
}

/**
 * Build the single call that pulls free collateral back out of the bank. The
 * bank margin-checks the withdrawal on-chain, so an amount above what is
 * withdrawable reverts when the owner sends it.
 */
export async function buildWithdrawPlan(
  exchange: SomniaMarkets,
  market: PerpMarket,
  amount: number,
  reads: FundingReads,
): Promise<WithdrawPlan> {
  const marginBank = market.info.marginBank;
  const collateral = await reads.collateralOf(marginBank);
  const decimals = await reads.decimalsOf(collateral);
  const amountRaw = toRawCollateral(amount, decimals);
  const withdraw: UnsignedCall = {
    chainId: market.market.chainId,
    to: marginBank,
    data: encodeFunctionData({ abi: marginBankWriteAbi, functionName: "withdraw", args: [amountRaw] }),
    value: 0n,
    description: `withdraw ${amount} collateral from the perps margin account`,
    functionName: "withdraw",
  };
  return { marginBank, collateral, collateralDecimals: decimals, amountRaw, withdraw };
}

export { ERC20_READ_ABI };
