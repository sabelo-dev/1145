// Cross-check frontend / edge-function database calls against the real schema.
//   node check.mjs <schema.json> <file...>
import fs from "node:fs";

const schema = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const files = process.argv.slice(3);
const tables = schema.tables; // { table: [cols] }
const procs = schema.procs; // { name: [{ args: [names], required: n }] }

const problems = [];
const stats = { rpc: 0, from: 0, cols: 0 };

const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

// Balanced-brace object literal starting at '{'.
function objectAt(src, i) {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return "";
}
function topLevelKeys(obj) {
  const inner = obj.slice(1, -1);
  const keys = [];
  let depth = 0;
  let token = "";
  for (const ch of inner) {
    if ("{[(".includes(ch)) depth++;
    if ("}])".includes(ch)) depth--;
    if (depth === 0 && ch === ",") {
      keys.push(token);
      token = "";
    } else token += ch;
  }
  keys.push(token);
  return keys
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => {
      if (k.startsWith("...")) return "...";
      const m = k.match(/^["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*(:|$)/);
      return m ? m[1] : "?";
    });
}

// Column list of a PostgREST select string (top level only, embeds skipped).
function selectColumns(sel) {
  const cols = [];
  let depth = 0;
  let token = "";
  for (const ch of sel + ",") {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && ch === ",") {
      const t = token.trim();
      token = "";
      if (!t || t === "*" || t.includes("(")) continue; // embedded relation
      const name = (t.includes(":") ? t.split(":")[1] : t).split("::")[0].trim();
      if (/^[a-z_][a-z0-9_]*$/i.test(name)) cols.push(name);
    } else token += ch;
  }
  return cols;
}

for (const f of files) {
  const src = fs.readFileSync(f, "utf8").split("\r\n").join("\n");

  // ---- RPC calls --------------------------------------------------------
  for (const m of src.matchAll(/\.rpc\(\s*["']([a-z0-9_]+)["'](?:\s+as\s+never)?\s*(,\s*)?/g)) {
    stats.rpc++;
    const name = m[1];
    const at = `${f}:${lineOf(src, m.index)}`;
    const defs = procs[name];
    if (!defs) {
      problems.push(`${at}  rpc ${name}(): FUNCTION DOES NOT EXIST`);
      continue;
    }
    let keys = [];
    if (m[2]) {
      const after = src.slice(m.index + m[0].length);
      if (after.trimStart().startsWith("{")) keys = topLevelKeys(objectAt(after, after.indexOf("{")));
      else keys = ["<dynamic>"];
    }
    if (keys.includes("<dynamic>") || keys.includes("...") || keys.includes("?")) continue;
    const ok = defs.some((d) => keys.every((k) => d.args.includes(k)) && d.args.slice(0, d.required).every((a) => keys.includes(a)));
    if (!ok) {
      const d = defs[0];
      const unknown = keys.filter((k) => !d.args.includes(k));
      const missing = d.args.slice(0, d.required).filter((a) => !keys.includes(a));
      problems.push(`${at}  rpc ${name}(${keys.join(", ")}): ${unknown.length ? `unknown param(s) ${unknown.join(", ")}` : ""}${missing.length ? ` missing required ${missing.join(", ")}` : ""} (expects ${d.args.join(", ")})`);
    }
  }

  // ---- .from("table") chains -------------------------------------------
  for (const m of src.matchAll(/\.from\(\s*["']([a-z0-9_]+)["']\s*\)/g)) {
    const table = m[1];
    const at = `${f}:${lineOf(src, m.index)}`;
    if (["delivery-proofs", "product-images", "vendor-documents", "vendor-videos"].includes(table)) continue; // storage buckets
    stats.from++;
    const cols = tables[table];
    if (!cols) {
      // storage bucket calls look like .storage.from(...)
      if (src.slice(Math.max(0, m.index - 10), m.index).includes("storage")) continue;
      problems.push(`${at}  from("${table}"): TABLE DOES NOT EXIST`);
      continue;
    }
    // The chain runs until the statement ends.
    const rest = src.slice(m.index + m[0].length);
    // A chain ends at the statement end or where the next query starts (Promise.all arrays).
    const ends = [rest.search(/;\s*\n|\n\s*\n/), rest.search(/\.from\(\s*["']/), rest.search(/\.rpc\(/)].filter((n) => n >= 0);
    const chain = rest.slice(0, ends.length ? Math.min(...ends) : 400);
    const used = new Set();
    for (const s of chain.matchAll(/\.select\(\s*["'`]([^"'`]*)["'`]/g)) selectColumns(s[1]).forEach((c) => used.add(c));
    for (const s of chain.matchAll(/\.(?:eq|neq|in|is|gt|gte|lt|lte|like|ilike|order|not|contains)\(\s*["']([a-z_][a-z0-9_]*)(?:->>?[^"']*)?["']/g)) used.add(s[1]);
    for (const s of chain.matchAll(/\.(?:update|insert|upsert)\(\s*\{/g)) {
      const obj = objectAt(chain, s.index + s[0].length - 1);
      topLevelKeys(obj).forEach((k) => k !== "..." && k !== "?" && used.add(k));
    }
    for (const c of used) {
      stats.cols++;
      if (!cols.includes(c)) problems.push(`${at}  ${table}.${c}: COLUMN DOES NOT EXIST`);
    }
  }
}

console.log(`checked ${stats.rpc} rpc calls, ${stats.from} table chains, ${stats.cols} column references in ${files.length} files`);
console.log(problems.length ? problems.join("\n") : "no contract problems found");
process.exit(problems.length ? 1 : 0);
