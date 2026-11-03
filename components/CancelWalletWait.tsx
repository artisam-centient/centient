/**
 * The way out while the page waits on the Freighter mobile app — for the
 * pairing or for a signature. Freighter can drop a request without answering,
 * and a wait with no control on it is a dead end until the timeout.
 */
export default function CancelWalletWait({
  onCancel,
  tone = "paper",
}: {
  onCancel: () => void;
  /** "field" is the landing hero's green field, where it reads in white. */
  tone?: "paper" | "field";
}) {
  return (
    <button
      type="button"
      onClick={onCancel}
      className={`font-label text-sm font-semibold underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 ${
        tone === "field"
          ? "text-on-primary focus-visible:ring-surface-container-lowest focus-visible:ring-offset-primary"
          : "text-on-surface-variant focus-visible:ring-primary focus-visible:ring-offset-surface"
      }`}
    >
      Cancel
    </button>
  );
}
