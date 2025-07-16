/**
 * shadow-hours-mvp.cjs  — FINAL CLEAN VERSION
 * ------------------------------------------------------------------
 * Quick‑start:
 *   npm install csv-parse fast-fuzzy
 *   node shadow-hours-mvp.cjs sample_log.txt
 * ------------------------------------------------------------------*/

// ─── External deps ────────────────────────────────────────────────
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { search } = require("fast-fuzzy");

// Helper to normalise text for fuzzy matching
const norm = (s) =>
    s.toLowerCase()
    .replace(/[–—-]/g, "-") // unify dashes
    .replace(/&/g, "and")    // optional symbol swap
    .replace(/[^a-z0-9 -]/g, ""); // strip punctuation

// ─── 0️⃣  Load CSV mapping once ───────────────────────────────────
const MAPPING_CSV = "./data/Shadow_Calendar_Task_Mapping.csv";
const taskMapping = (() => {
  const rawCsv = fs.readFileSync(MAPPING_CSV, "utf-8");
  const records = parse(rawCsv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true
  });
  return records.map((r) => ({
    description: r.Description.trim(),
    normDesc: norm(r.Description),
    subtask: r.Subtask.trim()
  }));
})();

// Candidate list for fuzzy search (normalised)
const candidates = taskMapping.map((t) => t.normDesc);

// ─── 1️⃣  Parse shadow‑calendar text ───────────────────────────────
function parseShadowCalendar(text) {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const entries = [];
  let currentDate = null;
  const dateRegex = /^(\d{1,2} [A-Za-zäöüÄÖÜ]+,? \d{4})/;
  const entryRegex = /^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})\s*[→-]\s*(.+)$/;

  for (const line of lines) {
    if (dateRegex.test(line)) {
      currentDate = line.match(dateRegex)[1];
      continue;
    }
    const match = line.match(entryRegex);
    if (match && currentDate) {
      const [, start, end, desc] = match;
      entries.push({ date: currentDate, start, end, description: desc.trim() });
    }
  }
  return entries;
}

// ─── 2️⃣  Auto‑map description → ERP subtask ──────────────────────
function mapEntryToSubtask(description) {
  const [bestItem] = search(norm(description), candidates);   // bestItem is a string
if (!bestItem) return { subtask: "UNMAPPED", score: 0 };

const matchRow = taskMapping.find(t => t.normDesc === bestItem);
return {
  subtask: matchRow ? matchRow.subtask : "UNMAPPED",
  score: 1                           // we can treat top hit as full confidence
};

}

function mapEntries(entries) {
  return entries.map((e) => {
    const { subtask, score } = mapEntryToSubtask(e.description);
    return { ...e, erp_subtask: subtask, confidence: score };
  });
}

// ─── 3️⃣  Convert mapped entries → ERP‑ready JSON ──────────────────
function toERPJson(mappedEntries, employee = "UNKNOWN") {
  return mappedEntries.map((e) => ({
    employee,
    date: new Date(e.date).toISOString().slice(0, 10),
    start_time: e.start,
    end_time: e.end,
    task_description: e.description,
    erp_subtask: e.erp_subtask,
    confidence: e.confidence
  }));
}

// ─── 4️⃣  CLI helper ───────────────────────────────────────────────
if (require.main === module) {
  if (process.argv.length < 3) {
    console.error("Usage: node shadow-hours-mvp.cjs <path-to-shadow-calendar.txt>");
    process.exit(1);
  }
  const inputPath = process.argv[2];
  const rawText = fs.readFileSync(inputPath, "utf-8");
  const entries = parseShadowCalendar(rawText);
  const mapped = mapEntries(entries);
  console.log(JSON.stringify(toERPJson(mapped, "Markus Lange"), null, 2));
}

// ─── 5️⃣  Exports ─────────────────────────────────────────────────
module.exports = {
  parseShadowCalendar,
  mapEntries,
  toERPJson
};
