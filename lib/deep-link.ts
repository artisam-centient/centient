// #261: links in contributor email open the right work.
//
// A link is https://centient.work/?open=task:<uuid> or ?open=campaign:<uuid>.
// It carries only an id: never a token, an email address or a wallet address,
// so the URL is safe for analytics (#165). The app moves the target into this
// tab's sessionStorage and strips the param (as the booth ?code= link does), so
// it survives wallet sign-in, payout setup and onboarding, then asks /api/task
// for that work once the contributor reaches the home screen. Restoring the
// wallet session itself depends on the wallet and browser, and isn't promised.

export type DeepLinkTarget = { kind: "task" | "campaign"; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = "centient.openTarget";

/** `task:<uuid>` / `campaign:<uuid>` → a target, else null. */
export function parseOpenParam(raw: string | null | undefined): DeepLinkTarget | null {
  if (!raw) return null;
  const match = /^(task|campaign):(.+)$/.exec(raw.trim());
  if (!match || !UUID.test(match[2])) return null;
  return { kind: match[1] as DeepLinkTarget["kind"], id: match[2].toLowerCase() };
}

/** The link to put in an email. */
export function openLink(appUrl: string, target: DeepLinkTarget): string {
  return `${appUrl.replace(/\/+$/, "")}/?open=${target.kind}:${target.id}`;
}

/** Server side: /api/task?taskId=… or ?campaignId=… (validated), else null. */
export function deepLinkTarget(params: URLSearchParams): DeepLinkTarget | null {
  const taskId = params.get("taskId");
  if (taskId) return UUID.test(taskId) ? { kind: "task", id: taskId.toLowerCase() } : null;
  const campaignId = params.get("campaignId");
  if (campaignId) return UUID.test(campaignId) ? { kind: "campaign", id: campaignId.toLowerCase() } : null;
  return null;
}

/** The /api/task query for a target. */
export function taskQuery(target: DeepLinkTarget | null): string {
  if (!target) return "";
  return target.kind === "task" ? `?taskId=${target.id}` : `?campaignId=${target.id}`;
}

/** Move `?open=` from the address bar into this tab's storage. Browser only. */
export function captureOpenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("open");
    if (raw === null) return;
    const target = parseOpenParam(raw);
    if (target) sessionStorage.setItem(KEY, `${target.kind}:${target.id}`);
    url.searchParams.delete("open");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Storage blocked or no history API: the contributor lands on home as usual.
  }
}

export function pendingOpenTarget(): DeepLinkTarget | null {
  try {
    return parseOpenParam(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function clearOpenTarget(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
