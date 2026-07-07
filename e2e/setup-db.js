const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
const db = require('../backend/src/config/database');

async function setup() {
  await db.initPromise;

  // Clean start - Delete tables and re-initialize
  db.exec('DROP TABLE IF EXISTS USERS;');
  db.exec('DROP TABLE IF EXISTS EPISODES;');
  db.exec('DROP TABLE IF EXISTS SEASONS;');
  db.exec('DROP TABLE IF EXISTS SERIES;');
  db.exec('DROP TABLE IF EXISTS WATCH_HISTORY;');

  db.initializeTables();

  const dummyPath = path.resolve(__dirname, 'dummy-media/Test Series');
  const seasonPath = path.resolve(dummyPath, 'Season 1');
  const filePath = path.resolve(seasonPath, 'test-video.mp4');
  const metaPath = path.resolve(dummyPath, 'metadata.json');

  fs.mkdirSync(seasonPath, { recursive: true });
  fs.writeFileSync(filePath, Buffer.alloc(100)); // Create a fake 100-byte video file
  fs.writeFileSync(metaPath, JSON.stringify({ title: 'Test Series', type: 'serie' }));

  const serieRes = db
    .prepare('INSERT INTO SERIES (TITLE, FOLDER_PATH) VALUES (?, ?)')
    .run('Test Series', dummyPath);
  const seasonRes = db
    .prepare('INSERT INTO SEASONS (SERIE_ID, SEASON_NUMBER, NAME, FOLDER_PATH) VALUES (?, ?, ?, ?)')
    .run(serieRes.lastInsertRowid, 1, 'Season 1', seasonPath);
  db.prepare(
    'INSERT INTO EPISODES (SEASON_ID, EPISODE_NUMBER, NAME, FILE_PATH, FILE_SIZE, DURATION) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(seasonRes.lastInsertRowid, 1, 'Ep 1', filePath, 0, 0);

  // We also need a user to log in. We insert the bcrypt hash for 'password123'
  db.createUser(`playeruser`, '$2b$10$mPInW5IjK0bhF8ZO56CfPOBh.1gUmkhdZrkbXm1lSIKsV48BCkuPu');

  db.save();
  console.log('Test DB seeded.');
}

setup();
