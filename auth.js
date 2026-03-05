const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDZgnhLpAF7zWOd2_lcaME2P0bGuATZqoY",
    authDomain: "chessie-b9e02.firebaseapp.com",
    projectId: "chessie-b9e02",
    storageBucket: "chessie-b9e02.firebasestorage.app",
    messagingSenderId: "913442727053",
    appId: "1:913442727053:web:a9a9336092e22786fe6ec4"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentProfile = null;
let friendsData = [];
let pendingData = [];
let friendsUnsub = null;
let challengeUnsub = null;
let challengeDocUnsub = null;
let activeToasts = new Set();
let randomSearchUnsub = null;
let presenceInterval = null;

function startPresence() {
    stopPresence();
    updatePresence(true);
    presenceInterval = setInterval(() => {
        if (!document.hidden) updatePresence(true);
    }, 30000);
    document.addEventListener('visibilitychange', handleVisibility);
}

function stopPresence() {
    if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
    document.removeEventListener('visibilitychange', handleVisibility);
}

function handleVisibility() {
    if (!currentUser) return;
    if (document.hidden) {
        updatePresence(false);
    } else {
        updatePresence(true);
        if (presenceInterval) clearInterval(presenceInterval);
        presenceInterval = setInterval(() => {
            if (!document.hidden) updatePresence(true);
        }, 30000);
    }
}

function updatePresence(online) {
    if (!currentUser) return;
    db.collection('users').doc(currentUser.uid).update({
        online: online,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
}

// FIX: Only check lastSeen timestamp - don't trust the online boolean
function isUserOnline(data) {
    if (!data.lastSeen) return false;
    let ms = 0;
    if (data.lastSeen.toMillis) ms = data.lastSeen.toMillis();
    else if (typeof data.lastSeen === 'number') ms = data.lastSeen;
    else if (data.lastSeen.seconds) ms = data.lastSeen.seconds * 1000;
    if (!ms) return false;
    return (Date.now() - ms < 90000);
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const snap = await db.collection('users').doc(user.uid).get();
            if (snap.exists) currentProfile = snap.data();
        } catch (e) { }
        startPresence();
        updateAccountUI(true);
        startFriendsListener();
        startChallengeListener();
    } else {
        currentUser = null;
        currentProfile = null;
        stopPresence();
        if (friendsUnsub) { friendsUnsub(); friendsUnsub = null; }
        if (challengeUnsub) { challengeUnsub(); challengeUnsub = null; }
        if (challengeDocUnsub) { challengeDocUnsub(); challengeDocUnsub = null; }
        updateAccountUI(false);
    }
    hideAuthLoading();
});

window.addEventListener('beforeunload', () => {
    if (currentUser) {
        try {
            navigator.sendBeacon(
                `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/users/${currentUser.uid}?updateMask.fieldPaths=online`,
                new Blob([JSON.stringify({ fields: { online: { booleanValue: false } } })], { type: 'application/json' })
            );
        } catch (e) {}
        db.collection('users').doc(currentUser.uid)
            .update({ online: false, lastSeen: firebase.firestore.FieldValue.serverTimestamp() })
            .catch(() => {});
    }
});

window.addEventListener('pagehide', () => {
    if (currentUser) updatePresence(false);
});

function updateAccountUI(loggedIn) {
    const label = document.getElementById('account-btn-label');
    const btn = document.getElementById('account-btn');
    const authRow = document.getElementById('start-auth-row');
    const welcomeEl = document.getElementById('start-welcome');
    const welcomeName = document.getElementById('start-welcome-name');
    const startSub = document.getElementById('start-sub');
    if (loggedIn && currentProfile) {
        label.textContent = currentProfile.username;
        btn.classList.add('logged-in');
        if (authRow) authRow.style.display = 'none';
        if (welcomeEl) welcomeEl.style.display = '';
        if (welcomeName) welcomeName.textContent = 'Welcome, ' + currentProfile.username + '!';
        if (startSub) startSub.textContent = 'Choose how to play';
        const cheatBtn = document.getElementById('cheat-plus-btn');
        if (cheatBtn) cheatBtn.style.display = (currentProfile.username.toLowerCase() === 'dom') ? 'flex' : 'none';
    } else {
        label.textContent = 'Sign In';
        btn.classList.remove('logged-in');
        if (authRow) authRow.style.display = '';
        if (welcomeEl) welcomeEl.style.display = 'none';
        const cheatBtn = document.getElementById('cheat-plus-btn');
        if (cheatBtn) cheatBtn.style.display = 'none';
    }
}

const _origOpenOnlineMenu = window.openOnlineMenu;
window.openOnlineMenu = function () {
    _origOpenOnlineMenu.apply(this, arguments);
    if (currentProfile) {
        const el = document.getElementById('ol-name');
        if (el) el.value = currentProfile.username;
    }
    const cornerBtn = document.getElementById('ol-friends-corner-btn');
    if (cornerBtn) cornerBtn.style.display = currentUser ? '' : 'none';
    const popup = document.getElementById('ol-friends-popup');
    if (popup) popup.classList.remove('open');
};

function toggleOlFriendsPopup() {
    const popup = document.getElementById('ol-friends-popup');
    if (!popup) return;
    const isOpen = popup.classList.toggle('open');
    if (isOpen) renderOlFriendsList();
}

function renderOlFriendsList() {
    const listEl = document.getElementById('ol-fp-list');
    if (!listEl) return;

    const buildItem = (f) => {
        const avatarHtml = f.avatar ?
            `<div class="fp-avatar" style="background-image:url(${f.avatar});background-size:cover;background-position:center;background-color:transparent;color:transparent;">${f.username[0].toUpperCase()}</div>` :
            `<div class="fp-avatar">${f.username[0].toUpperCase()}</div>`;

        // FIX: Can't spectate own game
        let actionBtn;
        if (f.activeMatch) {
            const isOwnGame = currentUser && f.uid === currentUser.uid;
            if (isOwnGame) {
                actionBtn = `<span class="fp-pill pending">Your Game</span>`;
            } else {
                actionBtn = `<button class="fp-btn fp-challenge" onclick="spectateMatch('${aEsc(f.activeMatch)}')">\uD83D\uDC41 Watch</button>`;
            }
        } else {
            actionBtn = `<button class="fp-btn fp-challenge" onclick="challengeFriend('${f.uid}','${aEsc(f.username)}')">\u2694 Play</button>`;
        }

        const statusText = f.activeMatch ? '\uD83D\uDFE2 In Match' : (f.online ? '\u25cf Online' : '\u25cb Offline');
        const statusClass = (f.activeMatch || f.online) ? 'is-online' : '';

        return `
        <div class="ol-friend-item">
            <div class="ol-friend-info">
                ${avatarHtml}
                <div>
                    <div class="fp-friend-name">${hEsc(f.username)}</div>
                    <div class="fp-online-dot ${statusClass}">${statusText}</div>
                </div>
            </div>
            ${actionBtn}
        </div>`;
    };

    if (friendsData.length === 0) {
        listEl.innerHTML = '<div class="fp-empty">No friends yet. Search above!</div>';
        return;
    }
    listEl.innerHTML = friendsData.map(buildItem).join('');

    const uids = friendsData.map(f => f.uid);
    const chunks = [];
    for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
    chunks.forEach(chunk => {
        db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get()
            .then(snap => {
                snap.forEach(doc => {
                    const f = friendsData.find(fr => fr.uid === doc.id);
                    if (f) {
                        f.online = isUserOnline(doc.data());
                        if (doc.data().avatar) f.avatar = doc.data().avatar;
                        f.activeMatch = doc.data().activeMatch || null;
                    }
                });
                listEl.innerHTML = friendsData.map(buildItem).join('');
            }).catch(() => { });
    });
}

let olSearchTimer = null;
function onOlFriendSearch() {
    clearTimeout(olSearchTimer);
    const q = document.getElementById('ol-fp-search').value.trim();
    const resEl = document.getElementById('ol-fp-search-result');
    if (!q) { resEl.style.display = 'none'; return; }
    olSearchTimer = setTimeout(() => olSearchUser(q), 400);
}

async function olSearchUser(uq) {
    var el = document.getElementById('ol-fp-search-result');
    el.style.display = '';
    el.innerHTML = '<div class="fp-searching">Searching\u2026</div>';
    try {
        var prefix = uq.toLowerCase();
        var end = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
        var snap = await db.collection('users').where('usernameLower', '>=', prefix).where('usernameLower', '<', end).limit(8).get();
        if (snap.empty) { el.innerHTML = '<div class="fp-no-result">No users found</div>'; return; }
        var html = '';
        for (var i = 0; i < snap.docs.length; i++) {
            var doc = snap.docs[i];
            var uid = doc.id, uname = doc.data().username;
            if (currentUser && uid === currentUser.uid) continue;
            var fid = [currentUser.uid, uid].sort().join('_');
            var fDoc = await db.collection('friends').doc(fid).get();
            var action = '';
            if (fDoc.exists) {
                var st = fDoc.data().status;
                if (st === 'accepted') action = '<button class="fp-btn fp-challenge" onclick="challengeFriend(\'' + uid + '\',\'' + aEsc(uname) + '\')">⚔ Play</button>';
                else if (fDoc.data().requester === currentUser.uid) action = '<span class="fp-pill pending">Sent</span>';
                else action = '<button class="fp-btn fp-accept" onclick="acceptFriendReq(\'' + fDoc.id + '\')">✓ Accept</button>';
            } else {
                action = '<button class="fp-btn fp-add" onclick="sendFriendRequest(\'' + uid + '\',\'' + aEsc(uname) + '\')">+ Add</button>';
            }
            var avatarHtml = doc.data().avatar ?
                '<div class="fp-avatar" style="background-image:url(' + doc.data().avatar + ');background-size:cover;background-position:center;background-color:transparent;color:transparent;">' + uname[0].toUpperCase() + '</div>' :
                '<div class="fp-avatar">' + uname[0].toUpperCase() + '</div>';
            html += '<div class="fp-search-card" style="margin-bottom:4px;cursor:pointer;" onclick="showUserProfile(\'' + uid + '\')"><div class="fp-friend-info">' + avatarHtml + '<span class="fp-friend-name">' + hEsc(uname) + '</span></div>' + action + '</div>';
        }
        el.innerHTML = html || '<div class="fp-no-result">No users found</div>';
    } catch (e) { el.innerHTML = '<div class="fp-no-result">Error. Try again.</div>'; }
}

function toggleAccountPanel() {
    if (currentUser) openFriendsPanel();
    else openAuthPanel();
}

let authTab = 'login';
function openAuthPanel() { document.getElementById('auth-overlay').classList.add('open'); showAuthTab('login'); }
function closeAuthPanel() { document.getElementById('auth-overlay').classList.remove('open'); clearAuthError(); }
function showAuthTab(tab) { authTab = tab; document.getElementById('auth-login-form').style.display = tab === 'login' ? '' : 'none'; document.getElementById('auth-signup-form').style.display = tab === 'signup' ? '' : 'none'; document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); clearAuthError(); }
function setAuthError(msg) { const e = document.getElementById('auth-error'); e.textContent = msg; e.style.display = msg ? '' : 'none'; }
function clearAuthError() { setAuthError(''); }
function showAuthLoading() { document.getElementById('auth-loading-overlay').classList.add('active'); }
function hideAuthLoading() { document.getElementById('auth-loading-overlay').classList.remove('active'); }

async function doLogin() {
    let identity = document.getElementById('login-identity').value.trim();
    const pass = document.getElementById('login-password').value;
    if (!identity || !pass) { setAuthError('Please fill in all fields.'); return; }
    const btn = document.getElementById('auth-login-btn');
    btn.disabled = true; btn.textContent = 'Signing in\u2026'; showAuthLoading();
    try {
        let email = identity;
        if (!identity.includes('@')) {
            const uSnap = await db.collection('usernames').doc(identity.toLowerCase()).get();
            if (!uSnap.exists) { setAuthError('No account with that username.'); btn.disabled = false; btn.textContent = 'Sign In'; hideAuthLoading(); return; }
            const userDoc = await db.collection('users').doc(uSnap.data().uid).get();
            email = (userDoc.exists && userDoc.data().email) ? userDoc.data().email : identity.toLowerCase() + '@chessie.local';
        }
        await auth.signInWithEmailAndPassword(email, pass);
        hideAuthLoading(); closeAuthPanel(); showLoginSuccess();
    } catch (e) { hideAuthLoading(); setAuthError(friendlyError(e.code, e.message)); }
    btn.disabled = false; btn.textContent = 'Sign In';
}

async function doSignUp() {
    const username = document.getElementById('signup-username').value.trim();
    const emailRaw = document.getElementById('signup-email').value.trim();
    const pass = document.getElementById('signup-password').value;
    if (!username || !pass) { setAuthError('Username and password are required.'); return; }
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) { setAuthError('Username: 3-16 chars, letters/numbers/underscore.'); return; }
    if (pass.length < 6) { setAuthError('Password must be at least 6 characters.'); return; }
    const email = emailRaw || (username.toLowerCase() + '@chessie.local');
    const btn = document.getElementById('auth-signup-btn');
    btn.disabled = true; btn.textContent = 'Creating\u2026'; showAuthLoading();
    try {
        const uSnap = await db.collection('usernames').doc(username.toLowerCase()).get();
        if (uSnap.exists) { setAuthError('Username already taken.'); btn.disabled = false; btn.textContent = 'Create Account'; hideAuthLoading(); return; }
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        const batch = db.batch();
        batch.set(db.collection('users').doc(cred.user.uid), { username, usernameLower: username.toLowerCase(), email, online: true, lastSeen: firebase.firestore.FieldValue.serverTimestamp(), createdAt: firebase.firestore.FieldValue.serverTimestamp(), elo: 225 });
        batch.set(db.collection('usernames').doc(username.toLowerCase()), { uid: cred.user.uid, username });
        await batch.commit();
        currentProfile = { username, email, online: true, elo: 225 };
        hideAuthLoading(); closeAuthPanel(); showLoginSuccess();
    } catch (e) { hideAuthLoading(); setAuthError(friendlyError(e.code, e.message)); }
    btn.disabled = false; btn.textContent = 'Create Account';
}

async function doSignOut() {
    if (!currentUser) return;
    stopPresence();
    try { await db.collection('users').doc(currentUser.uid).update({ online: false }); } catch (e) { }
    await auth.signOut(); closeFriendsPanel();
}

function friendlyError(code, rawMsg) {
    const map = { 'auth/user-not-found': 'No account with that email.', 'auth/wrong-password': 'Incorrect password.', 'auth/email-already-in-use': 'Email already registered.', 'auth/invalid-email': 'Invalid email address.', 'auth/weak-password': 'Password too weak (min 6 chars).', 'auth/too-many-requests': 'Too many attempts. Try again later.', 'auth/invalid-credential': 'Incorrect email or password.', 'auth/network-request-failed': 'Network error.', 'auth/missing-email': 'Please enter an email address.', 'auth/missing-password': 'Please enter a password.', 'auth/operation-not-allowed': 'Sign-in method not enabled.' };
    return map[code] || (rawMsg || code || 'Unknown error.');
}

function showLoginSuccess() { const o = document.getElementById('login-success-overlay'); const n = document.getElementById('ls-username'); if (n && currentProfile) n.textContent = currentProfile.username; if (o) o.style.display = 'flex'; }
function dismissLoginSuccess() { const o = document.getElementById('login-success-overlay'); if (o) o.style.display = 'none'; }

function openFriendsPanel() {
    const p = document.getElementById('friends-overlay'); p.classList.add('open');
    const uEl = document.getElementById('fp-username');
    if (uEl && currentProfile) uEl.textContent = currentProfile.username;
    const av = document.getElementById('fp-avatar-main');
    if (av && currentProfile) {
        if (currentProfile.avatar) { av.textContent = ''; av.style.backgroundImage = 'url(' + currentProfile.avatar + ')'; av.style.backgroundSize = 'cover'; av.style.backgroundPosition = 'center'; av.style.backgroundColor = 'transparent'; }
        else { av.textContent = currentProfile.username[0].toUpperCase(); av.style.backgroundImage = ''; av.style.backgroundColor = ''; }
    }
    loadStats();
}

function handleAvatarUpload(input) {
    const file = input.files[0]; if (!file || !currentUser) return;
    const reader = new FileReader();
    reader.onload = function (e) { const img = new Image(); img.onload = function () { const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 80; const ctx = canvas.getContext('2d'); const s = Math.min(img.width, img.height); ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 80, 80); const b64 = canvas.toDataURL('image/webp', 0.7); db.collection('users').doc(currentUser.uid).update({ avatar: b64 }).then(() => { currentProfile.avatar = b64; applyAvatar(document.getElementById('fp-avatar-main'), b64); showMsg('Avatar updated!'); }).catch(() => showMsg('Failed.')); }; img.src = e.target.result; };
    reader.readAsDataURL(file); input.value = '';
}

function applyAvatar(el, b64) { if (b64) { el.textContent = ''; el.style.backgroundImage = 'url(' + b64 + ')'; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; el.style.backgroundColor = 'transparent'; } }
function closeFriendsPanel() { document.getElementById('friends-overlay').classList.remove('open'); }

function startFriendsListener() {
    if (!currentUser) return;
    if (friendsUnsub) friendsUnsub();
    friendsUnsub = db.collection('friends').where('uids', 'array-contains', currentUser.uid).onSnapshot(snap => {
        friendsData = []; pendingData = [];
        snap.forEach(doc => {
            const d = doc.data(); const fuid = d.uids.find(u => u !== currentUser.uid);
            if (d.status === 'accepted') friendsData.push({ id: doc.id, uid: fuid, username: d.usernames[fuid], online: false, activeMatch: null });
            else if (d.status === 'pending' && d.requester !== currentUser.uid) pendingData.push({ id: doc.id, uid: d.requester, username: d.requesterUsername });
        });
        renderFriendsList(); updateFriendBadge();
    }, () => { });
}

function updateFriendBadge() { const b = document.getElementById('friends-badge'); if (!b) return; b.style.display = pendingData.length > 0 ? 'inline-flex' : 'none'; b.textContent = pendingData.length; }

function renderFriendsList() {
    const listEl = document.getElementById('fp-friends-list');
    const pendEl = document.getElementById('fp-pending-list');
    const pendSec = document.getElementById('fp-pending-section');
    if (!listEl || !pendEl) return;

    if (pendingData.length > 0) {
        pendSec.style.display = '';
        pendEl.innerHTML = pendingData.map(r => `<div class="fp-friend-item"><div class="fp-friend-info"><div class="fp-avatar">${r.username[0].toUpperCase()}</div><span class="fp-friend-name">${hEsc(r.username)}</span></div><div class="fp-friend-actions"><button class="fp-btn fp-accept" onclick="acceptFriendReq('${r.id}')">✓</button><button class="fp-btn fp-decline" onclick="declineFriendReq('${r.id}')">✕</button></div></div>`).join('');
    } else { pendSec.style.display = 'none'; pendEl.innerHTML = ''; }

    if (friendsData.length === 0) { listEl.innerHTML = '<div class="fp-empty">No friends yet. Search above!</div>'; return; }

    const buildList = (arr) => arr.map(f => {
        const avatarHtml = f.avatar ? `<div class="fp-avatar" style="background-image:url(${f.avatar});background-size:cover;background-position:center;background-color:transparent;color:transparent;">${f.username[0].toUpperCase()}</div>` : `<div class="fp-avatar">${f.username[0].toUpperCase()}</div>`;
        let primaryAction;
        if (f.activeMatch) {
            primaryAction = `<button class="fp-btn fp-challenge" onclick="spectateMatch('${aEsc(f.activeMatch)}')">\uD83D\uDC41 Watch</button>`;
        } else {
            primaryAction = `<button class="fp-btn fp-challenge" onclick="challengeFriend('${f.uid}','${aEsc(f.username)}')">\u2694 Play</button>`;
        }
        const statusText = f.activeMatch ? '\uD83D\uDFE2 In Match' : (f.online ? '\u25cf Online' : '\u25cb Offline');
        const statusClass = (f.activeMatch || f.online) ? 'is-online' : '';
        return `<div class="fp-friend-item"><div class="fp-friend-info" style="cursor:pointer;" onclick="showUserProfile('${f.uid}')">${avatarHtml}<div><div class="fp-friend-name">${hEsc(f.username)}</div><div class="fp-online-dot ${statusClass}">${statusText}</div></div></div><div class="fp-friend-actions">${primaryAction}<button class="fp-btn fp-decline" onclick="removeFriend('${f.id}','${aEsc(f.username)}')" title="Remove">\u2715</button></div></div>`;
    }).join('');

    listEl.innerHTML = buildList(friendsData);

    const uids = friendsData.map(f => f.uid); const chunks = [];
    for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
    chunks.forEach(chunk => {
        db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get().then(snap => {
            snap.forEach(doc => {
                const f = friendsData.find(fr => fr.uid === doc.id);
                if (f) { f.online = isUserOnline(doc.data()); if (doc.data().avatar) f.avatar = doc.data().avatar; f.activeMatch = doc.data().activeMatch || null; }
            });
            if (listEl) listEl.innerHTML = buildList(friendsData);
        }).catch(() => { });
    });
}

let searchTimer = null;
function onSearchInput() { clearTimeout(searchTimer); const q = document.getElementById('fp-search').value.trim(); if (!q) { document.getElementById('fp-search-result').style.display = 'none'; return; } searchTimer = setTimeout(() => searchUser(q), 400); }

async function searchUser(query) {
    const el = document.getElementById('fp-search-result'); el.style.display = ''; el.innerHTML = '<div class="fp-searching">Searching\u2026</div>';
    try {
        const prefix = query.toLowerCase(); const end = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
        const snap = await db.collection('users').where('usernameLower', '>=', prefix).where('usernameLower', '<', end).limit(8).get();
        if (snap.empty) { el.innerHTML = '<div class="fp-no-result">No users found</div>'; return; }
        let html = '';
        for (const doc of snap.docs) {
            const uid = doc.id, uname = doc.data().username;
            if (uid === currentUser.uid) continue;
            const fid = [currentUser.uid, uid].sort().join('_');
            const fDoc = await db.collection('friends').doc(fid).get();
            let action = '';
            if (fDoc.exists) { const st = fDoc.data().status; if (st === 'accepted') action = '<span class="fp-pill accepted">Friends ✓</span>'; else if (fDoc.data().requester === currentUser.uid) action = '<span class="fp-pill pending">Sent</span>'; else action = `<button class="fp-btn fp-accept" onclick="acceptFriendReq('${fDoc.id}')">Accept</button>`; }
            else action = `<button class="fp-btn fp-add" onclick="sendFriendRequest('${uid}','${aEsc(uname)}')">+ Add</button>`;
            const avatarHtml = doc.data().avatar ? `<div class="fp-avatar" style="background-image:url(${doc.data().avatar});background-size:cover;background-position:center;background-color:transparent;color:transparent;">${uname[0].toUpperCase()}</div>` : `<div class="fp-avatar">${uname[0].toUpperCase()}</div>`;
            html += `<div class="fp-search-card" style="margin-bottom:4px;cursor:pointer;" onclick="showUserProfile('${uid}')"><div class="fp-friend-info">${avatarHtml}<span class="fp-friend-name">${hEsc(uname)}</span></div>${action}</div>`;
        }
        el.innerHTML = html || '<div class="fp-no-result">No users found</div>';
    } catch (e) { el.innerHTML = '<div class="fp-no-result">Error.</div>'; }
}

async function sendFriendRequest(targetUid, targetUsername) { if (!currentUser || !currentProfile) return; const fid = [currentUser.uid, targetUid].sort().join('_'); try { await db.collection('friends').doc(fid).set({ uids: [currentUser.uid, targetUid], usernames: { [currentUser.uid]: currentProfile.username, [targetUid]: targetUsername }, status: 'pending', requester: currentUser.uid, requesterUsername: currentProfile.username, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); showMsg('Request sent to ' + targetUsername + '!'); searchUser(targetUsername); } catch (e) { showMsg('Failed.'); } }
async function acceptFriendReq(docId) { try { await db.collection('friends').doc(docId).update({ status: 'accepted' }); showMsg('Friend added! 🎉'); document.getElementById('fp-search-result').style.display = 'none'; document.getElementById('fp-search').value = ''; } catch (e) { showMsg('Failed.'); } }
async function declineFriendReq(docId) { try { await db.collection('friends').doc(docId).delete(); } catch (e) { } }
async function removeFriend(docId, username) { if (!confirm('Remove ' + username + '?')) return; try { await db.collection('friends').doc(docId).delete(); showMsg(username + ' removed.'); } catch (e) { } }

async function challengeFriend(friendUid, friendUsername) {
    if (!currentUser || !currentProfile) { showMsg('Sign in to challenge friends.'); return; }
    try { const docRef = await db.collection('challenges').add({ from: currentUser.uid, fromUsername: currentProfile.username, to: friendUid, toUsername: friendUsername, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }); showMsg('Challenge sent!'); closeFriendsPanel(); const popup = document.getElementById('ol-friends-popup'); if (popup) popup.classList.remove('open'); listenForChallengeAccepted(docRef.id, friendUsername); } catch (e) { showMsg('Failed.'); }
}

function listenForChallengeAccepted(docId, friendUsername) {
    if (challengeDocUnsub) challengeDocUnsub();
    challengeDocUnsub = db.collection('challenges').doc(docId).onSnapshot(snap => {
        const d = snap.data(); if (!d) return;
        if (d.status === 'accepted' && d.roomCode) { if (challengeDocUnsub) { challengeDocUnsub(); challengeDocUnsub = null; } showAcceptedToast(docId, friendUsername, d.roomCode); }
        else if (d.status === 'declined') { if (challengeDocUnsub) { challengeDocUnsub(); challengeDocUnsub = null; } showMsg(hEsc(friendUsername) + ' declined.'); }
    });
}

function showAcceptedToast(docId, friendUsername, roomCode) { const tId = 'acc-' + docId; if (document.getElementById(tId)) return; const t = document.createElement('div'); t.className = 'challenge-toast'; t.id = tId; t.innerHTML = `<div class="ct-icon">✅</div><div class="ct-body"><div class="ct-title">Match Ready!</div><div class="ct-sub"><strong>${hEsc(friendUsername)}</strong> accepted.</div></div><div class="ct-actions"><button class="ct-btn ct-accept" onclick="joinAcceptedChallenge('${tId}','${roomCode}')">Play</button><button class="ct-btn ct-decline" onclick="dismissToastId('${tId}')">Cancel</button></div>`; document.body.appendChild(t); setTimeout(() => t.classList.add('visible'), 50); setTimeout(() => dismissToastId(tId), 30000); }
function dismissToastId(tId) { const t = document.getElementById(tId); if (t) { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); } }
function joinAcceptedChallenge(tId, roomCode) { dismissToastId(tId); if (typeof closeFriendsPanel === 'function') closeFriendsPanel(); const popup = document.getElementById('ol-friends-popup'); if (popup) popup.classList.remove('open'); if (document.getElementById('user-profile-modal')) document.getElementById('user-profile-modal').style.display = 'none'; openOnlineMenu(); setOlStatus('Connecting...', 'success'); document.getElementById('ol-name').value = currentProfile?.username || 'Player'; document.getElementById('ol-room').value = roomCode; setTimeout(() => joinRoom(), 500); }

function startChallengeListener() { if (!currentUser) return; if (challengeUnsub) challengeUnsub(); challengeUnsub = db.collection('challenges').where('to', '==', currentUser.uid).where('status', '==', 'pending').onSnapshot(snap => { snap.docChanges().forEach(ch => { if (ch.type === 'added') { const d = ch.doc.data(); const age = d.createdAt ? (Date.now() - d.createdAt.toMillis()) : 0; if (age < 86400000) showChallengeToast(ch.doc.id, d); } }); }, () => { }); }
function showChallengeToast(docId, data) { if (activeToasts.has(docId)) return; activeToasts.add(docId); const t = document.createElement('div'); t.className = 'challenge-toast'; t.id = 'ct-' + docId; t.innerHTML = `<div class="ct-icon">⚔️</div><div class="ct-body"><div class="ct-title">Challenge!</div><div class="ct-sub"><strong>${hEsc(data.fromUsername)}</strong> wants to play!</div></div><div class="ct-actions"><button class="ct-btn ct-accept" onclick="acceptChallenge('${docId}','${aEsc(data.fromUsername)}')">Accept</button><button class="ct-btn ct-decline" onclick="declineChallenge('${docId}')">Decline</button></div>`; document.body.appendChild(t); setTimeout(() => t.classList.add('visible'), 50); setTimeout(() => dismissToast(docId), 30000); }
function dismissToast(docId) { const t = document.getElementById('ct-' + docId); if (t) { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); } activeToasts.delete(docId); }

async function acceptChallenge(docId, fromUsername) {
    dismissToast(docId); const rc = genCode();
    try { await db.collection('challenges').doc(docId).update({ status: 'accepted', roomCode: rc }); } catch (e) { showMsg('Failed.'); return; }
    openOnlineMenu(); if (currentProfile) document.getElementById('ol-name').value = currentProfile.username; myName = currentProfile?.username || 'Player'; cleanupPeer();
    document.getElementById('btn-create').disabled = true; document.getElementById('btn-join').disabled = true;
    setOlStatus('Setting up match with <strong>' + hEsc(fromUsername) + '</strong>\u2026', 'success');
    const p = new Peer('chessie-' + rc, peerOpts); peer = p;
    p.on('open', () => setOlStatus('Waiting for <strong>' + hEsc(fromUsername) + '</strong>\u2026', 'success'));
    p.on('connection', c => { c.once('data', d => { if (d.type === 'spectate') { spectators.push(c); updateSpectatorCount(); syncSpectator(c); c.on('close', () => { spectators = spectators.filter(s => s !== c); updateSpectatorCount(); }); } else if (d.type === 'hello') { if (conn) { c.close(); return; } conn = c; myColor = 'w'; flipped = false; initConn(); handleNet(d); } }); });
    p.on('error', e => { setOlStatus('Error: ' + e.type, 'error'); document.getElementById('btn-create').disabled = false; document.getElementById('btn-join').disabled = false; });
}

async function declineChallenge(docId) { dismissToast(docId); try { await db.collection('challenges').doc(docId).update({ status: 'declined' }); } catch (e) { } }

async function findRandomMatch() {
    if (!currentUser) { showMsg('Sign in required!'); return; }
    const name = currentProfile?.username || document.getElementById('ol-name').value.trim() || 'Player'; myName = name;
    const statusEl = document.getElementById('ol-random-status'); statusEl.style.display = ''; statusEl.innerHTML = 'Looking\u2026'; statusEl.className = 'online-status';
    document.getElementById('btn-random').disabled = true;
    try {
        const waiting = await db.collection('matchmaking').where('status', '==', 'waiting').limit(5).get();
        let matched = false;
        for (const match of waiting.docs) {
            const data = match.data(); if (data.uid === currentUser?.uid) continue;
            try {
                await db.collection('matchmaking').doc(match.id).update({ status: 'matched', matchedBy: currentUser?.uid, matchedName: name });
                matched = true; statusEl.innerHTML = 'Found <strong>' + hEsc(data.playerName) + '</strong>!'; statusEl.className = 'online-status success';
                cleanupPeer(); document.getElementById('btn-create').disabled = true; document.getElementById('btn-join').disabled = true;
                const p = new Peer('chessie-' + data.roomCode, peerOpts); peer = p;
                p.on('open', () => { const c = p.connect('chessie-host-' + data.roomCode); conn = c; myColor = 'b'; flipped = true; initConn(); statusEl.style.display = 'none'; document.getElementById('btn-random').disabled = false; document.getElementById('btn-create').disabled = false; document.getElementById('btn-join').disabled = false; });
                p.on('connection', c => { c.once('data', d => { if (d.type === 'spectate') { spectators.push(c); updateSpectatorCount(); syncSpectator(c); c.on('close', () => { spectators = spectators.filter(s => s !== c); updateSpectatorCount(); }); } }); });
                p.on('error', () => { statusEl.innerHTML = 'Connection error.'; statusEl.className = 'online-status error'; document.getElementById('btn-random').disabled = false; });
                break;
            } catch (e) { continue; }
        }
        if (!matched) {
            const rc = genCode();
            const docRef = await db.collection('matchmaking').add({ uid: currentUser?.uid, playerName: name, roomCode: rc, status: 'waiting', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            cleanupPeer(); document.getElementById('btn-create').disabled = true; document.getElementById('btn-join').disabled = true;
            const p = new Peer('chessie-host-' + rc, peerOpts); peer = p;
            p.on('open', () => { statusEl.innerHTML = 'Waiting\u2026'; });
            p.on('connection', c => { c.once('data', d => { if (d.type === 'spectate') { spectators.push(c); updateSpectatorCount(); syncSpectator(c); c.on('close', () => { spectators = spectators.filter(s => s !== c); updateSpectatorCount(); }); } else if (d.type === 'hello') { if (conn) { c.close(); return; } conn = c; myColor = 'w'; flipped = false; db.collection('matchmaking').doc(docRef.id).delete().catch(() => {}); if (randomSearchUnsub) { randomSearchUnsub(); randomSearchUnsub = null; } document.getElementById('btn-random').disabled = false; document.getElementById('btn-create').disabled = false; document.getElementById('btn-join').disabled = false; statusEl.style.display = 'none'; initConn(); handleNet(d); } }); });
            p.on('error', e => { statusEl.innerHTML = 'Error: ' + e.type; statusEl.className = 'online-status error'; document.getElementById('btn-random').disabled = false; });
            randomSearchUnsub = db.collection('matchmaking').doc(docRef.id).onSnapshot(snap => { if (snap.data()?.status === 'matched') { statusEl.innerHTML = 'Opponent found!'; statusEl.className = 'online-status success'; if (randomSearchUnsub) { randomSearchUnsub(); randomSearchUnsub = null; } } });
            setTimeout(() => { if (randomSearchUnsub) { randomSearchUnsub(); randomSearchUnsub = null; db.collection('matchmaking').doc(docRef.id).delete().catch(() => {}); statusEl.innerHTML = 'No opponent. Try room code.'; statusEl.className = 'online-status error'; document.getElementById('btn-random').disabled = false; document.getElementById('btn-create').disabled = false; document.getElementById('btn-join').disabled = false; cleanupPeer(); } }, 180000);
        }
    } catch (e) { statusEl.innerHTML = 'Error.'; statusEl.className = 'online-status error'; document.getElementById('btn-random').disabled = false; }
}

function hEsc(s) { const d = document.createElement('div'); d.innerText = s; return d.innerHTML; }
function aEsc(s) { return s.replace(/'/g, "\\'"); }
function showMsg(msg) { const t = document.createElement('div'); t.className = 'toast-msg'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.classList.add('visible'), 50); setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000); }

function getEloRank(elo) { if (elo <= 250) return "Beginner"; if (elo <= 400) return "Good"; if (elo <= 600) return "Average"; if (elo <= 1000) return "Amazing"; if (elo <= 1500) return "Professional"; if (elo <= 2200) return "Master"; if (elo <= 3000) return "Demon"; return "GrandMaster"; }
function calculateElo(myElo, oppElo, outcome, accuracy = 50) { const K = 32; const expected = 1 / (1 + Math.pow(10, (oppElo - myElo) / 400)); const score = outcome === 'win' ? 1 : outcome === 'loss' ? 0 : 0.5; let change = K * (score - expected); let perfModifier = (accuracy - 50) / 10; if (outcome === 'draw' && accuracy >= 80) perfModifier += 3; return Math.max(100, Math.min(3500, Math.round(myElo + change + perfModifier))); }
function recordGameResult(outcome, oppElo = 225, accuracy = 50) { if (!currentUser) return null; const field = outcome === 'win' ? 'wins' : outcome === 'loss' ? 'losses' : 'draws'; const myElo = currentProfile?.elo || 225; const newElo = calculateElo(myElo, oppElo, outcome, accuracy); const eloChange = newElo - myElo; if (currentProfile) currentProfile.elo = newElo; db.collection('users').doc(currentUser.uid).update({ [field]: firebase.firestore.FieldValue.increment(1), gamesPlayed: firebase.firestore.FieldValue.increment(1), elo: newElo }).catch(() => {}); return { newElo, eloChange }; }
async function loadStats() { const el = document.getElementById('fp-stats'); if (!el || !currentUser) return; try { const snap = await db.collection('users').doc(currentUser.uid).get(); const d = snap.data() || {}; const elo = d.elo || 225; el.innerHTML = '<span style="color:#e08c32;margin-right:6px" title="' + getEloRank(elo) + '">Elo ' + elo + '</span> <span class="stat-w">' + (d.wins||0) + 'W</span> <span class="stat-l">' + (d.losses||0) + 'L</span> <span class="stat-d">' + (d.draws||0) + 'D</span>'; } catch (e) { el.innerHTML = ''; } }

async function showUserProfile(uid) {
    if (!uid) return;
    if (window.event && window.event.stopPropagation) window.event.stopPropagation();
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return;
    const d = userDoc.data(); const uname = d.username; const elo = d.elo || 225;
    const w = d.wins || 0, l = d.losses || 0, dr = d.draws || 0;
    const bio = d.bio || "No bio set yet.";
    const activeMatch = d.activeMatch || null;
    const userOnline = isUserOnline(d);

    let actionHtml = '';
    if (currentUser && uid !== currentUser.uid) {
        const fid = [currentUser.uid, uid].sort().join('_');
        const fDoc = await db.collection('friends').doc(fid).get();
        let watchBtn = '';
        if (activeMatch) watchBtn = '<button class="fp-btn fp-challenge" onclick="spectateMatch(\'' + aEsc(activeMatch) + '\')" style="margin-right:6px;">\uD83D\uDC41 Watch Live</button>';
        if (fDoc.exists) { const st = fDoc.data().status; if (st === 'accepted') actionHtml = watchBtn + '<button class="fp-btn fp-challenge" onclick="challengeFriend(\'' + uid + '\',\'' + aEsc(uname) + '\')">⚔ Play</button>'; else if (fDoc.data().requester === currentUser.uid) actionHtml = watchBtn + '<span class="fp-pill pending">Sent</span>'; else actionHtml = watchBtn + '<button class="fp-btn fp-accept" onclick="acceptFriendReq(\'' + fDoc.id + '\')">✓ Accept</button>'; }
        else actionHtml = watchBtn + '<button class="fp-btn fp-add" onclick="sendFriendRequest(\'' + uid + '\',\'' + aEsc(uname) + '\')">+ Add</button>';
    }

    let matchBadge = activeMatch ? '<div style="background:#2e7d32;color:#fff;padding:4px 12px;border-radius:20px;font-size:0.8rem;display:inline-block;margin-bottom:10px;">\uD83D\uDFE2 In Match</div>' : '';
    let onlineBadge = !activeMatch ? (userOnline ? '<div style="color:#4caf50;font-size:0.8rem;margin-bottom:10px;">\u25cf Online</div>' : '<div style="color:#888;font-size:0.8rem;margin-bottom:10px;">\u25cb Offline</div>') : '';

    let bioHtml = `<div style="background:var(--bg-dark);padding:10px;border-radius:8px;margin-bottom:15px;text-align:left;"><div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:5px;display:flex;justify-content:space-between;"><span>Bio</span>${(currentUser && uid === currentUser.uid) ? '<span style="color:#6a5acd;cursor:pointer;" onclick="editProfileBio()">Edit</span>' : ''}</div><div id="user-profile-bio-text" style="font-size:0.9rem;white-space:pre-wrap;">${hEsc(bio)}</div>${(currentUser && uid === currentUser.uid) ? '<div id="user-profile-bio-edit" style="display:none;margin-top:5px;"><textarea id="user-profile-bio-input" maxlength="150" style="width:100%;background:var(--bg-darker);color:#fff;border:1px solid #444;border-radius:4px;padding:5px;resize:vertical;min-height:60px;">' + hEsc(bio) + '</textarea><div style="text-align:right;margin-top:5px;"><button onclick="saveProfileBio(\'' + uid + '\')" style="background:#6a5acd;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;">Save</button></div></div>' : ''}</div>`;

    const avatarHtml = d.avatar ? '<div class="fp-avatar fp-avatar-lg" style="background-image:url(' + d.avatar + ');background-size:cover;background-position:center;background-color:transparent;color:transparent;margin:0 auto 10px auto;">' + uname[0].toUpperCase() + '</div>' : '<div class="fp-avatar fp-avatar-lg" style="margin:0 auto 10px auto;">' + uname[0].toUpperCase() + '</div>';

    let elHtml = document.getElementById('user-profile-modal');
    if (!elHtml) { elHtml = document.createElement('div'); elHtml.id = 'user-profile-modal'; elHtml.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;'; elHtml.onclick = function(e) { if (e.target === elHtml) elHtml.style.display = 'none'; }; document.body.appendChild(elHtml); }

    elHtml.innerHTML = `<div style="background:var(--bg-card);padding:20px;border-radius:12px;width:90%;max-width:320px;text-align:center;box-shadow:var(--shadow);position:relative;">${avatarHtml}<h2 style="margin:0 0 5px 0;font-size:1.4rem;">${hEsc(uname)}</h2><div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:10px;"><span style="color:#e08c32;font-weight:bold;margin-right:10px;">${getEloRank(elo)} (${elo})</span><span style="color:#4caf50;">${w}W</span> · <span style="color:#f44336;">${l}L</span> · <span style="color:#ffb300;">${dr}D</span></div>${matchBadge}${onlineBadge}${bioHtml}${actionHtml ? '<div style="margin-bottom:15px;display:flex;justify-content:center;gap:6px;flex-wrap:wrap;">' + actionHtml + '</div>' : ''}<button style="position:absolute;top:10px;right:10px;background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;" onclick="document.getElementById('user-profile-modal').style.display='none'">✕</button></div>`;
    elHtml.style.display = 'flex';
}

function editProfileBio() { document.getElementById('user-profile-bio-text').style.display = 'none'; document.getElementById('user-profile-bio-edit').style.display = 'block'; }
async function saveProfileBio(uid) { if (!currentUser || currentUser.uid !== uid) return; const txt = document.getElementById('user-profile-bio-input').value.trim(); try { await db.collection('users').doc(uid).update({ bio: txt }); document.getElementById('user-profile-bio-text').innerHTML = hEsc(txt || "No bio set yet."); document.getElementById('user-profile-bio-text').style.display = 'block'; document.getElementById('user-profile-bio-edit').style.display = 'none'; showMsg('Bio updated!'); } catch (e) { showMsg('Failed.'); } }
