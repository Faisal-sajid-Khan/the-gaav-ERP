'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./features/auth/authRoutes');
const userRoutes = require('./features/users/userRoutes');
const productRoutes = require('./features/products/productRoutes');
const channelRoutes = require('./features/channels/channelRoutes');
const orderRoutes = require('./features/orders/orderRoutes');
const inventoryRoutes = require('./features/inventory/inventoryRoutes');
const dashboardRoutes = require('./features/dashboard/dashboardRoutes');
const settingsRoutes = require('./features/settings/settingsRoutes');
const shopifyRoutes = require('./features/shopify/shopifyRoutes');
const syncRoutes = require('./features/sync/syncRoutes');
const auditRoutes = require('./features/audit/auditRoutes');
const notificationRoutes = require('./features/notifications/notificationRoutes');
const expenseRoutes = require('./features/expenses/expenseRoutes');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all dev origins smoothly
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Shopify-Topic', 'X-Shopify-Hmac-Sha256', 'X-Shopify-Webhook-Id']
}));

// Cookie parser
app.use(cookieParser());

// Capture raw body for Shopify Webhook HMAC verification
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    timezone: process.env.TIMEZONE || 'Asia/Kolkata'
  });
});

// Apply API rate limiting
app.use('/api/', apiLimiter);

// API feature routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics/dashboard', dashboardRoutes);
app.use('/api/contribution', dashboardRoutes);
app.use('/api/analytics/contribution', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/expenses', expenseRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.url}` });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
