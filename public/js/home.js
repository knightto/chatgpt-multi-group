async function resolveAccessCode(code) {
  const res = await fetch('/api/groups/resolve-access-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode: code })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to resolve access code');
  }

  return res.json();
}

document.addEventListener('DOMContentLoaded', () => {
  const accessInput = document.getElementById('accessCode');
  const msg = document.getElementById('accessMessage');
  const enterGroupBtn = document.getElementById('enterGroupBtn');
  const enterGroupAdminBtn = document.getElementById('enterGroupAdminBtn');
  const siteAdminBtn = document.getElementById('siteAdminBtn');

  function getAccessCode() {
    return accessInput.value.trim();
  }

  async function handleEnterGroup(isAdmin) {
    msg.textContent = '';
    const code = getAccessCode();
    if (!code) {
      msg.textContent = 'Enter your group access code.';
      return;
    }

    msg.textContent = 'Checking code...';

    try {
      const result = await resolveAccessCode(code);
      const groupId = result.groupId;

      if (!isAdmin) {
        // Normal player view
        window.location.href = `/group.html?groupId=${encodeURIComponent(groupId)}`;
        return;
      }

      // Group admin view – prompt for admin code and pass it through
      const adminCode = window.prompt('Enter site-wide admin code:');
      if (!adminCode) {
        msg.textContent = 'Admin entry cancelled.';
        return;
      }

      window.location.href =
        `/group-admin.html?groupId=${encodeURIComponent(groupId)}&code=${encodeURIComponent(adminCode)}`;
    } catch (err) {
      msg.textContent = err.message;
    }
  }

  enterGroupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleEnterGroup(false);
  });

  enterGroupAdminBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleEnterGroup(true);
  });

  // Optional: pressing Enter in the input enters as normal group member
  accessInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEnterGroup(false);
    }
  });

  // Site-wide admin dashboard (no group)
  siteAdminBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const adminCode = window.prompt('Enter site-wide admin code:');
    if (!adminCode) return;
    window.location.href = `/admin.html?code=${encodeURIComponent(adminCode)}`;
  });
});
