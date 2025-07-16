/* server.mjs – ES-module Express API
   ----------------------------------
   Endpoints
     POST /parse  { text, employee? }  → mapped JSON
     POST /submit { text, employee? }  → mock-submit, logs payload
*/

import express from 'express';
import bodyParser from 'body-parser';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { createRequire } from 'module';
import cors from 'cors';
        

const require = createRequire(import.meta.url);
const {
  parseShadowCalendar,
  mapEntries,
  toERPJson
} = require('./shadow-hours-mvp.cjs');


const app = express();
app.use(cors());           // ← add BEFORE routes
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
// helper
const processText = (text, employee = 'UNKNOWN') =>
  toERPJson(mapEntries(parseShadowCalendar(text)), employee);

// ── routes ────────────────────────────────────────────
app.post("/parse", (req, res) => {
  const { text, employee } = req.body || {};
  console.log("[/parse] Incoming text:", text); // 👈 Add this

  if (!text) return res.status(400).json({ error: "'text' is required" });
  try {
    const result = processText(text, employee);
    return res.json(result);
  } catch (err) {
    console.error("[/parse] Error:", err); // 👈 And this
    return res.status(500).json({ error: "Internal error" });
  }
});


app.post('/submit', (req, res) => {
  const { text, employee } = req.body ?? {};
  if (!text) return res.status(400).json({ error: "'text' is required" });

  try {
    const payload = processText(text, employee);
    // TODO: replace with real ERP call
    console.log('[MOCK ERP SUBMIT]', JSON.stringify(payload, null, 2));
    res.json({ status: 'ok', rows: payload.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});
app.get('/tasks', (_, res) => {
  const csv = readFileSync('./data/Shadow_Calendar_Task_Mapping.csv', 'utf8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  const subtasks = [...new Set(rows.map(r => r.Subtask.trim()))].sort();
  res.json(subtasks);
});
// ── start ─────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Shadow Hours API listening on http://localhost:${PORT}`)
);
