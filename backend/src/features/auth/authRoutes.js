'use strict';
const router = require('express').Router();
const { login, logout, refresh, me } = require('./authController');
const { authenticate } = require('../../middleware/authMiddleware');
const { authLimiter } = require('../../middleware/rateLimiter');

router.post('/login', authLimiter, login);
router.post('/logout', authenticate, logout);
router.post('/refresh', refresh);
router.get('/me', authenticate, me);

module.exports = router;
