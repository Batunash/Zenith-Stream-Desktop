const fs = require('fs');
const cov = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const keys = Object.keys(cov);
const key = keys.find(k => k.endsWith('ipc\\fileControl.js') || k.endsWith('ipc/fileControl.js'));
const e = cov[key];
const br = e.branchMap;
const bc = e.b;
for (const id of ['10','11','12','38','39','40','41','42','43','44','45']) {
  if (!br[id]) { console.log(`branch[${id}] MISSING`); continue; }
  const locs = br[id].locations.map(l => `(${l.start.line}:${l.start.column})-(${l.end.line}:${l.end.column})`).join(' | ');
  console.log(`branch[${id}] type=${br[id].type} hits=${JSON.stringify(bc[id])} locs=${locs}`);
}