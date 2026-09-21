// TC-023: does a client-supplied x-real-ip reach the app, or does the proxy own it?
import { Keypair } from "@stellar/stellar-sdk";
import { call, evidence, sleep } from "./kit";

const log: any[] = [];
async function burst(label: string, header: string | null, perAddr: number, addrs: number) {
  for (let a = 0; a < addrs; a++) {
    const addr = Keypair.random().publicKey();
    for (let i = 0; i < perAddr; i++) {
      const r = await call("POST", "/api/auth/wallet/challenge", {
        json: { address: addr },
        headers: header ? { "x-real-ip": header } : {},
      });
      log.push({ label, n: log.filter((l) => l.label === label).length + 1, addr, xRealIpSent: header, status: r.status, body: r.status === 200 ? { nonce: "<32-hex>" } : r.body, at: r.at });
    }
  }
}

(async () => {
console.log("waiting 65s for any prior window to clear");
await sleep(65_000);
// A: 20 requests claiming IP 198.51.100.10 (5 addresses x 4), then 1 claiming a DIFFERENT IP 198.51.100.20.
await burst("A:claimed-ip-1", "198.51.100.10", 4, 5);
await burst("A:claimed-ip-2", "198.51.100.20", 1, 1);
const a21 = log[log.length - 1];
console.log("A 21st (different claimed IP) ->", a21.status);
evidence("023", "E023-3.1-spoofed-x-real-ip.json", {
  purpose: "If x-real-ip were client-controlled, request 21 (a different claimed IP) would get its own bucket and answer 200.",
  result: a21.status === 429 ? "429 — the client header is ignored; the proxy supplies x-real-ip for every request" : "200 — client header honoured",
  requests: log,
});
})();
