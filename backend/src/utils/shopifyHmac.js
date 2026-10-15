'use strict';
const crypto = require('crypto');

function verifyShopifyWebhook(rawBody, hmacHeader, secret) {
  if (!rawBody || !hmacHeader || !secret) {
    return false;
  }
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
  } catch (err) {
    return false;
  }
}

module.exports = { verifyShopifyWebhook };
