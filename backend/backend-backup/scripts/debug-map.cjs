// debug-map.js
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { search } = require('fast-fuzzy');

const norm = s => s
  .toLowerCase()
  .replace(/[–—-]/g,'-')
  .replace(/&/g,'and')
  .replace(/[^a-z0-9 -]/g,'');

const csv = fs.readFileSync('./data/Shadow_Calendar_Task_Mapping.csv','utf8');
const rows = parse(csv,{ columns:true, trim:true });
const taskMap = rows.map(r => ({ orig: r.Description, n: norm(r.Description) }));
const cand = taskMap.map(t => t.n);

console.log('Candidates in CSV:\n', cand);

const sample = [
  'Verlagsinfo-Vorbereitung & Abstimmung',
  'Pflichtinfo-Umsetzung & Anpassungen abstimmen'
];

sample.forEach(txt => {
  const [best] = search(norm(txt), cand);
  console.log('\\nLOG line:', txt, '\\n best match:', best);
});
