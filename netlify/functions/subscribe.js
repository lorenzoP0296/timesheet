// netlify/functions/subscribe.js
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  try {
    const body = JSON.parse(event.body || '{}');
    const siteId = process.env.MY_SITE_ID;
    const token = process.env.NETLIFY_API_TOKEN;

    if (!siteId || !token) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'MY_SITE_ID ou NETLIFY_API_TOKEN manquant' }) };
    }

    const getRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env/PUSH_SUBSCRIPTIONS`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    let subscriptions = [];
    if (getRes.ok) {
      const data = await getRes.json();
      const val = data.values?.find(v => v.context === 'production')?.value || data.value || '[]';
      try { subscriptions = JSON.parse(val); } catch { subscriptions = []; }
    }

    if (event.httpMethod === 'POST') {
      const { subscription } = body;
      if (!subscription?.endpoint) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid subscription' }) };
      subscriptions = subscriptions.filter(s => s.endpoint !== subscription.endpoint);
      subscriptions.push(subscription);
    }

    if (event.httpMethod === 'DELETE') {
      const { endpoint } = body;
      subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
    }

    const saveRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env/PUSH_SUBSCRIPTIONS`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'PUSH_SUBSCRIPTIONS', values: [{ value: JSON.stringify(subscriptions), context: 'production' }] })
    });

    if (!saveRes.ok) {
      await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ key: 'PUSH_SUBSCRIPTIONS', values: [{ value: JSON.stringify(subscriptions), context: 'production' }] }])
      });
    }

    return { statusCode: event.httpMethod === 'POST' ? 201 : 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('subscribe error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
