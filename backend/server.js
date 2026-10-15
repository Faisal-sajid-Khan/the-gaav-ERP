'use strict';
require('dotenv').config();
const app = require('./src/app');
const { pool } = require('./src/config/db');
const { initSyncCron } = require('./src/features/sync/syncQueue');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test DB connection
    const connection = await pool.getConnection();
    console.log(`✅ MySQL connected successfully to ${process.env.DB_NAME || 'thegaaverp'} on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
    connection.release();

    // Start background cron jobs
    initSyncCron();

    // Start Express listener
    const server = app.listen(PORT, () => {
      console.log(`🚀 The Gaav ERP Backend running at http://localhost:${PORT}`);
      console.log(`   Timezone: ${process.env.TIMEZONE || 'Asia/Kolkata'}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await pool.end();
          console.log('MySQL pool closed.');
          process.exit(0);
        } catch (err) {
          console.error('Error during pool closing:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
