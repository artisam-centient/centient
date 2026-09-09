# Reading the web service's memory

The web service is long-lived and runs the payout worker and the reconciler
inside itself (`instrumentation.ts`), so its memory is the memory of the whole
payout rail. When its memory panel climbs, this is how to tell what is actually
happening before changing anything.

## The `[memory]` line

Every web process logs one line at boot and one a minute after that:

```
[memory] rssMb=1431 heapUsedMb=858 heapTotalMb=1049 heapLimitMb=4144 containerLimitMb=2048 externalMb=38 arrayBuffersMb=8 uptimeSec=3600
```

Interval comes from `MEMORY_REPORT_INTERVAL_MS` (default 60000; `0` disables).

## What a rising panel can mean

A container memory panel plots one number, and three different things draw the
same rising line. The figures above separate them.

**Retention — a real leak.** `min(heapUsedMb)` over a window is the retention
floor: the low point right after each major collection, which is what the
process is actually holding on to. A floor that is higher today than yesterday,
at comparable `uptimeSec`, is a leak. Nothing else is.

**A heap V8 has no reason to collect.** Compare `heapLimitMb` against
`containerLimitMb`. Node is not told what the platform will kill it for; left
alone V8 sizes old space from the machine it thinks it is on, which in a
container is usually the host. When `heapLimitMb` is the larger of the two, V8
will let the heap grow well past what the deployment is allowed before it runs a
major collection — the panel climbs, the platform SIGKILLs the container, and
the restart reads as a leak. The signature is a rising `heapTotalMb` and rss
over a **flat** `heapUsedMb` floor.

The fix for that one is to give V8 the real ceiling — `NODE_OPTIONS`
`--max-old-space-size` at roughly 75% of `containerLimitMb`, leaving the rest
for the Prisma query engine, TLS buffers, `Buffer`s, and loaded code, which are
all charged to the same container limit and none of which live in old space.
`lib/heap-limit.ts` computes that number and reads the container limit. Do this
only with the logged figures in hand: a ceiling set too low turns a slow climb
into an out-of-memory crash under normal load.

**A redeploy.** `uptimeSec` resets to ~0 on every boot, and the boot line is
logged before anything else starts. A cliff on the panel with a fresh boot line
under it is a deploy, not a crash — and the payout worker, reconciler, and
co-signer restarting together will show as correlated steps across services.

## What the 2026-09-09 panel actually was

Settled against the Railway deployment ledger and metrics rather than inferred:

- **The spikes were deploys.** `web` deploys from `develop` (now `staging`), so
  every merge replaces the container. There were **19 deployments between
  2026-09-08 03:55Z and 2026-09-09 10:53Z** — the dense spike cluster on the
  right of the panel is that, one narrow spike per cutover as the new container
  overlaps the old and `preDeployCommand` runs the Prisma CLI.
- **The cosigner series only exists on the right** because that service was
  first deployed 2026-09-08 05:54Z (#75). It could not have been graphed earlier.
- **The long ramp was one very old process.** The deployment before that storm
  was **2026-07-07 13:34Z** — so the process drifting from 0.9 GB to 1.85 GB had
  been up for roughly **62 days**. It was replaced by a deploy, not killed.
- **Nothing was ever OOM-killed.** No `CRASHED` deployment in the service's
  history; the one `FAILED` (2026-09-08 16:38Z) was a build failure.
- **Headroom is enormous.** `MEMORY_LIMIT_GB` is **24**. The 7-day peak of
  1.85 GB is 7.7% of it.

So the drift is case 2 above — a heap V8 has no reason to collect, on a box with
24 GB and therefore no memory pressure at all — and at that rate it is not a
near-term risk. The bound that would actually bite first is **V8's own** old-space
ceiling (~4 GB by default), not the container's 24 GB; reaching it from 1.85 GB
would take several more months of uninterrupted uptime.

**The thing that would change this verdict:** right-sizing the container down.
At 24 GB the drift is free; at 1 GB the same process would be killed in under a
fortnight. Check `containerLimitMb` in the log line before shrinking it, and size
the heap ceiling at the same time.

## Already ruled out (2026-09-09)

Measured against a production build, a real Postgres and Redis, and a stubbed
Horizon, sampling the heap floor after forced collection. None of these retain:

| Path | Exercised | Result |
| --- | --- | --- |
| Payout worker + reconciler idle passes | 6,000 passes (≈8h of polling) | floor returned to baseline |
| Same, with Sentry enabled | 6,000 passes | floor returned to baseline |
| `runHealthMonitor` (`POST /api/cron/wallet-health`) | 3,000 invocations | +0.6 MB, converging |
| `getWalletHealth` (both loops call it every 5s) | 4,300 calls | flat |
| Mixed HTTP load against `next start` | 14,000 requests | no rss trend |

Also checked: every module-level mutable binding in server code is bounded
(`lib/health-alert.ts`'s two PAGE maps are keyed by a fixed alert vocabulary),
and both payout heartbeat intervals are cleared in a `finally`.

The same workload, sampled **without** forcing collection, sawtooths from
155 MB to 370 MB and back to 158 MB. That is the second case above, and it is
why the floor — not the line — is the thing to read.

## Unrelated but adjacent

`rate_limit_buckets` (`lib/rate-limit.ts`) only deletes expired rows for the key
being checked, so rows for keys never checked again are never reclaimed. That is
unbounded growth in Postgres, not in the web process, and it is not what a web
memory panel is showing.
