// Smoke test for the contributor entry screen. The repo has no React Testing
// Library / jsdom, so we render to static markup with react-dom/server (no extra
// deps, no JSX — vitest's include is *.test.ts).
//
// #26 made the entry wallet-first: Freighter sign-in is primary and email is a
// secondary path for accounts that already exist.
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", props),
}));

import LoginScreen from "@/components/LoginScreen";
import AccountAuthScreen from "@/components/AccountAuthScreen";

function render(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node);
}

describe("LoginScreen — wallet-first entry (#26)", () => {
  const props = { onWalletSignedIn: () => {}, onEmailAuth: () => {}, error: null };

  it("makes Freighter sign-in the primary call to action", () => {
    const html = render(createElement(LoginScreen, props));
    expect(html).toContain("Connect Freighter");
    expect(html.indexOf("Connect Freighter")).toBeLessThan(html.indexOf("Sign in with email"));
  });

  it("does not require email or password to start", () => {
    const html = render(createElement(LoginScreen, props));
    expect(html).toContain("no email or password needed");
    expect(html).not.toContain("Create account");
    expect(html).not.toContain('type="password"');
  });

  it("keeps email sign-in as a secondary path for existing accounts", () => {
    const html = render(createElement(LoginScreen, props));
    expect(html).toContain("Signed up with email before?");
    expect(html).toContain("Sign in with email");
  });

  it("offers no MiniPay or EVM wallet-login path", () => {
    const html = render(createElement(LoginScreen, props)).toLowerCase();
    expect(html).not.toContain("minipay");
    expect(html).not.toContain("metamask");
    expect(html).not.toContain("have a wallet?");
  });

  it("explains that the wallet address is the account and signing moves no funds", () => {
    const html = render(createElement(LoginScreen, props));
    // The explicit {" "} keeps the space after the bold span.
    expect(html).toContain("wallet address</span> is your account");
    expect(html).toContain("never moves funds");
  });

  it("surfaces the connect error when present", () => {
    const html = render(createElement(LoginScreen, { ...props, error: "Connection failed" }));
    expect(html).toContain("Connection failed");
  });
});

describe("AccountAuthScreen — initial mode (P5a)", () => {
  const props = { onBack: () => {}, onLoggedIn: () => {} };

  it("opens in register mode when entering account-first", () => {
    const html = render(createElement(AccountAuthScreen, { ...props, initialMode: "register" }));
    expect(html).toContain("Create your account");
    expect(html).toContain("no wallet needed to start");
  });

  it("opens in login mode by default", () => {
    const html = render(createElement(AccountAuthScreen, props));
    expect(html).toContain("Welcome back");
  });
});
