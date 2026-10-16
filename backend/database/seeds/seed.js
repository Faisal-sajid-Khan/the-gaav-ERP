'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seed() {
  const connConfig = process.env.DATABASE_URL
    ? {
        uri: process.env.DATABASE_URL.replace(/\?.*$/, ''),
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'thegaaverp',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        ssl: (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') ? { rejectUnauthorized: false } : undefined,
      };

  const conn = await mysql.createConnection(connConfig);

  console.log('Seeding initial data...');

  // Store
  const [stores] = await conn.execute('SELECT id FROM stores WHERE id = 1');
  if (stores.length === 0) {
    await conn.execute(
      `INSERT INTO stores (id, name, timezone, currency, currency_symbol) VALUES (1, 'The Gaav', 'Asia/Kolkata', 'INR', '₹')`
    );
    console.log('✅ Default store created');
  }

  // Admin user
  const [users] = await conn.execute(`SELECT id FROM users WHERE email = 'admin@thegaav.com'`);
  if (users.length === 0) {
    const hash = await bcrypt.hash('Admin@123', 12);
    await conn.execute(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@thegaav.com', ?, 'admin')`,
      [hash]
    );
    console.log('✅ Admin user created: admin@thegaav.com / Admin@123');
  }

  // Sales channels
  const channels = [
    { name: 'Shopify', type: 'shopify', fee_type: 'none', fee_value: 0 },
    { name: 'WhatsApp', type: 'whatsapp', fee_type: 'none', fee_value: 0 },
    { name: 'Instagram', type: 'instagram', fee_type: 'percentage', fee_value: 5 },
    { name: 'Offline', type: 'offline', fee_type: 'none', fee_value: 0 },
    { name: 'Distributor', type: 'distributor', fee_type: 'percentage', fee_value: 15 },
  ];
  for (const ch of channels) {
    const [rows] = await conn.execute('SELECT id FROM sales_channels WHERE name = ? AND store_id = 1', [ch.name]);
    if (rows.length === 0) {
      await conn.execute(
        `INSERT INTO sales_channels (store_id, name, type, fee_type, fee_value) VALUES (1, ?, ?, ?, ?)`,
        [ch.name, ch.type, ch.fee_type, ch.fee_value]
      );
    }
  }
  console.log('✅ Sales channels seeded');

  // Inventory location
  const [locs] = await conn.execute('SELECT id FROM inventory_locations WHERE store_id = 1 LIMIT 1');
  if (locs.length === 0) {
    await conn.execute(
      `INSERT INTO inventory_locations (store_id, name, is_primary) VALUES (1, 'Main Warehouse', 1)`
    );
    console.log('✅ Default inventory location created');
  }

  await conn.end();
  console.log('✅ Seeding complete');
}

if (require.main === module) {
  seed().catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}

module.exports = { seed };
