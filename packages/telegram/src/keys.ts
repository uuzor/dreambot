// Per-user bot keys.
//
// Each user gets a fresh EOA. Its private key is encrypted at rest and its
// address is shown in /connect so the user can paste it into the DreamDEX app's
// "Link a bot" screen. The key can place, cancel and reduce orders on the
// account the user links it to. It cannot withdraw or transfer, which is why
// DreamPilot never custodies funds.

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export interface GeneratedBotKey {
  address: `0x${string}`;
  privateKey: `0x${string}`;
}

export function generateBotKey(): GeneratedBotKey {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { address: account.address, privateKey };
}

/** The address a bot key signs from, for display. */
export function addressOf(privateKey: `0x${string}`): `0x${string}` {
  return privateKeyToAccount(privateKey).address;
}
