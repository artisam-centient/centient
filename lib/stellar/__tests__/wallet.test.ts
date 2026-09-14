import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair, hash } from "@stellar/stellar-sdk";

process.env.STELLAR_USDC_ISSUER = Keypair.random().publicKey();

const { mockIsConnected, mockSignTransaction, mockRequestAccess, mockSignMessage } =
  vi.hoisted(() => ({
    mockIsConnected: vi.fn(),
    mockSignTransaction: vi.fn(),
    mockRequestAccess: vi.fn(),
    mockSignMessage: vi.fn(),
  }));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: mockIsConnected,
  signTransaction: mockSignTransaction,
  requestAccess: mockRequestAccess,
  signMessage: mockSignMessage,
}));

import {
  freighterSignatureToBase64,
  connect,
  signOwnership,
  signTransaction,
  FREIGHTER_REQUIRED_MESSAGE,
} from "@/lib/stellar/wallet";
import { verify } from "@/lib/stellar/signature";

const kp = Keypair.fromSecret(
  "SDBTJCPJ27TY3BNTANZ3G52FBGCQE76QRP7E2WZQRZLG7GJJBULSQ75E",
);
const MESSAGE = "Link withdrawal address — nonce 12345";

const ADDR = Keypair.random().publicKey();

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConnected.mockResolvedValue({ isConnected: true });
});

function sep53Sign(message: string): Buffer {
  const prefix = Buffer.from("Stellar Signed Message:\n", "utf8");
  return kp.sign(hash(Buffer.concat([prefix, Buffer.from(message, "utf8")])));
}

describe("freighterSignatureToBase64", () => {
  it("passes through a V4 base64 string unchanged (canonicalized)", () => {
    const sig = sep53Sign(MESSAGE);
    const b64 = sig.toString("base64");
    expect(freighterSignatureToBase64(b64)).toBe(b64);
  });

  it("encodes a V3 Buffer/Uint8Array to base64", () => {
    const sig = sep53Sign(MESSAGE);
    expect(freighterSignatureToBase64(sig)).toBe(sig.toString("base64"));
    expect(freighterSignatureToBase64(new Uint8Array(sig))).toBe(
      sig.toString("base64"),
    );
  });

  it("throws on a null signedMessage (signing was rejected)", () => {
    expect(() => freighterSignatureToBase64(null)).toThrow();
  });
});

describe("interop with server verify (SEP-53)", () => {
  it("a Freighter V4 base64 signature verifies after normalization", () => {
    const normalized = freighterSignatureToBase64(
      sep53Sign(MESSAGE).toString("base64"),
    );
    expect(verify(kp.publicKey(), MESSAGE, normalized)).toBe(true);
  });

  it("a Freighter V3 Buffer signature verifies after normalization", () => {
    const normalized = freighterSignatureToBase64(sep53Sign(MESSAGE));
    expect(verify(kp.publicKey(), MESSAGE, normalized)).toBe(true);
  });
});

describe("connect", () => {
  it("returns the Freighter address when access is granted", async () => {
    mockRequestAccess.mockResolvedValue({ address: ADDR });
    await expect(connect()).resolves.toEqual({ address: ADDR, wallet: "freighter" });
  });

  it("throws install guidance when Freighter is unavailable — there is no fallback wallet", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });
    await expect(connect()).rejects.toThrow(FREIGHTER_REQUIRED_MESSAGE);
    expect(mockRequestAccess).not.toHaveBeenCalled();
  });
});

describe("signOwnership", () => {
  it("returns a SEP-53 proof that the server verifies", async () => {
    mockSignMessage.mockResolvedValue({
      signedMessage: sep53Sign(MESSAGE).toString("base64"),
      signerAddress: kp.publicKey(),
    });
    const proof = await signOwnership(MESSAGE, kp.publicKey());
    expect(proof).toMatchObject({ scheme: "sep53", wallet: "freighter" });
    expect(verify(kp.publicKey(), MESSAGE, proof.signature)).toBe(true);
  });

  it("throws install guidance when Freighter is unavailable", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });
    await expect(signOwnership(MESSAGE, ADDR)).rejects.toThrow(FREIGHTER_REQUIRED_MESSAGE);
  });
});

describe("signTransaction", () => {
  it("returns the Freighter-signed XDR when the signer matches", async () => {
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "SIGNED_XDR", signerAddress: ADDR });
    await expect(signTransaction("UNSIGNED_XDR", ADDR)).resolves.toBe("SIGNED_XDR");
  });

  it("throws when Freighter signs with the wrong account", async () => {
    const other = Keypair.random().publicKey();
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "X", signerAddress: other });
    await expect(signTransaction("UNSIGNED_XDR", ADDR)).rejects.toThrow(/wrong account/);
  });

  it("throws Freighter's error", async () => {
    mockSignTransaction.mockResolvedValue({ error: { message: "user declined" } });
    await expect(signTransaction("UNSIGNED_XDR", ADDR)).rejects.toThrow(/user declined/);
  });

  it("throws install guidance when Freighter is unavailable", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });
    await expect(signTransaction("UNSIGNED_XDR", ADDR)).rejects.toThrow(FREIGHTER_REQUIRED_MESSAGE);
  });
});
