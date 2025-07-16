/**
 * shadow-hours-mvp.cjs  — CommonJS CLI tool
 * ------------------------------------------------------------
 * 1. Parse shadow-calendar text files
 * 2. Auto-map each description to an ERP subtask (fast-fuzzy + CSV)
 * 3. Learn: prompt for any UNMAPPED rows and append them to the CSV
 *
 * Quick-start:
 *   npm install csv-parse fast-fuzzy readline-sync
 *   node shadow-hours-mvp.cjs my_log.txt
 * ------------------------------------------------------------*/

const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { search } = require("fast-fuzzy");
const readline = require("readline-sync");

const CSV_PATH = "./data/Shadow_Calendar_Task_Mapping.csv";

/* ── Helpers ──────────────────────────────────────────────── */
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[–—-]/g, "-")   // unify dashes
    .replace(/&/g, "and")     // unify symbols
    .replace(/[^a-z0-9 -]/g, ""); // strip punctuation

/* ── Load mapping CSV once ───────────────────────────────── */
const taskMapping = (() => {
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parse(raw, {
    columns: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true
  });
  return rows.map((r) => ({
    description: r.Description.trim(),
    normDesc: norm(r.Description),
    subtask: r.Subtask.trim()
  }));
})();
const candidates = taskMapping.map((t) => t.normDesc);

/* ── Parser ──────────────────────────────────────────────── */
function parseShadowCalendar(text) {
  const lines   = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const entries = [];
  let currentDate = null;

  const dateRegex  = /^(\d{1,2} [A-Za-zäöüÄÖÜ]+,? \d{4})/;
  // accept dash variants between times and →, ->, or dash before description
  const entryRegex =
    /^(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\s*(?:→|->|-)\s*(.+)$/;

  for (const line of lines) {
    if (dateRegex.test(line)) {
      currentDate = line.match(dateRegex)[1];
      continue;
    }
    const m = line.match(entryRegex);
    if (m && currentDate) {
      let [, start, end, desc] = m;
      desc = desc.replace(/^>\s*/, "");      // remove leading "> " if present
      entries.push({ date: currentDate, start, end, description: desc.trim() });
    }
  }
  return entries;
}


/* ── Mapping ─────────────────────────────────────────────── */
function mapEntryToSubtask(description) {
  const [bestItem] = search(norm(description), candidates); // returns top string
  if (!bestItem) return { subtask: "UNMAPPED", score: 0 };

  const row = taskMapping.find((t) => t.normDesc === bestItem);
  return { subtask: row ? row.subtask : "UNMAPPED", score: 1 };
}

function mapEntries(entries) {
  return entries.map((e) => {
    const { subtask, score } = mapEntryToSubtask(e.description);
    return { ...e, erp_subtask: subtask, confidence: score };
  });
}

/* ── Learning prompt ─────────────────────────────────────── */
function learnMappings(mappedRows) {
  const unmapped = mappedRows.filter((r) => r.erp_subtask === "UNMAPPED");
  if (!unmapped.length) return;

  console.log("\n--- Learning new mappings ---");
  unmapped.forEach((row) => {
    const answer = readline.question(
      `\nNo mapping for:\n  "${row.task_description || row.description}"\nEnter ERP subtask ID (or blank to skip): `
    );
    if (answer.trim()) {
      const csvLine = `ANY,-,-,${row.description},${answer.trim()}\n`;
      fs.appendFileSync(CSV_PATH, csvLine, "utf8");
      console.log("✓ Saved.");

      // Update in-memory maps for this run
      taskMapping.push({
        description: row.description,
        normDesc: norm(row.description),
        subtask: answer.trim()
      });
      candidates.push(norm(row.description));
      row.erp_subtask = answer.trim();
      row.confidence  = 1;
    }
  });
}

/* ── Convert to ERP JSON ─────────────────────────────────── */
function toERPJson(rows, employee = "UNKNOWN") {
  return rows.map((r) => ({
    employee,
    date: new Date(r.date).toISOString().slice(0, 10),
    start_time: r.start,
    end_time: r.end,
    task_description: r.description,
    erp_subtask: r.erp_subtask,
    confidence: r.confidence
  }));
}

/* ── CLI runner ──────────────────────────────────────────── */
if (require.main === module) {
  if (process.argv.length < 3) {
    console.error("Usage: node shadow-hours-mvp.cjs <shadow-calendar.txt>");
    process.exit(1);
  }
  const rawText = fs.readFileSync(process.argv[2], "utf8");
  const mapped  = mapEntries(parseShadowCalendar(rawText));

  learnMappings(mapped); // prompt & persist new mappings

  console.log(JSON.stringify(toERPJson(mapped, "Markus Lange"), null, 2));
}

/* ── Exports for tests / API ─────────────────────────────── */
module.exports = { parseShadowCalendar, mapEntries, toERPJson };
