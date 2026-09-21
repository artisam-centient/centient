import { describe, expect, it } from "vitest";
import config from "../../next.config";

async function connectSrc(): Promise<string[]> {
  const rules = await config.headers!();
  const csp = rules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy")!.value;
  const directive = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src "))!;
  return directive.split(/\s+/).slice(1);
}

describe("CSP connect-src", () => {
  it("lets the WalletConnect relay and registry through, so Freighter's phone pairing can start", async () => {
    const hosts = await connectSrc();
    expect(hosts).toEqual(
      expect.arrayContaining([
        "wss://relay.walletconnect.org",
        "https://explorer-api.walletconnect.com",
      ]),
    );
  });
});
