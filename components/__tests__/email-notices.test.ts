// #248: the Email notices card, as static markup like the other component tests.
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmailNoticesCard, type EmailSettings } from "@/components/EmailNotices";

const call = async () => null;

function render(settings: Partial<EmailSettings>): string {
  return renderToStaticMarkup(
    createElement(EmailNoticesCard, {
      settings: {
        address: null,
        pendingAddress: null,
        notifyNewWork: false,
        notifyReminders: false,
        promptDismissed: false,
        ...settings,
      },
      call,
    }),
  );
}

describe("EmailNoticesCard", () => {
  it("offers an optional address field, with both notices off", () => {
    const html = render({});
    expect(html).toContain('type="email"');
    expect(html).toContain("Send link");
    expect(html).toContain("Optional.");
    expect(html.match(/role="switch" aria-checked="false"/g)).toHaveLength(2);
  });

  it("shows a pending address waiting on its link", () => {
    const html = render({ pendingAddress: "ana@example.com" });
    expect(html).toContain("ana@example.com");
    expect(html).toContain("within 24 hours");
    expect(html).toContain("Resend link");
    expect(html).not.toContain('type="email"');
  });

  it("shows where notices go once verified, and each saved preference", () => {
    const html = render({ address: "ana@example.com", notifyNewWork: true });
    expect(html).toContain("Notices go to");
    expect(html).toContain("Change email");
    expect(html).toContain("Remove email");
    expect(html.match(/role="switch" aria-checked="true"/g)).toHaveLength(1);
  });

  it("says notices wait for confirmation when one is on before verifying", () => {
    expect(render({ pendingAddress: "ana@example.com", notifyReminders: true })).toContain(
      "Notices start once your email is confirmed.",
    );
  });
});
