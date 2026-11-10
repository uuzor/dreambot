import { defineChain, getAddress, isAddress, type Chain } from "viem";

export type Network = "hideki" | "testnet" | "mainnet";

export interface SomniaConfig {
  network: Network;
  chainId: number;
  rpcUrl: string;
  wsRpcUrl: string;
  indexerUrl: string;
  operatorRegistry: `0x${string}`;
}

/** The OperatorPermissionsRegistry, which arming a stop order needs. */
const OPERATOR_REGISTRY: Record<Network, `0x${string}`> = {
  hideki: "0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a",
  testnet: "0x15C7e8CE38F021c5b45d098AaD788f63090bF20A",
  mainnet: "0x0000000000000000000000000000000000000000",
};

const ENDPOINTS: Record<Network, { rpc: string; ws: string; indexer: string; chainId: number }> = {
  hideki: {
    rpc: "https://api.hideki2.infra.testnet.somnia.network",
    ws: "wss://api.hideki2.infra.testnet.somnia.network/ws",
    indexer: "https://hideki-dev.smk.somnia.host/v1/graphql",
    chainId: 50383,
  },
  testnet: {
    rpc: "https://api.infra.testnet.somnia.network",
    ws: "wss://api.infra.testnet.somnia.network/ws",
    indexer: "https://dev.smk.somnia.host/v1/graphql",
    chainId: 50312,
  },
  mainnet: {
    rpc: "https://api.infra.mainnet.somnia.network",
    ws: "wss://api.infra.mainnet.somnia.network/ws",
    indexer: "https://prd.smk.somnia.host/v1/graphql",
    chainId: 5031,
  },
};

const PERP_NETWORKS: readonly Network[] = ["hideki", "testnet"];

export interface ResolveOptions {
  network?: string;
  rpcUrl?: string;
  wsRpcUrl?: string;
  indexerUrl?: string;
  operatorRegistry?: string;
  /** Override the chain id; mostly for tests. */
  chainId?: number;
}

/**
 * Resolve the perp environment.
 *
 * The perp deployment lives on Hideki (50383). Shannon (50312) has perp pools
 * too, but its addresses differ, so the network is explicit rather than inferred
 * from a spot config. Mainnet is refused outright: there are no perp pools
 * there, and a mainnet run would connect, find no markets and sit there looking
 * healthy.
 */
export function resolveConfig(opts: ResolveOptions = {}): SomniaConfig {
  const raw = (opts.network ?? "hideki").trim().toLowerCase();
  if (raw === "mainnet") {
    throw new Error(
      "NETWORK=mainnet: there are no perp markets on Somnia mainnet, so a perp agent has nothing to trade. " +
        "Use NETWORK=hideki (chain 50383) or NETWORK=testnet (Shannon, chain 50312).",
    );
  }
  if (!PERP_NETWORKS.includes(raw as Network)) {
    throw new Error(`NETWORK="${raw}" is not a perp network. Use NETWORK=hideki or NETWORK=testnet.`);
  }
  const network = raw as Network;
  const ep = ENDPOINTS[network];
  const registry = (opts.operatorRegistry ?? "").trim();
  return {
    network,
    chainId: opts.chainId ?? ep.chainId,
    rpcUrl: opts.rpcUrl?.trim() || ep.rpc,
    wsRpcUrl: opts.wsRpcUrl?.trim() || ep.ws,
    indexerUrl: opts.indexerUrl?.trim() || ep.indexer,
    operatorRegistry: (registry || OPERATOR_REGISTRY[network]) as `0x${string}`,
  };
}

/** The viem chain for this config. */
export function makeChain(cfg: SomniaConfig): Chain {
  const testToken = cfg.chainId !== 5031;
  return defineChain({
    id: cfg.chainId,
    name: `somnia-${cfg.chainId}`,
    nativeCurrency: testToken
      ? { name: "Somnia Test Token", symbol: "STT", decimals: 18 }
      : { name: "Somnia", symbol: "SOMI", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl], webSocket: [cfg.wsRpcUrl] } },
  });
}

/** Parse and checksum an address, with a message that says which field is wrong. */
export function parseAddress(value: string, field: string): `0x${string}` {
  const trimmed = value.trim();
  if (!isAddress(trimmed)) {
    throw new Error(`${field}="${trimmed}" is not an address (0x followed by 40 hex characters).`);
  }
  return getAddress(trimmed);
}
