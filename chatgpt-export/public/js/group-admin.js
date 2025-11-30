const gaParams = new URLSearchParams(window.location.search);
const gaGroupId = gaParams.get('groupId');
const gaAdminCode = gaParams.get('code') || '';

function getGaAdminCode() {
  return gaAdminCode;
}

async function gaAdminApi(path, options = {}) {
  const code = getGaAdminCode();
  if (!code) {
    throw new Error('Admin code missing in URL.');
  }
  const url = path + (path.includes('?') ? '&' : '?') + 'code=' + encodeURIComponent(code);
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadGaGroup() {
  const nameEl = document.getElementById('gaGroupName');
  const descEl = document.getElementById('gaGroupDesc');
  const infoEl = document.getElementById('groupInfo');

  if (!gaGroupId) {
    nameEl.textContent = 'Group not specified';
    infoEl.textContent = 'Missing groupId in URL.';
    return;
  }

  try {
    const res = await fetch('/api/groups/' + encodeURIComponent(gaGroupId));
    if (!res.ok) throw new Error('Group not found');
    const group = await res.json();
    nameEl.textContent = group.name || 'Group Admin';
    descEl.textContent = group.description || '';
    const accessCode = group.accessCode || 'none';
    infoEl.innerHTML = `
      <p><strong>Name:</strong> ${group.name}</p>
      <p><strong>Description:</strong> ${group.description || ''}</p>
      <p><strong>Access Code:</strong> <code>${accessCode}</code></p>
    `;
  } catch (err) {
    infoEl.textContent = err.message;
  }
}

function renderGaEvents(events) {
  const wrap = document.getElementById('adminEvents');
  if (!events.length) {
    wrap.textContent = 'No upcoming events.';
    return;
  }

  const html = events
    .map((ev) => {
      const dateStr = ev.date ? new Date(ev.date).toLocaleString() : '';
      let body = `
        <div class="event-header">
          <h3>${ev.name}</h3>
          <div class="text-muted">${dateStr} – ${ev.type}</div>
        </div>
        <p class="text-muted">${ev.description || ''}</p>
        <div class="mt-1">
          <button class="button" data-action="delete-event" data-event-id="${ev._id}">Delete Event</button>
      `;

      if (ev.type === 'teeTime') {
        body += `
          <button class="button" data-action="auto-tee" data-event-id="${ev._id}" style="margin-left:4px;">Auto Tee Times</button>
        `;
      }

      body += '</div>';

      if (ev.type === 'teeTime' && Array.isArray(ev.teeTimes) && ev.teeTimes.length) {
        body += `
          <div class="mt-2">
            <strong>Tee Times</strong>
            <table class="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Players</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                ${ev.teeTimes
                  .map((tt) => {
                    const players = tt.players || [];
                    const names = players.map((p) => p.name).join(', ') || '—';
                    const cap = tt.capacity || 4;
                    return `
                      <tr>
                        <td>${tt.time}</td>
                        <td>${names}</td>
                        <td>${cap}</td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      return `<article class="event-card">${body}</article>`;
    })
    .join('');

  wrap.innerHTML = html;
}

async function loadGaEvents() {
  const wrap = document.getElementById('adminEvents');
  if (!gaGroupId) return;
  wrap.textContent = 'Loading events...';

  try {
    const res = await fetch('/api/groups/' + encodeURIComponent(gaGroupId) + '/events');
    if (!res.ok) throw new Error('Failed to load events');
    const events = await res.json();
    renderGaEvents(events);
  } catch (err) {
    wrap.textContent = err.message;
  }
}

async function handleCreateEvent(e) {
  e.preventDefault();
  const msg = document.getElementById('createEventMessage');
  msg.textContent = '';

  const name = document.getElementById('evName').value.trim();
  const dateInput = document.getElementById('evDate').value;
  const type = document.getElementById('evType').value;
  const description = document.getElementById('evDesc').value.trim();
  const teamSize = parseInt(document.getElementById('evTeamSize').value || '4', 10);
  const startType = document.getElementById('evStartType').value.trim() || 'straight';

  if (!name || !dateInput) {
    msg.textContent = 'Name and date are required.';
    return;
  }

  const isoDate = new Date(dateInput).toISOString();

  try {
    await gaAdminApi('/api/groups/' + encodeURIComponent(gaGroupId) + '/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        date: isoDate,
        type,
        description,
        teamSize,
        startType
      })
    });
    msg.textContent = 'Event created.';
    document.getElementById('createEventForm').reset();
    document.getElementById('evTeamSize').value = '4';
    document.getElementById('evStartType').value = 'straight';
    await loadGaEvents();
  } catch (err) {
    msg.textContent = err.message;
  }
}

async function deleteEvent(eventId) {
  if (!window.confirm('Delete this event?')) return;
  try {
    await gaAdminApi('/api/groups/' + encodeURIComponent(gaGroupId) + '/events/' + encodeURIComponent(eventId), {
      method: 'DELETE'
    });
    await loadGaEvents();
  } catch (err) {
    alert(err.message);
  }
}

async function autoTeeTimes(eventId) {
  const startTime = window.prompt('First tee time (HH:MM, 24h, e.g. 08:00):');
  if (!startTime) return;
  const interval = window.prompt('Interval between groups (minutes, e.g. 10):', '10');
  if (!interval) return;
  const count = window.prompt('Number of tee times (e.g. 6):', '6');
  if (!count) return;
  const capacity = window.prompt('Players per tee time (e.g. 4):', '4');
  if (!capacity) return;

  try {
    await gaAdminApi('/api/groups/' + encodeURIComponent(gaGroupId) + '/events/' + encodeURIComponent(eventId) + '/tee-times/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startTime,
        intervalMinutes: parseInt(interval, 10),
        count: parseInt(count, 10),
        capacity: parseInt(capacity, 10)
      })
    });
    await loadGaEvents();
  } catch (err) {
    alert(err.message);
  }
}

async function runGroupReminders() {
  const out = document.getElementById('groupRemindersResult');
  out.textContent = 'Running reminders for this group...';
  try {
    const data = await gaAdminApi('/api/admin/reminders/empty-tee-times', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: gaGroupId })
    });
    if (data.skipped) {
      out.textContent = 'Global notifications disabled; no reminders sent.';
    } else if (data.summary && data.summary.length) {
      const s = data.summary[0];
      out.textContent = `${s.groupName}: ${s.empties} empty tee times, ${s.sentToSubscribers} emails to subs, ${s.sentToAdmins} to admins`;
    } else {
      out.textContent = 'No empty tee times found in the next 48 hours.';
    }
  } catch (err) {
    out.textContent = err.message;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadGaGroup();
  loadGaEvents();

  document.getElementById('createEventForm').addEventListener('submit', handleCreateEvent);

  document.getElementById('runGroupRemindersBtn').addEventListener('click', (e) => {
    e.preventDefault();
    runGroupReminders();
  });

  const eventsWrap = document.getElementById('adminEvents');
  eventsWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const eventId = btn.getAttribute('data-event-id');
    if (!eventId) return;

    if (action === 'delete-event') {
      deleteEvent(eventId);
    } else if (action === 'auto-tee') {
      autoTeeTimes(eventId);
    }
  });
});
