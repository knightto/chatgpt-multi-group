function getAdminCode() {
  return document.getElementById('adminCodeInput').value.trim();
}

async function adminApi(path, options = {}) {
  const code = getAdminCode();
  if (!code) {
    throw new Error('Enter admin code first.');
  }
  const url = path + (path.includes('?') ? '&' : '?') + 'code=' + encodeURIComponent(code);
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function renderGroupsTable(groups) {
  const wrap = document.getElementById('groupsTableWrap');
  console.log('Groups from API:', groups); // debug
  if (!groups.length) {
    wrap.textContent = 'No groups created yet.';
    return;
  }

  const rows = groups.map(g => {
    const status = g.isActive ? '<span class="tag">Active</span>' : '<span class="text-muted">Archived</span>';
    const created = g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '';
    const accessCode = (g.accessCode && String(g.accessCode)) || 'none';
    return `
      <tr data-group-id="${g._id}">
        <td>${g.name}</td>
        <td>${g.template}</td>
        <td><code>${accessCode}</code></td>
        <td>${created}</td>
        <td>${status}</td>
        <td>
          <button class="button" data-action="open-public" data-group-id="${g._id}">Open</button>
          <button class="button" data-action="open-group-admin" data-group-id="${g._id}" style="margin-left:4px;">Group Admin</button>
        </td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Template</th>
          <th>Access Code (share with players)</th>
          <th>Created</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function loadGroups() {
  const wrap = document.getElementById('groupsTableWrap');
  wrap.textContent = 'Loading groups...';
  try {
    const groups = await adminApi('/api/groups');
    renderGroupsTable(groups);
  } catch (err) {
    wrap.textContent = err.message;
  }
}

async function handleCreateGroup(e) {
  e.preventDefault();
  const msg = document.getElementById('createGroupMessage');
  msg.textContent = '';

  const name = document.getElementById('cgName').value.trim();
  const description = document.getElementById('cgDesc').value.trim();
  const template = document.getElementById('cgTemplate').value;
  const logoUrl = document.getElementById('cgLogo').value.trim();

  if (!name) {
    msg.textContent = 'Name is required.';
    return;
  }

  msg.textContent = 'Creating group...';

  try {
    await adminApi('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, template, logoUrl })
    });
    msg.textContent = 'Group created.';
    document.getElementById('cgName').value = '';
    document.getElementById('cgDesc').value = '';
    document.getElementById('cgLogo').value = '';
    await loadGroups();
  } catch (err) {
    msg.textContent = err.message;
  }
}

function renderSettings(settings) {
  const wrap = document.getElementById('settingsWrap');
  wrap.innerHTML = `
    <p class="text-muted">Configure global notification behavior.</p>
    <label>
      <input type="checkbox" id="setNotifications" ${settings.globalNotificationsEnabled ? 'checked' : ''} />
      Enable global notifications
    </label>
    <div class="mt-2">
      <label>
        Daily reminder hour (0–23)
        <input class="input" id="setHour" type="number" min="0" max="23" value="${settings.dailyReminderHour}" />
      </label>
    </div>
    <button class="button" id="saveSettingsBtn">Save Settings</button>
  `;

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const notifications = document.getElementById('setNotifications').checked;
    const hour = parseInt(document.getElementById('setHour').value, 10);
    try {
      const updated = await adminApi('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globalNotificationsEnabled: notifications,
          dailyReminderHour: hour
        })
      });
      renderSettings(updated);
    } catch (err) {
      alert(err.message);
    }
  });
}

async function loadSettings() {
  const wrap = document.getElementById('settingsWrap');
  wrap.textContent = 'Loading settings...';
  try {
    const settings = await adminApi('/api/admin/settings');
    renderSettings(settings);
  } catch (err) {
    wrap.textContent = err.message;
  }
}

async function runReminders() {
  const resultEl = document.getElementById('remindersResult');
  resultEl.textContent = 'Running empty tee reminders...';
  try {
    const data = await adminApi('/api/admin/reminders/empty-tee-times', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (data.skipped) {
      resultEl.textContent = 'Global notifications disabled; no reminders sent.';
    } else if (data.summary && data.summary.length) {
      const parts = data.summary.map(s => 
        `${s.groupName}: ${s.empties} empty tee times, ${s.sentToSubscribers} emails to subs, ${s.sentToAdmins} to admins`
      );
      resultEl.textContent = parts.join(' | ');
    } else {
      resultEl.textContent = 'No empty tee times found in the next 48 hours.';
    }
  } catch (err) {
    resultEl.textContent = err.message;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Pre-fill admin code from query string if present.
  const params = new URLSearchParams(window.location.search);
  const codeFromQuery = params.get('code');
  if (codeFromQuery) {
    document.getElementById('adminCodeInput').value = codeFromQuery;
  }

  document.getElementById('refreshGroupsBtn').addEventListener('click', (e) => {
    e.preventDefault();
    loadGroups();
  });

  document.getElementById('createGroupForm').addEventListener('submit', handleCreateGroup);
  document.getElementById('loadSettingsBtn').addEventListener('click', (e) => {
    e.preventDefault();
    loadSettings();
  });

  document.getElementById('runRemindersBtn').addEventListener('click', (e) => {
    e.preventDefault();
    runReminders();
  });

  // Delegate clicks on group actions
  const wrap = document.getElementById('groupsTableWrap');
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const groupId = btn.getAttribute('data-group-id');
    if (!groupId) return;

    const code = getAdminCode();
    if (!code) {
      alert('Enter admin code at the top first.');
      return;
    }

    if (action === 'open-public') {
      window.open(`/group.html?groupId=${encodeURIComponent(groupId)}`, '_blank');
    } else if (action === 'open-group-admin') {
      window.open(`/group-admin.html?groupId=${encodeURIComponent(groupId)}&code=${encodeURIComponent(code)}`, '_blank');
    }
  });
});
