const fs = require('fs');
const covPath = process.argv[2];
const cov = JSON.parse(fs.readFileSync(covPath, 'utf8'));
const keys = Object.keys(cov);
const key = keys.find(k => k.endsWith('ipc\\fileControl.js') || k.endsWith('ipc/fileControl.js'));
if (!key) { console.log('NOT FOUND'); console.log('keys:', keys); process.exit(0); }
const e = cov[key];
const br = e.branchMap, bc = e.b, f = e.f, fc = e.fCount;
const uncovered = [];
for (const id of Object.keys(br)) {
  const hits = bc[id];
  if (hits.some(h => h === 0)) {
    const locs = br[id].locations.map(l => `(${l.start.line}:${l.start.column})-(${l.end.line}:${l.end.column})`).join(' | ');
    uncovered.push(`branch[${id}] type=${br[id].type} hits=${JSON.stringify(hits)} locs=${locs}`);
  }
}
console.log('Uncovered branches:', uncovered.length);
uncovered.forEach(u => console.log('  ' + u));
console.log('stmts:', e.s, 'stmtCount:', e.statementMap ? Object.keys(e.statementMap).length : '?');