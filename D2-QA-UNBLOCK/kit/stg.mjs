// Run a command in the worktree with the Railway `web` env (DATABASE_URL -> public proxy). Secrets stay in memory.
import { execFileSync, spawnSync } from "node:child_process";
const repo = "/Users/cemmacabales/centient";
const vars = (svc) => JSON.parse(execFileSync("railway", ["variables", "--service", svc, "--environment", "production", "--json"], { cwd: repo, encoding: "utf8" }));
const web = vars("web");
const pg = vars("Postgres");
const env = { ...process.env, ...web, DATABASE_URL: pg.DATABASE_PUBLIC_URL, ...JSON.parse(process.env.STG_OVERRIDE || "{}") };
const [cmd, ...args] = process.argv.slice(2);
const r = spawnSync(cmd, args, { cwd: process.env.STG_CWD || new URL("./wt", import.meta.url).pathname, env, stdio: "inherit" });
process.exit(r.status ?? 1);
