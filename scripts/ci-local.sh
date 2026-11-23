#!/usr/bin/env bash
# The Month 2 merge gate while GitHub Actions is down (#243).
#
# Runs the steps of .github/workflows/ci.yml (both the `build` and the
# `payments-lane` job) on one exact commit, the way the runner does: a clean
# checkout, the Node version in .node-version, Postgres 15, TZ=UTC. It prints a
# Markdown summary to paste into the PR as its CI evidence.
#
#   scripts/ci-local.sh [<commit-ish>]     default: HEAD
#
# Needs: git, curl, shasum, and Postgres 15 binaries (`brew install
# postgresql@15`, or PG_BIN=/path/to/bin). The pinned Node is downloaded from
# nodejs.org once, checked against its SHASUMS256.txt, and cached.
#
# Env:
#   PG_BIN            Postgres 15 bin directory (default: brew's postgresql@15)
#   CI_LOCAL_PORT     first port to try for Postgres (default 5446)
#   CI_LOCAL_KEEP=1   keep the scratch checkout, database and logs afterwards
#   CI_LOCAL_CACHE    where the pinned Node is cached (default ~/.cache/centient-ci)
#
# Keep this in step with ci.yml: a step added there belongs here too.

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
REF=${1:-HEAD}
SHA=$(git -C "$REPO_ROOT" rev-parse --verify "${REF}^{commit}")
SHORT=${SHA:0:8}
TREE=$(git -C "$REPO_ROOT" rev-parse "${SHA}^{tree}")

WORK=$(mktemp -d "${TMPDIR:-/tmp}/centient-ci-${SHORT}.XXXXXX")
SRC="$WORK/src"
LOGS="$WORK/logs"
PGDATA="$WORK/pg"
mkdir -p "$LOGS"

PG_STARTED=0
cleanup() {
  local status=$?
  if [[ $PG_STARTED == 1 ]]; then
    "$PG_BIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  if [[ ${CI_LOCAL_KEEP:-0} == 1 ]]; then
    echo "Kept $WORK" >&2
  else
    git -C "$REPO_ROOT" worktree remove --force "$SRC" >/dev/null 2>&1 || true
    rm -rf "$WORK"
  fi
  exit $status
}
trap cleanup EXIT

say() { printf '\n==> %s\n' "$*" >&2; }
die() { printf 'ci-local: %s\n' "$*" >&2; exit 1; }

# --- checkout ---------------------------------------------------------------
say "Checking out $SHORT into a clean worktree"
git -C "$REPO_ROOT" worktree add --detach --quiet "$SRC" "$SHA"

# --- Node ---------------------------------------------------------------------
NODE_WANT=$(tr -d '[:space:]' <"$SRC/.node-version")
if [[ "$(node --version 2>/dev/null || true)" != "v$NODE_WANT" ]]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) PLATFORM=darwin-arm64 ;;
    Darwin-x86_64) PLATFORM=darwin-x64 ;;
    Linux-x86_64) PLATFORM=linux-x64 ;;
    Linux-aarch64) PLATFORM=linux-arm64 ;;
    *) die "no Node build known for $(uname -s)-$(uname -m)" ;;
  esac
  CACHE=${CI_LOCAL_CACHE:-$HOME/.cache/centient-ci}
  NODE_DIR="$CACHE/node-v$NODE_WANT-$PLATFORM"
  if [[ ! -x "$NODE_DIR/bin/node" ]]; then
    say "Fetching Node v$NODE_WANT ($PLATFORM) from nodejs.org"
    mkdir -p "$CACHE"
    TARBALL="node-v$NODE_WANT-$PLATFORM.tar.gz"
    BASE="https://nodejs.org/dist/v$NODE_WANT"
    curl -fsSL "$BASE/$TARBALL" -o "$WORK/$TARBALL"
    curl -fsSL "$BASE/SHASUMS256.txt" -o "$WORK/SHASUMS256.txt"
    (cd "$WORK" && grep " $TARBALL\$" SHASUMS256.txt | shasum -a 256 -c -) >&2 \
      || die "checksum mismatch for $TARBALL"
    tar -xzf "$WORK/$TARBALL" -C "$CACHE"
  fi
  export PATH="$NODE_DIR/bin:$PATH"
fi

# --- Postgres 15, UTC -------------------------------------------------------
if [[ -z ${PG_BIN:-} ]]; then
  PG_BIN="$(brew --prefix postgresql@15 2>/dev/null || true)/bin"
fi
[[ -x "$PG_BIN/postgres" ]] || die "Postgres 15 not found; brew install postgresql@15, or set PG_BIN"
PG_VERSION=$("$PG_BIN/postgres" --version | awk '{print $3}')
[[ ${PG_VERSION%%.*} == 15 ]] || die "need Postgres 15, found $PG_VERSION at $PG_BIN"

PORT=${CI_LOCAL_PORT:-5446}
while nc -z localhost "$PORT" 2>/dev/null; do PORT=$((PORT + 1)); done

say "Starting Postgres $PG_VERSION on port $PORT (UTC)"
LC_ALL=en_US.UTF-8 "$PG_BIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 \
  --locale=en_US.UTF-8 >"$LOGS/initdb.log" 2>&1
LC_ALL=en_US.UTF-8 "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$LOGS/postgres.log" -w \
  -o "-p $PORT -c listen_addresses=localhost -c unix_socket_directories='' -c timezone=UTC" \
  start >/dev/null
PG_STARTED=1
for db in centient_test centient_payments; do
  "$PG_BIN/createdb" -h localhost -p "$PORT" -U postgres "$db"
done

# --- the runner's environment -----------------------------------------------
export CI=true TZ=UTC
# Next 16 stops `next build` with an upgrade prompt when it detects a coding
# agent (@vercel/detect-agent reads these variables). The Actions runner sets
# none of them, so a run started from an agent's shell drops them too.
for var in AI_AGENT ANTIGRAVITY_AGENT AUGMENT_AGENT CLAUDECODE CLAUDE_CODE \
  CLAUDE_CODE_IS_COWORK CODEX_CI CODEX_SANDBOX CODEX_THREAD_ID COPILOT_ALLOW_ALL \
  COPILOT_GITHUB_TOKEN COPILOT_MODEL CURSOR_AGENT CURSOR_EXTENSION_HOST_ROLE \
  CURSOR_TRACE_ID GEMINI_CLI OPENCODE_CLIENT REPL_ID; do
  unset "$var"
done
BUILD_DB="postgresql://postgres:postgres@localhost:$PORT/centient_test"
PAYMENTS_DB="postgresql://postgres:postgres@localhost:$PORT/centient_payments"
export DATABASE_URL="$BUILD_DB" TEST_DATABASE_URL="$BUILD_DB"

# --- steps --------------------------------------------------------------------
SUMMARY=()
N=0
step() {
  local name=$1
  shift
  N=$((N + 1))
  local log
  log="$LOGS/$(printf '%02d' "$N")-$(echo "$name" | tr ' /:' '---').log"
  say "$name"
  local start=$SECONDS
  if (cd "$SRC" && "$@") >"$log" 2>&1; then
    SUMMARY+=("| $name | ✅ | $((SECONDS - start)) s |")
  else
    SUMMARY+=("| $name | ❌ | $((SECONDS - start)) s |")
    tail -n 60 "$log" >&2
    print_summary
    die "\"$name\" failed; full log: $log (set CI_LOCAL_KEEP=1 to keep it)"
  fi
}

# Vitest's last "Tests" line, e.g. "Tests  2579 passed | 1 todo (2580)".
tests_line() {
  sed -e 's/\x1b\[[0-9;]*m//g' "$1" | grep -E '^ *Tests ' | tail -n 1 | sed -E 's/^ *Tests +//'
}
files_line() {
  sed -e 's/\x1b\[[0-9;]*m//g' "$1" | grep -E '^ *Test Files ' | tail -n 1 | sed -E 's/^ *Test Files +//'
}

print_summary() {
  {
    echo
    echo "### CI evidence: \`scripts/ci-local.sh\` (#243)"
    echo
    echo "- Commit \`$SHA\` (tree \`$TREE\`)"
    echo "- Node $(node --version), Postgres $PG_VERSION, TZ=UTC, $(uname -s) $(uname -m)"
    echo
    echo "| Step | Result | Time |"
    echo "|---|---|---:|"
    printf '%s\n' "${SUMMARY[@]}"
    for f in "$LOGS"/*-npm-test.log "$LOGS"/*-test-coverage.log "$LOGS"/*-payments-lane.log; do
      [[ -f $f ]] || continue
      local label
      label=$(basename "$f" .log | sed -E 's/^[0-9]+-//')
      echo
      echo "- $label: $(files_line "$f") files; $(tests_line "$f")"
    done
  } | tee "$WORK/summary.md"
}

# job: build
step "Node version" bash -c 'node --version && test "$(node --version)" = "v$(cat .node-version)"'
step "npm ci" npm ci
step "Prisma generate" npx prisma generate
step "Typecheck" npm run typecheck
step "Migrate deploy" npx prisma migrate deploy
step "npm test" npm test
step "test coverage" npm run test:coverage
step "Build" npm run build

# job: payments-lane, on its own fresh database as in ci.yml
step "Payments migrate deploy" env DATABASE_URL="$PAYMENTS_DB" TEST_DATABASE_URL="$PAYMENTS_DB" \
  npx prisma migrate deploy
step "payments lane" env DATABASE_URL="$PAYMENTS_DB" TEST_DATABASE_URL="$PAYMENTS_DB" \
  npm run test:payments

# The Soroban contract's tests join the gate as soon as M2-P2 (#244) adds them.
for manifest in Cargo.toml contracts/Cargo.toml; do
  if [[ -f "$SRC/$manifest" ]]; then
    step "cargo test" cargo test --manifest-path "$manifest" --workspace --locked
    break
  fi
done

print_summary
