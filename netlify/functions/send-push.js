const webpush = require('web-push');
webpush.setVapidDetails('mailto:timesheet@app.local', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
function getSlotLabel() {
  const now = new Date();
  const paris = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false });
  const parts = paris.formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour').value);
  const m = parseInt(parts.find(p => p.type === 'minute').value);
  const slotM = Math.floor(m / 15) * 15, endM = slotM + 15, endH = endM >= 60 ? h + 1 : h;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(slotM)} – ${pad(endH % 24)}:${pad(endM % 60)}`;
}
exports.handler = async () => {
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'push-subscriptions', consistency: 'strong' });
    const { blobs } = await store.list();
    if (!blobs || blobs.length === 0) { console.log('No subscribers'); return { statusCode: 200, body: 'No subscribers' }; }
    const payload = JSON.stringify({ title: '⏱ Timesheet', body: `Que fais-tu ? ${getSlotLabel()}`, tag: 'timesheet-reminder', url: '/' });
    await Promise.allSettled(blobs.map(async ({ key }) => {
      try {
        const raw = await store.get(key); if (!raw) return;
        await webpush.sendNotification(JSON.parse(raw), payload);
      } catch (err) { if (err.statusCode === 410 || err.statusCode === 404) await store.delete(key); }
    }));
    console.log(`Sent to ${blobs.length} subscribers`);
    return { statusCode: 200, body: `Sent ${blobs.length}` };
  } catch (err) { console.error('send-push error:', err); return { statusCode: 500, body: err.message }; }
};
module.exports.config = { schedule: '0,15,30,45 * * * *' };
