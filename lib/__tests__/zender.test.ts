import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseFrom, sendEmail, type OutgoingEmail } from "@/lib/zender";

// #268: Centient's email goes through Zender's POST /emails.

const ADDRESS = "ana.labeler@example.com";
const EMAIL: OutgoingEmail = {
  to: ADDRESS,
  subject: "Confirm your email for Centient notices",
  html: "<p>Confirm</p>",
  text: "Confirm",
  kind: "verification",
  idempotencyKey: "4b6f2c1e-0000-4e2a-9c3f-1d5e6f7a8b9c",
};

function reply(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

const accepted = { data: { batch_id: "bat_1", messages: [{ id: "msg_1", to: ADDRESS, status: "queued" }], suppressed: [] } };

beforeEach(() => {
  vi.stubEnv("ZENDER_API_KEY", "zen_live_test");
  vi.stubEnv("ZENDER_API_URL", "https://zender.test/api/v1/");
  vi.stubEnv("EMAIL_FROM", "Centient <centient@artisam.xyz>");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("posts one inline email with the row id as its Idempotency-Key", async () => {
    const fetchImpl = reply(202, accepted);
    expect(await sendEmail(EMAIL, fetchImpl)).toBe("sent");

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe("https://zender.test/api/v1/emails");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer zen_live_test");
    expect(headers["Idempotency-Key"]).toBe(`centient-${EMAIL.idempotencyKey}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      to: [{ email: ADDRESS }],
      from: { email: "centient@artisam.xyz", name: "Centient" },
      content: { html: "<p>Confirm</p>", text: "Confirm" },
      subject_override: EMAIL.subject,
      metadata: { source_app: "centient", kind: "verification", send_id: EMAIL.idempotencyKey },
      tags: ["verification"],
    });
  });

  it("is refused when Zender says no, logging the error code but never the address", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = reply(422, {
      error: { type: "validation_error", code: "invalid_recipient", message: `to.email ${ADDRESS} is not valid`, request_id: "req_1" },
    });
    expect(await sendEmail(EMAIL, fetchImpl)).toBe("refused");
    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).toContain("422 validation_error/invalid_recipient");
    expect(logged).not.toContain(ADDRESS);
  });

  it("is refused when the recipient is on Zender's suppression list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = reply(202, { data: { batch_id: "bat_1", messages: [], suppressed: [ADDRESS] } });
    expect(await sendEmail(EMAIL, fetchImpl)).toBe("refused");
  });

  it("is refused on a rate limit or a server error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendEmail(EMAIL, reply(429, { error: { type: "rate_limit_error", code: "rate_limited" } }))).toBe("refused");
    expect(await sendEmail(EMAIL, reply(502, { error: { type: "provider_error", code: "provider_error" } }))).toBe("refused");
  });

  it("is unknown when no answer comes back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as unknown as typeof fetch;
    expect(await sendEmail(EMAIL, fetchImpl)).toBe("unknown");
  });

  it("is skipped without calling anything when no key is set", async () => {
    vi.stubEnv("ZENDER_API_KEY", "");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    expect(await sendEmail(EMAIL, fetchImpl)).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses Zender's production URL and Centient's artisam.xyz sender by default", async () => {
    vi.stubEnv("ZENDER_API_URL", "");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchImpl = reply(202, accepted);
    await sendEmail({ ...EMAIL, text: undefined }, fetchImpl);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe("https://zender.artisam.xyz/api/v1/emails");
    const body = JSON.parse(String(init?.body));
    expect(body.from).toEqual({ email: "centient@artisam.xyz", name: "Centient" });
    expect(body.content).toEqual({ html: "<p>Confirm</p>" });
  });
});

describe("parseFrom", () => {
  it("reads a display name and address, or a bare address", () => {
    expect(parseFrom("Centient <centient@artisam.xyz>")).toEqual({ email: "centient@artisam.xyz", name: "Centient" });
    expect(parseFrom('"Centient Team" <team@artisam.xyz>')).toEqual({ email: "team@artisam.xyz", name: "Centient Team" });
    expect(parseFrom("centient@artisam.xyz")).toEqual({ email: "centient@artisam.xyz" });
  });
});
