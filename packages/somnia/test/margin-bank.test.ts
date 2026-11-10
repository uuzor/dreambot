// The funding and withdrawal builders, with no RPC: the chain reads are faked so
// the test pins the two things that matter - the calldata, and that an approval
// is only asked for when the existing allowance does not already cover it.

import { decodeFunctionData, parseUnits } from "viem";
import { describe, expect, it } from "vitest";
import { erc20WriteAbi, marginBankWriteAbi } from "@somnia-chain/markets-sdk";
import {
  buildFundingPlan,
  buildWithdrawPlan,
  toRawCollateral,
  type FundingReads,
} from "../src/margin-bank.js";
import type { PerpMarket } from "../src/markets.js";

const BANK = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394" as const;
const COLLATERAL = "0xed7993A74dAe1e6656B704A424DcD8711aAf4F72" as const;
const OWNER = "0x1111111111111111111111111111111111111111" as const;

/** Just enough of a market for the builders, which only read info + chainId. */
function market(): PerpMarket {
  return {
    symbol: "BTC/USDso:USDso",
    display: "BTC-PERP",
    info: { marginBank: BANK, quoteSymbol: "USDso", quoteDecimals: 6 } as PerpMarket["info"],
    market: { chainId: 50383 } as PerpMarket["market"],
  };
}

function reads(allowance: bigint): FundingReads {
  return {
    collateralOf: async () => COLLATERAL,
    decimalsOf: async () => 6,
    allowanceOf: async () => allowance,
  };
}

/** The exchange is unused by these paths; the builders take it for its type. */
const exchange = {} as never;

describe("toRawCollateral", () => {
  it("scales through a string, so 0.1 does not drift", () => {
    expect(toRawCollateral(0.1, 6)).toBe(parseUnits("0.1", 6));
    expect(toRawCollateral(100, 6)).toBe(100_000_000n);
  });

  it("refuses a non-positive or non-finite amount", () => {
    expect(() => toRawCollateral(0, 6)).toThrow(/positive/);
    expect(() => toRawCollateral(-1, 6)).toThrow(/positive/);
    expect(() => toRawCollateral(Number.NaN, 6)).toThrow(/positive/);
  });

  it("refuses an amount below one raw unit", () => {
    expect(() => toRawCollateral(0.0000001, 6)).toThrow(/smaller than one raw unit/);
  });
});

describe("buildFundingPlan", () => {
  it("asks for an approval when the allowance is short, and encodes a deposit", async () => {
    const plan = await buildFundingPlan(exchange, market(), OWNER, 100, reads(0n));
    expect(plan.approval).toBeDefined();
    expect(plan.amountRaw).toBe(100_000_000n);

    const approve = decodeFunctionData({ abi: erc20WriteAbi, data: plan.approval!.data });
    expect(approve.functionName).toBe("approve");
    expect(approve.args).toEqual([BANK, (1n << 256n) - 1n]);

    const deposit = decodeFunctionData({ abi: marginBankWriteAbi, data: plan.deposit.data });
    expect(deposit.functionName).toBe("deposit");
    expect(deposit.args).toEqual([100_000_000n]);
    expect(plan.deposit.to).toBe(BANK);
    expect(plan.deposit.chainId).toBe(50383);
  });

  it("omits the approval when the existing allowance already covers the amount", async () => {
    const plan = await buildFundingPlan(exchange, market(), OWNER, 100, reads(100_000_000n));
    expect(plan.approval).toBeUndefined();
    expect(plan.deposit.to).toBe(BANK);
  });

  it("carries no signer: the call is data for the owner to sign", async () => {
    const plan = await buildFundingPlan(exchange, market(), OWNER, 5, reads(0n));
    expect(plan.deposit.value).toBe(0n);
    // An UnsignedCall is only ever {chainId, to, data, value, description, functionName}.
    expect(Object.keys(plan.deposit).sort()).toEqual(
      ["chainId", "data", "description", "functionName", "to", "value"].sort(),
    );
  });
});

describe("buildWithdrawPlan", () => {
  it("encodes a single withdraw call", async () => {
    const plan = await buildWithdrawPlan(exchange, market(), 25, reads(0n));
    const call = decodeFunctionData({ abi: marginBankWriteAbi, data: plan.withdraw.data });
    expect(call.functionName).toBe("withdraw");
    expect(call.args).toEqual([25_000_000n]);
    expect(plan.withdraw.to).toBe(BANK);
  });
});
