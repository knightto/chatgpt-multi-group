const cron = require('node-cron');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Settings = require('../models/Settings');
const { sendEmailToSubscribers, sendAdminEmail } = require('./email');

async function findSettings() {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
}

async function findEmptyTeeTimesForWindow(groupId, hoursAhead = 48) {
  const now = new Date();
  const end = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const events = await Event.find({
    groupId,
    type: 'teeTime',
    date: { $gte: now, $lte: end }
  });

  const empties = [];
  for (const ev of events) {
    if (!Array.isArray(ev.teeTimes)) continue;
    for (const tt of ev.teeTimes) {
      const remaining = (tt.capacity || 4) - (tt.players?.length || 0);
      if (remaining <= 0) continue;

      empties.push({
        eventId: ev._id.toString(),
        name: ev.name,
        date: ev.date,
        teeTime: tt.time,
        remaining
      });
    }
  }
  return empties;
}

async function runEmptyTeeReminders(groupId = null) {
  const settings = await findSettings();
  if (!settings.globalNotificationsEnabled) {
    console.log('Global notifications disabled; skipping reminders.');
    return { ok: true, skipped: true };
  }

  const groupFilter = { isActive: true };
  if (groupId) groupFilter._id = groupId;

  const groups = await Group.find(groupFilter);
  const summary = [];

  for (const group of groups) {
    const empties = await findEmptyTeeTimesForWindow(group._id, 48);
    if (!empties.length) continue;

    const html = `
      <p>Empty or not-full tee times for <strong>${group.name}</strong> in the next 48 hours:</p>
      <ul>
        ${empties
          .map(
            (e) =>
              `<li>${e.name} – ${e.date.toDateString()} at ${e.teeTime} (${e.remaining} open)</li>`
          )
          .join('')}
      </ul>
    `;

    const subject = `Empty Tee Times – ${group.name}`;
    const resultSubs = await sendEmailToSubscribers(group._id, subject, html);
    const resultAdmins = await sendAdminEmail(subject, html);

    summary.push({
      groupId: group._id.toString(),
      groupName: group.name,
      empties: empties.length,
      sentToSubscribers: resultSubs.sent,
      sentToAdmins: resultAdmins.sent
    });
  }

  return { ok: true, summary };
}

function startRemindersScheduler() {
  // Run hourly and check if it's near the configured reminder hour.
  cron.schedule('0 * * * *', async () => {
    try {
      const settings = await findSettings();
      const now = new Date();
      if (now.getHours() === settings.dailyReminderHour) {
        console.log('Running scheduled empty tee reminders...');
        await runEmptyTeeReminders();
      }
    } catch (err) {
      console.error('Error in reminders scheduler:', err);
    }
  });
}

module.exports = {
  startRemindersScheduler,
  runEmptyTeeReminders
};
