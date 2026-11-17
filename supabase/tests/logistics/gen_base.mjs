// Build a base schema (tables + enums) from the generated Supabase types, which
// mirror the live database before the logistics migrations.
import fs from "node:fs";

const src = fs.readFileSync(process.argv[2], "utf8").split(String.fromCharCode(13)).join("");
const pub = src.slice(src.indexOf("  public: {"));
const tablesStart = pub.indexOf("    Tables: {");
const viewsStart = pub.indexOf("    Views: {");
const enumsStart = pub.indexOf("    Enums: {");
const compositeStart = pub.indexOf("    CompositeTypes: {");

const out = [];

// Enums
const enumBlock = pub.slice(enumsStart, compositeStart);
for (const m of enumBlock.matchAll(/^ {6}([a-z0-9_]+):\s*((?:\n?\s*\|?\s*"[^"]*")+)/gm)) {
  const values = [...m[2].matchAll(/"([^"]*)"/g)].map((v) => `'${v[1].replace(/'/g, "''")}'`);
  out.push(`DO $$ BEGIN CREATE TYPE public.${m[1]} AS ENUM (${values.join(", ")}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
}

// Tables
const tablesBlock = pub.slice(tablesStart, viewsStart);
const tableRe = /^ {6}([a-z0-9_]+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm;
for (const m of tablesBlock.matchAll(tableRe)) {
  const table = m[1];
  const cols = [];
  for (const line of m[2].split("\n")) {
    const c = line.match(/^\s+([a-zA-Z0-9_]+): (.+)$/);
    if (!c) continue;
    const [, name, tsRaw] = c;
    const ts = tsRaw.replace(/\s*\|\s*null$/, "").trim();
    let type;
    const en = ts.match(/Database\["public"\]\["Enums"\]\["([a-z0-9_]+)"\](\[\])?/);
    if (en) type = `public.${en[1]}${en[2] ? "[]" : ""}`;
    else if (ts === "string[]") type = "text[]";
    else if (ts === "number[]") type = "numeric[]";
    else if (ts === "Json") type = "jsonb";
    else if (ts === "boolean") type = "boolean";
    else if (ts === "number") type = /(^|_)(count|quantity|year|position|sort_order|attempts?|level|rank|order|days|minutes|seconds|hours)$/.test(name) ? "integer" : "numeric";
    else if (ts === "string" || ts === "unknown") {
      if (name === "id" || /_id$/.test(name) || name === "user_id") type = "uuid";
      else if (/(_at|_on)$/.test(name) || /^(timestamp|last_updated)$/.test(name)) type = "timestamptz";
      else if (/(^|_)date$/.test(name) || /_expiry$/.test(name)) type = "date";
      else type = "text";
    } else type = "text";
    let def = "";
    if (name === "id" && type === "uuid") def = " PRIMARY KEY DEFAULT gen_random_uuid()";
    else if (name === "created_at" || name === "updated_at") def = " DEFAULT now()";
    cols.push(`  ${name} ${type}${def}`);
  }
  if (!cols.some((c) => /^\s+id /.test(c))) cols.unshift("  _rowid bigserial PRIMARY KEY");
  out.push(`CREATE TABLE IF NOT EXISTS public.${table} (\n${cols.join(",\n")}\n);`);
}

fs.writeFileSync(process.argv[3], out.join("\n\n") + "\n");
console.log(`enums: ${out.filter((s) => s.startsWith("DO")).length}, tables: ${out.filter((s) => s.startsWith("CREATE TABLE")).length}`);
