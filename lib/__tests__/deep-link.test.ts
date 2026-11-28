import { describe, it, expect } from "vitest";
import { deepLinkTarget, openLink, parseOpenParam, taskQuery } from "@/lib/deep-link";
import { fundedWorkMessage, reminderMessage } from "@/lib/contact-email-send";

// #261: email deep links carry an id only.

const ID = "3f2b8c1e-9a4d-4e6b-8c2a-1d5e7f9a0b3c";

describe("deep links", () => {
  it("parses task and campaign targets, and nothing else", () => {
    expect(parseOpenParam(`task:${ID}`)).toEqual({ kind: "task", id: ID });
    expect(parseOpenParam(`campaign:${ID.toUpperCase()}`)).toEqual({ kind: "campaign", id: ID });
    for (const bad of [null, "", "task:", "task:123", `user:${ID}`, `task:${ID}x`, "GABCDEFWALLET"]) {
      expect(parseOpenParam(bad)).toBeNull();
    }
  });

  it("builds the link and the /api/task query", () => {
    expect(openLink("https://centient.work/", { kind: "task", id: ID })).toBe(`https://centient.work/?open=task:${ID}`);
    expect(taskQuery({ kind: "campaign", id: ID })).toBe(`?campaignId=${ID}`);
    expect(taskQuery(null)).toBe("");
    expect(deepLinkTarget(new URLSearchParams(`taskId=${ID}`))).toEqual({ kind: "task", id: ID });
    expect(deepLinkTarget(new URLSearchParams("taskId=nope"))).toBeNull();
  });

  it("puts the target in notice emails, and no token or address in the link", () => {
    const work = fundedWorkMessage(3, "unsubtok", ID);
    expect(work.text).toContain(`/?open=campaign:${ID}`);
    expect(work.html).toContain(`href="http://localhost:3000/?open=campaign:${ID}"`);

    const reminder = reminderMessage("unsubtok", ID);
    expect(reminder.text).toContain(`/?open=task:${ID}`);
    // The only token in a notice is the unsubscribe one, in its own link.
    const links = [...reminder.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(links.filter((l) => l.includes("?open="))).toEqual([`http://localhost:3000/?open=task:${ID}`]);
    expect(links.find((l) => l.includes("?open="))).not.toContain("unsubtok");
  });
});
