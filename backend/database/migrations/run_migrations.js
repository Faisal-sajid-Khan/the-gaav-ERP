'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const connConfig = process.env.DATABASE_URL
    ? {
        uri: process.env.DATABASE_URL.replace(/\?.*$/, ''),
        multipleStatements: true,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'thegaaverp',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        multipleStatements: true,
        ssl: (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') ? { rejectUnauthorized: false } : undefined,
      };

  const conn = await mysql.createConnection(connConfig);

  console.log('Connected to MySQL database:', process.env.DB_NAME);

  await conn.execute(`CREATE TABLE IF NOT EXISTS migrations_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);

  const migrationDir = __dirname;
  const files = fs.readdirSync(migrationDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const [rows] = await conn.execute('SELECT id FROM migrations_log WHERE filename = ?', [file]);
    if (rows.length > 0) {
      console.log(`⏭️  Skipping ${file} (already applied)`);
      continue;
    }
    console.log(`🔄 Applying ${file}...`);
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
    await conn.beginTransaction();
    try {
      await conn.query(sql);
      await conn.execute('INSERT INTO migrations_log (filename) VALUES (?)', [file]);
      await conn.commit();
      console.log(`✅ Applied ${file}`);
    } catch (err) {
      await conn.rollback();
      console.error(`❌ Failed ${file}:`, err.message);
      throw err;
    }
  }

  await conn.end();
  console.log('✅ All migrations completed successfully');
}

if (require.main === module) {
  runMigrations().catch(err => {
    console.error('Migration runner failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigrations };
