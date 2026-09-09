// Size V8's old space from the container's own memory ceiling.
//
// Node is not told what the platform will kill it for. Left to itself V8 sizes
// the old-space maximum from the machine it thinks it is on — which in a
// container is usually the host — so it has no reason to run a major collection
// until it is far past whatever the deployment is actually allowed. The heap
// climbs, the platform kills the container, and the restart reads on a memory
// panel as a leak whether or not anything is retained.
//
// Giving V8 the real ceiling makes it collect under pressure instead. It does
// not fix retention — a genuine leak still exhausts a bounded heap, it just does
// so as an out-of-memory crash with a stack instead of a silent SIGKILL, which
// is the more diagnosable failure of the two.
//
// Reading is deliberately conservative: anything that is not an unambiguous byte
// count reports "unknown", and an unknown limit sets no flag at all. A wrong
// ceiling is worse than none — too low and the process OOMs under normal load.

/** cgroup v2 publishes the memory ceiling here; `max` means uncapped. */
const CGROUP_V2_MAX = "/sys/fs/cgroup/memory.max";

/** cgroup v1's equivalent, still what some hosts mount. */
const CGROUP_V1_MAX = "/sys/fs/cgroup/memory/memory.limit_in_bytes";

/**
 * cgroup v1 has no word for "uncapped": it publishes a near-`INT64_MAX` byte
 * count instead. Anything at or above this is that sentinel, not a ceiling.
 */
const UNLIMITED_SENTINEL_BYTES = 2 ** 62;

/**
 * Share of the container the JS heap may claim.
 *
 * The rest is not slack: the Prisma query engine, TLS buffers, `Buffer`s, loaded
 * code, and the stacks all live outside old space and are all charged to the
 * same container limit. Sizing old space at the full limit would just move the
 * kill to the moment the heap is legitimately full.
 */
export const OLD_SPACE_FRACTION = 0.75;

/**
 * Smallest container worth sizing. Below this the headroom fraction leaves a
 * heap too small to run in, and V8's own default is the better answer.
 */
export const MIN_CONTAINER_LIMIT_BYTES = 512 * 1024 * 1024;

/** Reads a cgroup file, or returns null when it does not exist / cannot be read. */
export type LimitFileReader = (path: string) => string | null;

/**
 * A cgroup limit file's contents as a byte count, or null when it does not name
 * one — absent, `max`, the v1 unlimited sentinel, or anything unparseable.
 */
export function parseCgroupLimit(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const bytes = Number(trimmed);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return null;
  if (bytes >= UNLIMITED_SENTINEL_BYTES) return null;
  return bytes;
}

/**
 * The container's memory ceiling in bytes, or null when there is none to read.
 * v2 is consulted first because a host mounting both publishes the live limit
 * there.
 */
export function containerMemoryLimitBytes(readLimitFile: LimitFileReader): number | null {
  return (
    parseCgroupLimit(readLimitFile(CGROUP_V2_MAX)) ??
    parseCgroupLimit(readLimitFile(CGROUP_V1_MAX))
  );
}

/**
 * Old-space maximum in MiB for a container of `limitBytes`, or null when the
 * limit is unknown or too small to be worth carving up.
 */
export function resolveOldSpaceMb(limitBytes: number | null): number | null {
  if (limitBytes === null) return null;
  if (limitBytes < MIN_CONTAINER_LIMIT_BYTES) return null;
  return Math.floor((limitBytes / (1024 * 1024)) * OLD_SPACE_FRACTION);
}

/**
 * The `--max-old-space-size` flag this container warrants, or null when none
 * should be added.
 *
 * An operator who already set the flag in `NODE_OPTIONS` wins outright: a
 * deployment that pins its own heap ceiling is stating a requirement, and a
 * second flag appended after it would silently decide which one V8 honours.
 */
export function oldSpaceFlag(
  env: Readonly<Record<string, string | undefined>>,
  limitBytes: number | null,
): string | null {
  if (env.NODE_OPTIONS?.includes("--max-old-space-size")) return null;
  const oldSpaceMb = resolveOldSpaceMb(limitBytes);
  return oldSpaceMb === null ? null : `--max-old-space-size=${oldSpaceMb}`;
}
