// ----------------------------
// Configuration
// ----------------------------
const TOKEN_SERVER_URL = 'https://YOUR-WORKER.example.com/ably-token'; // replace after you deploy

// Ably channels
const CHANNEL_PROFILES = 'kidcoin:profiles';
const CHANNEL_TX = 'kidcoin:transactions';
const CHANNEL_ACTIVITY = 'kidcoin:activity';

// Local state
let ablyRealtime = null;
let txChannel = null;
let profilesChannel = null;
let activityChannel = null;
let currentUser = null; // { username, password, pic, coins, bio, contacts, settings }

// ----------------------------
// Utilities
// ----------------------------
function $(id) { return document.getElementById(id); }

function toast(msg) {
  console.log('[toast]', msg);
  // Simple inline toast
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.position = 'fixed';
  el.style.bottom = '16px';
  el.style.left = '50%';
  el.style.transform = 'translateX(-50%)';
  el.style.background = 'rgba(0,0,0,0.7)';
  el.style.color = 'white';
  el.style.padding = '10px 14px';
  el.style.borderRadius = '10px';
  el.style.zIndex = 9999;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function persistUser() {
  if (!currentUser) return;
  localStorage.setItem('kidcoin:user', JSON.stringify(currentUser));
}

function loadPersistedUser() {
  const raw = localStorage.getItem('kidcoin:user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function applyTheme(theme) {
  document.documentElement.classList.remove('theme-light', 'theme-mint');
  document.documentElement.classList.toggle('theme-light', theme === 'light');
  document.documentElement.classList.toggle('theme-mint', theme === 'mint');
}

// ----------------------------
// Ably connection (token auth)
// ----------------------------
async function connectAbly() {
  const res = await fetch(TOKEN_SERVER_URL);
  if (!res.ok) throw new Error('Token server error');
  const tokenDetails = await res.json();

  ablyRealtime = new Ably.Realtime.Promise({ tokenDetails });
  await ablyRealtime.connection.once('connected');

  profilesChannel = ablyRealtime.channels.get(CHANNEL_PROFILES);
  txChannel = ablyRealtime.channels.get(CHANNEL_TX);
  activityChannel = ablyRealtime.channels.get(CHANNEL_ACTIVITY);

  // Subscribe to updates
  profilesChannel.subscribe('profile:update', onProfileUpdate);
  txChannel.subscribe('transfer', onTransferEvent);
  activityChannel.subscribe('log', onActivityLog);
}

// ----------------------------
// Event handlers
// ----------------------------
function onProfileUpdate(msg) {
  const { username, profile } = msg.data;
  if (currentUser && username === currentUser.username) {
    currentUser = { ...currentUser, ...profile };
    renderDashboard();
    persistUser();
  }
}

function onTransferEvent(msg) {
  const { from, to, amount } = msg.data;
  if (!currentUser) return;
  if (currentUser.username === from) {
    currentUser.coins = Math.max(0, (currentUser.coins || 0) - amount);
    persistUser(); renderDashboard();
  } else if (currentUser.username === to) {
    currentUser.coins = (currentUser.coins || 0) + amount;
    persistUser(); renderDashboard();
  }
  addActivityItem(`${from} sent ${amount} KC to ${to}`);
}

function onActivityLog(msg) {
  addActivityItem(msg.data.text);
}

function addActivityItem(text) {
  const li = document.createElement('li');
  li.textContent = text;
  $('activity-list').prepend(li);
}

// ----------------------------
// Views & navigation
// ----------------------------
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function initNav() {
  $('nav-dashboard').onclick = () => showView('view-dashboard');
  $('nav-profile').onclick = () => showView('view-profile');
  $('nav-transfer').onclick = () => showView('view-transfer');
  $('nav-settings').onclick = () => showView('view-settings');
}

// ----------------------------
// Auth & account
// ----------------------------
function initAuth() {
  const saved = loadPersistedUser();
  if (saved) {
    currentUser = saved;
    applyTheme(currentUser?.settings?.theme || 'dark');
    renderDashboard();
    showView('view-dashboard');
  } else {
    showView('view-auth');
  }

  $('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('signup-username').value.trim();
    const password = $('signup-password').value.trim();
    const pic = $('signup-pic').value.trim();
    if (!username || !password) return toast('Username and password required.');

    // Create account (client-side bootstrap + publish)
    currentUser = {
      username, password, pic: pic || '', coins: 500,
      bio: '', contacts: { email: '', phone: '' },
      settings: { theme: 'dark', showEmail: false, showPhone: false, sound: true },
    };
    persistUser();
    await publishProfile(currentUser.username, currentUser);
    toast('Account created. Welcome!');
    renderDashboard();
    showView('view-dashboard');
  });

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('login-username').value.trim();
    const password = $('login-password').value.trim();
    if (!username || !password) return toast('Enter username and password.');

    // Minimal check: fetch profile snapshot by username via channel history
    // In a real app, you’d validate on a secure backend.
    currentUser = loadPersistedUser();
    if (currentUser && currentUser.username === username && currentUser.password === password) {
      toast('Welcome back!');
    } else {
      // If not previously saved on this device, create a simple local record
      currentUser = { username, password, pic: '', coins: 500, bio: '', contacts: { email: '', phone: '' },
        settings: { theme: 'dark', showEmail: false, showPhone: false, sound: true } };
      persistUser();
      await publishProfile(username, currentUser);
      toast('New local login created.');
    }
    applyTheme(currentUser.settings.theme);
    renderDashboard();
    showView('view-dashboard');
  });
}

function renderDashboard() {
  if (!currentUser) return;
  $('dash-username').textContent = currentUser.username;
  $('dash-bio').textContent = currentUser.bio || 'No bio yet.';
  $('dash-balance').textContent = currentUser.coins ?? 0;
  const pic = currentUser.pic || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(currentUser.username);
  $('dash-pic').src = pic;
}

// ----------------------------
// Profiles
// ----------------------------
async function publishProfile(username, profile) {
  if (!profilesChannel) return;
  await profilesChannel.publish('profile:update', { username, profile });
  await activityChannel.publish('log', { text: `${username} updated their profile.` });
}

function initProfile() {
  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    currentUser.bio = $('profile-bio').value.trim();
    currentUser.contacts.email = $('profile-email').value.trim();
    currentUser.contacts.phone = $('profile-phone').value.trim();
    currentUser.pic = $('profile-pic').value.trim() || currentUser.pic;
    persistUser();
    await publishProfile(currentUser.username, currentUser);
    renderDashboard();
    toast('Profile saved.');
  });

  // Pre-fill
  const u = loadPersistedUser();
  if (u) {
    $('profile-bio').value = u.bio || '';
    $('profile-email').value = u.contacts?.email || '';
    $('profile-phone').value = u.contacts?.phone || '';
    $('profile-pic').value = u.pic || '';
  }

  $('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('search-username').value.trim();
    if (!q) return;
    // This demo shows last-seen profile updates; real apps would store profiles in a DB or KV.
    $('search-result').innerHTML = `<p class="muted">Searching "${q}"… (listens for updates)</p>`;
  });
}

// ----------------------------
// Transfers
// ----------------------------
function initTransfer() {
  $('transfer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return toast('Please log in first.');
    const to = $('transfer-to').value.trim();
    const amount = parseInt($('transfer-amount').value, 10);

    if (!to || !Number.isFinite(amount) || amount <= 0) return toast('Enter a valid amount.');
    if (to === currentUser.username) return toast('You cannot send to yourself.');
    if ((currentUser.coins || 0) < amount) return toast('Not enough KidCoin.');

    // Publish transfer
    await txChannel.publish('transfer', { from: currentUser.username, to, amount });

    // Optimistic local update
    currentUser.coins = (currentUser.coins || 0) - amount;
    persistUser(); renderDashboard();
    await activityChannel.publish('log', { text: `${currentUser.username} sent ${amount} KC to ${to}` });

    if (currentUser.settings?.sound) {
      const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=');
      a.play().catch(() => {});
    }
    toast(`Sent ${amount} KC to ${to}.`);
    $('transfer-form').reset();
  });
}

// ----------------------------
// Settings
// ----------------------------
function initSettings() {
  // Load saved
  const themeInputs = document.querySelectorAll('input[name="theme"]');
  const theme = (currentUser?.settings?.theme) || 'dark';
  themeInputs.forEach(i => { i.checked = i.value === theme; });

  $('settings-show-email').checked = !!currentUser?.settings?.showEmail;
  $('settings-show-phone').checked = !!currentUser?.settings?.showPhone;
  $('settings-sound').checked = currentUser?.settings?.sound !== false;

  themeInputs.forEach(input => {
    input.addEventListener('change', () => applyTheme(input.value));
  });

  $('settings-save').addEventListener('click', async () => {
    const selectedTheme = document.querySelector('input[name="theme"]:checked')?.value || 'dark';
    currentUser.settings = {
      theme: selectedTheme,
      showEmail: $('settings-show-email').checked,
      showPhone: $('settings-show-phone').checked,
      sound: $('settings-sound').checked,
    };
    applyTheme(selectedTheme);
    persistUser();
    await publishProfile(currentUser.username, currentUser);
    toast('Settings saved.');
  });
}

// ----------------------------
// Boot
// ----------------------------
(async function boot() {
  initNav();
  initAuth();
  initProfile();
  initTransfer();
  initSettings();

  try {
    await connectAbly();
  } catch (err) {
    console.error(err);
    toast('Could not connect to realtime. Token server unavailable.');
  }
})();
