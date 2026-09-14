// Wallet sign-in challenges (#25): prove control of a Stellar address, without
// an email/password session, by signing a one-time server challenge.
//
// The signed format and its bindings were settled on the real Freighter
// extension by #24 (docs/superpowers/specs/2026-09-14-freighter-wallet-signing-design.md).
// This module is that proof made durable: the harness kept challenges in
// process memory, but `web` can run more than one process and restarts lose
// memory, so production keeps them in `wallet_nonces`, tagged with
// PROOF_ACTION so the payout-link flow's rows are never touched.
import { randomBytes } from "crypto";
import prisma from "../prisma";
import { Prisma, type PrismaClient } from "@/app/generated/prisma/client";
import { networkPassphrase } from "./config";
import { isValidStellarAddress, verify } from "./signature";
import { CHALLENGE_TTL_MS, PROOF_ACTION, buildChallengeMessage } from "./challenge-message";

export interface IssuedSignInChallenge {
  nonce: string;
  message: string;
  expiresAt: Date;
}

/**
 * Issue a sign-in challenge for `address`.
 *
 * Replaces any earlier sign-in challenge for the same address, so each address
 * has at most one outstanding, and prunes every expired row while it is here,
 * so the table stays proportional to live challenges. Payout-link challenges
 * that have not expired are left alone.
 */
export async function issueSignInChallenge(
  address: string,
  now: Date = new Date(),
): Promise<IssuedSignInChallenge> {
  // Callers validate first; this is the backstop. Never normalize: StrKey is
  // case-sensitive, and a lowercased key is a different, invalid key.
  if (!isValidStellarAddress(address)) {
    throw new Error("issueSignInChallenge: address is not a valid Stellar G… key");
  }

  const fields = {
    address,
    networkPassphrase: networkPassphrase(),
    nonce: randomBytes(16).toString("hex"),
    issuedAt: now,
    expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
  };

  await prisma.$transaction([
    prisma.walletNonce.deleteMany({ where: { walletAddress: address, action: PROOF_ACTION } }),
    prisma.walletNonce.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.walletNonce.create({
      data: {
        walletAddress: fields.address,
        action: PROOF_ACTION,
        networkPassphrase: fields.networkPassphrase,
        nonce: fields.nonce,
        issuedAt: fields.issuedAt,
        expiresAt: fields.expiresAt,
      },
    }),
  ]);

  return { nonce: fields.nonce, message: buildChallengeMessage(fields), expiresAt: fields.expiresAt };
}

export type SignInRejection =
  | "challenge_not_found"
  | "challenge_expired"
  | "wrong_address"
  | "wrong_network"
  | "wrong_signer"
  | "bad_signature";

export type SignInProofResult =
  | { ok: true; address: string }
  | { ok: false; reason: SignInRejection };

/**
 * Verify a sign-in proof, consuming its challenge.
 *
 * The first step is a single delete by nonce and action. It is the only thing
 * that grants access: two concurrent attempts with the same nonce race on that
 * delete, and exactly one gets the row. It also runs before every other check,
 * so any attempt — accepted or not — uses the challenge up, and a failed proof
 * cannot be corrected and retried. A replay finds no row.
 *
 * The signed message is rebuilt from the stored row, never from anything the
 * client sent.
 */
export async function consumeSignInChallenge({
  address,
  nonce,
  signature,
  signerAddress,
  now = new Date(),
}: {
  address: string;
  nonce: string;
  signature: string;
  signerAddress?: string;
  now?: Date;
}): Promise<SignInProofResult> {
  let row;
  try {
    row = await prisma.walletNonce.delete({ where: { nonce, action: PROOF_ACTION } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, reason: "challenge_not_found" };
    }
    throw err;
  }

  if (now.getTime() > row.expiresAt.getTime()) return { ok: false, reason: "challenge_expired" };
  if (row.walletAddress !== address) return { ok: false, reason: "wrong_address" };

  const passphrase = networkPassphrase();
  if (row.networkPassphrase !== passphrase) return { ok: false, reason: "wrong_network" };

  if (signerAddress !== undefined && signerAddress !== address) {
    return { ok: false, reason: "wrong_signer" };
  }

  const message = buildChallengeMessage({
    address: row.walletAddress,
    networkPassphrase: passphrase,
    nonce: row.nonce,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
  });
  if (!verify(address, message, signature)) return { ok: false, reason: "bad_signature" };

  return { ok: true, address };
}

/** The slice of Prisma `findOrCreateWalletUser` uses, so the race path is testable. */
export type WalletUserClient = { user: Pick<PrismaClient["user"], "findUnique" | "create"> };

/**
 * Resolve a proven Stellar address to exactly one contributor.
 *
 * The `User` holding the address wins, including an email account that linked
 * it through `/api/me/wallet`. Otherwise a wallet-only `User` is created.
 * `User.walletAddress` is `@unique`, so when two first sign-ins race, one create
 * fails with P2002 and resolves to the row the other created: one address never
 * becomes two identities.
 *
 * Find-then-create rather than `upsert`: Prisma may run an upsert as a native
 * `INSERT … ON CONFLICT`, which cannot report whether it created the row.
 */
export async function findOrCreateWalletUser(
  walletAddress: string,
  client: WalletUserClient = prisma,
): Promise<{ id: string; created: boolean }> {
  const existing = await client.user.findUnique({ where: { walletAddress }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };

  try {
    const user = await client.user.create({ data: { walletAddress }, select: { id: true } });
    return { id: user.id, created: true };
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    const winner = await client.user.findUnique({ where: { walletAddress }, select: { id: true } });
    if (!winner) throw err;
    return { id: winner.id, created: false };
  }
}
