// netlify/functions/subscribe.js
// Saves a push subscription to Netlify Blobs (built-in KV store)

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  try {
    const store = getStore('push-subscriptions');
    const body = JSON.parse(event.body || '{}');

    if (event.httpMethod === 'DELETE') {
      const { endpoint } = body;
      if (!endpoint) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing endpoint' }) };
      const key = Buffer.from(endpoint).toString('base64').slice(0, 100);
      await store.delete(key);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod === 'POST') {
      const { subscription } = body;
      if (!subscription?.endpoint) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid subscription' }) };
      const key = Buffer.from(subscription.endpoint).toString('base64').slice(0, 100);
      await store.set(key, JSON.stringify(subscription));
      return { statusCode: 201, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('subscribe error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
