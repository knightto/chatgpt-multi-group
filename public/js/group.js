const groupParams = new URLSearchParams(window.location.search);
const groupId = groupParams.get('groupId');

async function loadGroup() {
  const nameEl = document.getElementById('groupName');
  const descEl = document.getElementById('groupDesc');

  if (!groupId) {
    nameEl.textContent = 'Group not specified';
    descEl.textContent = 'Missing groupId in URL.';
    document.getElementById('eventsContainer').textContent = '';
    return;
  }

  try {
    const res = await fetch('/api/groups/' + encodeURIComponent(groupId));
    if (!res.ok) throw new Error('Group not found');
    const group = await res.json();
    nameEl.textContent = group.name || 'Group';
    descEl.textContent = group.description || '';
  } catch (err) {
    nameEl.textContent = 'Error loading group';
    descEl.textContent = err.message;
  }
}

function renderEvents(events) {
  const container = document.getElementById('eventsContainer');
  if (!events.length) {
    container.textContent = 'No upcoming events.';
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
      `;

      if (ev.type === 'teeTime' && Array.isArray(ev.teeTimes) && ev.teeTimes.length) {
        body += `
          <div class="mt-2">
            <strong>Tee Times</strong>
            <table class="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Players</th>
                  <th>Open Spots</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${ev.teeTimes
                  .map((tt) => {
                    const players = tt.players || [];
                    const cap = tt.capacity || 4;
                    const open = cap - players.length;
                    const names = players.map((p) => p.name).join(', ') || '—';
                    return `
                      <tr>
                        <td>${tt.time}</td>
                        <td>${names}</td>
                        <td>${open}</td>
                        <td>
                          ${
                            open > 0
                              ? `<button class="button" data-action="join-tee" data-event-id="${ev._id}" data-tee-id="${tt._id}">Join</button>`
                              : ''
                          }
                        </td>
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

  container.innerHTML = html;
}

async function loadEvents() {
  const container = document.getElementById('eventsContainer');
  if (!groupId) return;
  container.textContent = 'Loading events...';

  try {
    const res = await fetch('/api/groups/' + encodeURIComponent(groupId) + '/events');
    if (!res.ok) throw new Error('Failed to load events');
    const events = await res.json();
    renderEvents(events);
  } catch (err) {
    container.textContent = err.message;
  }
}

async function joinTeeTime(eventId, teeTimeId) {
  const name = window.prompt('Your name:');
  if (!name) return;
  const email = window.prompt('Your email:');
  if (!email) return;

  try {
    const res = await fetch(
      `/api/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}/tee-times/${encodeURIComponent(teeTimeId)}/players`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || 'Failed to join tee time');
      return;
    }
    await loadEvents();
  } catch (err) {
    alert(err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadGroup();
  loadEvents();

  const container = document.getElementById('eventsContainer');
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="join-tee"]');
    if (!btn) return;
    const eventId = btn.getAttribute('data-event-id');
    const teeTimeId = btn.getAttribute('data-tee-id');
    if (!eventId || !teeTimeId) return;
    joinTeeTime(eventId, teeTimeId);
  });
});
