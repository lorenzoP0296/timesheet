const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:timesheet@app.local',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function getSlotLabel() {
  const now = new Date();
  const paris = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  const parts = paris.formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour').value);
  const m = parseInt(parts.find(p => p.type === 'minute').value);
  const slotM = Math.floor(m / 15) * 15;
  const endM = slotM + 15;
  const endH = endM >= 60 ? h + 1 : h;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(slotM)} – ${pad(endH % 24)}:${pad(endM % 60)}`;
}

exports.handler = async () => {
  try {
    const siteId = process.env.MY_SITE_ID;
    const token = process.env.NETLIFY_API_TOKEN;

    if (!siteId || !token) {
      console.error('MY_SITE_ID ou NETLIFY_API_TOKEN manquant');
      return { statusCode: 500, body: 'Config manquante' };
    }

    const getRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env/PUSH_SUBSCRIPTIONS`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!getRes.ok) { console.log('Aucun abonné'); return { statusCode: 200, body: 'No subscribers' }; }

    const data = await getRes.json();
    const val = data.values?.find(v => v.context === 'production')?.value || data.value || '[]';
    let subscriptions = [];
    try { subscriptions = JSON.parse(val); } catch { subscriptions = []; }

    if (!subscriptions.length) { console.log('Aucun abonné'); return { statusCode: 200, body: 'No subscribers' }; }

    const label = getSlotLabel();
    const payload = JSON.stringify({
      title: '⏱ Timesheet',
      body: `Que fais-tu ? ${label}`,
      tag: 'timesheet-reminder',
      url: '/'
    });

    const valid = [];
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, payload);
          valid.push(sub);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log('Subscription expirée, supprimée');
          } else {
            valid.push(sub);
          }
        }
      })
    );

    if (valid.length !== subscriptions.length) {
      await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env/PUSH_SUBSCRIPTIONS`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'PUSH_SUBSCRIPTIONS', values: [{ value: JSON.stringify(valid), context: 'production' }] })
      });
    }

    console.log(`Envoyé à ${valid.length}/${subscriptions.length} abonnés`);
    return { statusCode: 200, body: `Sent ${valid.length}` };
  } catch (err) {
    console.error('send-push error:', err);
    return { statusCode: 500, body: err.message };
  }
};

module.exports.config = { schedule: '0,15,30,45 * * * *' };
