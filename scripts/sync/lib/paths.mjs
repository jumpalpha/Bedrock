import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const CONTENT_DIR = path.join(REPO, "src/data/content");
/** Default private work dir (parsed keys, keys-to-load.sql). Always outside the repo. */
export const DEFAULT_WORK = process.env.BEDROCK_SYNC_DIR || path.join(tmpdir(), "bedrock-sync");

const real = (p) => {
  let q = path.resolve(p);
  while (!existsSync(q)) q = path.dirname(q);
  return path.join(realpathSync(q), path.relative(q, path.resolve(p)));
};
const inside = (child, parent) => { const r = path.relative(parent, child); return r === "" || (!r.startsWith("..") && !path.isAbsolute(r)); };

/** Throws if `dir` is inside this repo or inside any other git work tree: private keys must never land where they could be committed. */
export function assertOutsideRepo(dir, what = "Output folder") {
  const d = real(dir);
  if (inside(d, real(REPO))) throw new Error(`${what} ${dir} is inside the repo. Answer keys must never be written there. Pick a folder outside it (e.g. the scratchpad).`);
  let probe = path.resolve(dir); while (!existsSync(probe)) probe = path.dirname(probe);
  try {
    const top = execFileSync("git", ["-C", probe, "rev-parse", "--show-toplevel"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (top) throw new Error(`${what} ${dir} is inside the git repo ${top}. Answer keys must never be written into a repo.`);
  } catch (e) { if (String(e.message).includes("inside the git repo")) throw e; }
}
