// netlify/functions/send-push.js
// Scheduled function — runs every 15 minutes via cron
// Schedule: "0,15,30,45 * * * *"

const webpush = require('web-push');
const { getStore } = require('@netlify/blobs');

webpush.setVapidDetails(
  'mailto:timesheet@app.local',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function getSlotLabel() {
  const now = new Date();
  // Use Paris timezone
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
    const store = getStore('push-subscriptions');
    const { blobs } = await store.list();

    if (!blobs || blobs.length === 0) {
      console.log('No subscribers');
      return { statusCode: 200, body: 'No subscribers' };
    }

    const label = getSlotLabel();
    const payload = JSON.stringify({
      title: '⏱ Timesheet',
      body: `Que fais-tu ? ${label}`,
      tag: 'timesheet-reminder',
      url: '/'
    });

    const results = await Promise.allSettled(
      blobs.map(async ({ key }) => {
        const raw = await store.get(key);
        if (!raw) return;
        const sub = JSON.parse(raw);
        try {
          await webpush.sendNotification(sub, payload);
        } catch (err) {
          // 410 Gone = subscription expired, clean it up
          if (err.statusCode === 410 || err.statusCode === 404) {
            await store.delete(key);
            console.log('Removed expired subscription:', key);
          } else {
            throw err;
          }
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    console.log(`Sent to ${sent}/${blobs.length} subscribers`);
    return { statusCode: 200, body: `Sent ${sent}` };
  } catch (err) {
    console.error('send-push error:', err);
    return { statusCode: 500, body: err.message };
  }
};

// Netlify scheduled function config
module.exports.config = {
  schedule: '0,15,30,45 * * * *'
};
