// ----------------------------
// Utilities
// ----------------------------
function $(id) { return document.getElementById(id); }

function toast(msg) {
  alert(msg); // simple alert for now, you can replace with a nicer toast later
}

function persistUser(user) {
  localStorage.setItem('kidcoin:user', JSON.stringify(user));
}

function loadUser() {
  const raw = localStorage.getItem('kidcoin:user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function applyTheme(theme) {
  document.documentElement.classList.remove('theme-light', 'theme-mint');
  if (theme === 'light') document.documentElement.classList.add('theme-light');
  if (theme === 'mint') document.documentElement.classList.add('theme-mint');
}

// ----------------------------
// Global state
// ----------------------------
let currentUser = null;

// ----------------------------
// Views
// ----------------------------
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $(id).classList.remove('hidden');
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
// Auth
// ----------------------------
function initAuth() {
  const saved = loadUser();
  if (saved) {
    currentUser = saved;
    applyTheme(currentUser.settings?.theme || 'dark');
    renderDashboard();
    showView('view-dashboard');
  } else {
    showView('view-auth');
  }

  $('signup-form').addEventListener('submit', (e) => {
    e.preventDefault(); // stop reload
    const username = $('signup-username').value.trim();
    const password = $('signup-password').value.trim();
    const fileInput = $('signup-pic');
    let picData = '';

    if (fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        picData = evt.target.result;
        createAccount(username, password, picData);
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      createAccount(username, password, '');
    }
  });

  $('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = $('login-username').value.trim();
    const password = $('login-password').value.trim();
    const saved = loadUser();
    if (saved && saved.username === username && saved.password === password) {
      currentUser = saved;
      toast('Welcome back!');
      applyTheme(currentUser.settings?.theme || 'dark');
      renderDashboard();
      showView('view-dashboard');
    } else {
      toast('No matching account found on this device.');
    }
  });
}

function createAccount(username, password, pic) {
  if (!username || !password) {
    toast('Username and password required.');
    return;
  }
  currentUser = {
    username,
    password,
    pic,
    coins: 500,
    bio: '',
    contacts: { email: '', phone: '' },
    settings: { theme: 'dark', showEmail: false, showPhone: false, sound: true }
  };
  persistUser(currentUser);
  toast('Account created. Welcome!');
  renderDashboard();
  showView('view-dashboard');
}

// ----------------------------
// Profile
// ----------------------------
function initProfile() {
  $('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentUser) return;
    currentUser.bio = $('profile-bio').value.trim();
    currentUser.contacts.email = $('profile-email').value.trim();
    currentUser.contacts.phone = $('profile-phone').value.trim();

    const fileInput = $('profile-pic');
    if (fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        currentUser.pic = evt.target.result;
        persistUser(currentUser);
        renderDashboard();
        toast('Profile saved.');
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      persistUser(currentUser);
      renderDashboard();
      toast('Profile saved.');
    }
  });
}

// ----------------------------
// Transfer
// ----------------------------
function initTransfer() {
  $('transfer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentUser) return toast('Please log in first.');
    const to = $('transfer-to').value.trim();
    const amount = parseInt($('transfer-amount').value, 10);

    if (!to || !Number.isFinite(amount) || amount <= 0) return toast('Enter a valid amount.');
    if (to === currentUser.username) return toast('You cannot send to yourself.');
    if ((currentUser.coins || 0) < amount) return toast('Not enough KidCoin.');

    // For now, just deduct locally
    currentUser.coins -= amount;
    persistUser(currentUser);
    renderDashboard();
    toast(`Sent ${amount} KC to ${to}.`);
    $('transfer-form').reset();
  });
}

// ----------------------------
// Settings
// ----------------------------
function initSettings() {
  $('settings-save').addEventListener('click', () => {
    const selectedTheme = document.querySelector('input[name="theme"]:checked')?.value || 'dark';
    currentUser.settings = {
      theme: selectedTheme,
      showEmail: $('settings-show-email').checked,
      showPhone: $('settings-show-phone').checked,
      sound: $('settings-sound').checked,
    };
    applyTheme(selectedTheme);
    persistUser(currentUser);
    toast('Settings saved.');
  });
}

// ----------------------------
// Navigation
// ----------------------------
function initNav() {
  $('nav-dashboard').onclick = () => showView('view-dashboard');
  $('nav-profile').onclick = () => showView('view-profile');
  $('nav-transfer').onclick = () => showView('view-transfer');
  $('nav-settings').onclick = () => showView('view-settings');
}

// ----------------------------
// Boot
// ----------------------------
(function boot() {
  initNav();
  initAuth();
  initProfile();
  initTransfer();
  initSettings();
})();
