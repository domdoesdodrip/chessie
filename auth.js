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

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const snap = await db.collection('users').doc(user.uid).get();
            if (snap.exists) currentProfile = snap.data();
            await db.collection('users').doc(user.uid).update({
                online: true,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) { }
        updateAccountUI(true);
        startFriendsListener();
        startChallengeListener();
    } else {
        currentUser = null;
        currentProfile = null;
        if (friendsUnsub) { friendsUnsub(); friendsUnsub = null; }
        if (challengeUnsub) { challengeUnsub(); challengeUnsub = null; }
        if (challengeDocUnsub) { challengeDocUnsub(); challengeDocUnsub = null; }
        updateAccountUI(false);
    }
    hideAuthLoading();
});

window.addEventListener('beforeunload', () => {
    if (currentUser) {
        navigator.sendBeacon && navigator.sendBeacon('/');
        db.collection('users').doc(currentUser.uid)
            .update({ online: false, lastSeen: firebase.firestore.FieldValue.serverTimestamp() })
            .catch(() => { });
    }
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
    } else {
        label.textContent = 'Sign In';
        btn.classList.remove('logged-in');
        if (authRow) authRow.style.display = '';
        if (welcomeEl) welcomeEl.style.display = 'none';
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

    const buildItem = (f) => `
        <div class="ol-friend-item">
            <div class="ol-friend-info">
                <div class="fp-avatar">${f.username[0].toUpperCase()}</div>
                <div>
                    <div class="fp-friend-name">${hEsc(f.username)}</div>
                    <div class="fp-online-dot ${f.online ? 'is-online' : ''}">${f.online ? '\u25cf Online' : '\u25cb Offline'}</div>
                </div>
            </div>
            <button class="fp-btn fp-challenge" onclick="challengeFriend('${f.uid}','${aEsc(f.username)}')">\u2694 Play</button>
        </div>`;

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
                    if (f) f.online = doc.data().online || false;
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
        var snap = await db.collection('users')
            .where('usernameLower', '>=', prefix)
            .where('usernameLower', '<', end)
            .limit(8)
            .get();
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
            html += '<div class="fp-search-card" style="margin-bottom:4px"><div class="fp-friend-info"><div class="fp-avatar">' + uname[0].toUpperCase() + '</div><span class="fp-friend-name">' + hEsc(uname) + '</span></div>' + action + '</div>';
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

function showAuthTab(tab) {
    authTab = tab;
    document.getElementById('auth-login-form').style.display = tab === 'login' ? '' : 'none';
    document.getElementById('auth-signup-form').style.display = tab === 'signup' ? '' : 'none';
    document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    clearAuthError();
}

function setAuthError(msg) { const e = document.getElementById('auth-error'); e.textContent = msg; e.style.display = msg ? '' : 'none'; }
function clearAuthError() { setAuthError(''); }
function showAuthLoading() { document.getElementById('auth-loading-overlay').classList.add('active'); }
function hideAuthLoading() { document.getElementById('auth-loading-overlay').classList.remove('active'); }

async function doLogin() {
    let identity = document.getElementById('login-identity').value.trim();
    const pass = document.getElementById('login-password').value;
    if (!identity || !pass) { setAuthError('Please fill in all fields.'); return; }
    const btn = document.getElementById('auth-login-btn');
    btn.disabled = true; btn.textContent = 'Signing in\u2026';
    showAuthLoading();
    try {
        let email = identity;
        if (!identity.includes('@')) {
            const uSnap = await db.collection('usernames').doc(identity.toLowerCase()).get();
            if (!uSnap.exists) { setAuthError('No account with that username.'); btn.disabled = false; btn.textContent = 'Sign In'; hideAuthLoading(); return; }
            const userDoc = await db.collection('users').doc(uSnap.data().uid).get();
            if (userDoc.exists && userDoc.data().email) {
                email = userDoc.data().email;
            } else {
                email = identity.toLowerCase() + '@chessie.local';
            }
        }
        await auth.signInWithEmailAndPassword(email, pass);
        hideAuthLoading();
        closeAuthPanel();
        showLoginSuccess();
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
    btn.disabled = true; btn.textContent = 'Creating\u2026';
    showAuthLoading();
    try {
        const uSnap = await db.collection('usernames').doc(username.toLowerCase()).get();
        if (uSnap.exists) { setAuthError('Username already taken. Try another.'); btn.disabled = false; btn.textContent = 'Create Account'; hideAuthLoading(); return; }
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        const batch = db.batch();
        batch.set(db.collection('users').doc(cred.user.uid), {
            username, usernameLower: username.toLowerCase(), email,
            online: true, lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        batch.set(db.collection('usernames').doc(username.toLowerCase()), { uid: cred.user.uid, username });
        await batch.commit();
        currentProfile = { username, email, online: true };
        hideAuthLoading();
        closeAuthPanel();
        showLoginSuccess();
    } catch (e) { hideAuthLoading(); setAuthError(friendlyError(e.code, e.message)); }
    btn.disabled = false; btn.textContent = 'Create Account';
}

async function doSignOut() {
    if (!currentUser) return;
    try { await db.collection('users').doc(currentUser.uid).update({ online: false }); } catch (e) { }
    await auth.signOut();
    closeFriendsPanel();
}

function friendlyError(code, rawMsg) {
    const map = {
        'auth/user-not-found': 'No account with that email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'Email already registered.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password too weak (min 6 chars).',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/invalid-credential': 'Incorrect email or password.',
        'auth/network-request-failed': 'Network error. Check your connection.',
        'auth/missing-email': 'Please enter an email address.',
        'auth/missing-password': 'Please enter a password.',
        'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase.',
    };
    return map[code] || (rawMsg || code || 'Unknown error occurred.');
}

function showLoginSuccess() {
    const overlay = document.getElementById('login-success-overlay');
    const nameEl = document.getElementById('ls-username');
    if (nameEl && currentProfile) nameEl.textContent = currentProfile.username;
    if (overlay) overlay.style.display = 'flex';
}

function dismissLoginSuccess() {
    const overlay = document.getElementById('login-success-overlay');
    if (overlay) overlay.style.display = 'none';
}

function openFriendsPanel() {
    const p = document.getElementById('friends-overlay');
    p.classList.add('open');
    const uEl = document.getElementById('fp-username');
    if (uEl && currentProfile) uEl.textContent = currentProfile.username;
    const av = document.getElementById('fp-avatar-main');
    if (av && currentProfile) av.textContent = currentProfile.username[0].toUpperCase();
}

function closeFriendsPanel() { document.getElementById('friends-overlay').classList.remove('open'); }

function startFriendsListener() {
    if (!currentUser) return;
    if (friendsUnsub) friendsUnsub();
    friendsUnsub = db.collection('friends')
        .where('uids', 'array-contains', currentUser.uid)
        .onSnapshot(snap => {
            friendsData = []; pendingData = [];
            snap.forEach(doc => {
                const d = doc.data();
                const fuid = d.uids.find(u => u !== currentUser.uid);
                if (d.status === 'accepted') {
                    friendsData.push({ id: doc.id, uid: fuid, username: d.usernames[fuid], online: false });
                } else if (d.status === 'pending' && d.requester !== currentUser.uid) {
                    pendingData.push({ id: doc.id, uid: d.requester, username: d.requesterUsername });
                }
            });
            renderFriendsList();
            updateFriendBadge();
        }, () => { });
}

function updateFriendBadge() {
    const b = document.getElementById('friends-badge');
    if (!b) return;
    b.style.display = pendingData.length > 0 ? 'inline-flex' : 'none';
    b.textContent = pendingData.length;
}

function renderFriendsList() {
    const listEl = document.getElementById('fp-friends-list');
    const pendEl = document.getElementById('fp-pending-list');
    const pendSec = document.getElementById('fp-pending-section');
    if (!listEl || !pendEl) return;

    if (pendingData.length > 0) {
        pendSec.style.display = '';
        pendEl.innerHTML = pendingData.map(r => `
            <div class="fp-friend-item">
                <div class="fp-friend-info">
                    <div class="fp-avatar">${r.username[0].toUpperCase()}</div>
                    <span class="fp-friend-name">${hEsc(r.username)}</span>
                </div>
                <div class="fp-friend-actions">
                    <button class="fp-btn fp-accept" onclick="acceptFriendReq('${r.id}')">✓ Accept</button>
                    <button class="fp-btn fp-decline" onclick="declineFriendReq('${r.id}')">✕</button>
                </div>
            </div>`).join('');
    } else {
        pendSec.style.display = 'none';
        pendEl.innerHTML = '';
    }

    if (friendsData.length === 0) {
        listEl.innerHTML = '<div class="fp-empty">No friends yet. Search above!</div>';
    } else {
        const buildList = (arr) => arr.map(f => `
            <div class="fp-friend-item">
                <div class="fp-friend-info">
                    <div class="fp-avatar">${f.username[0].toUpperCase()}</div>
                    <div>
                        <div class="fp-friend-name">${hEsc(f.username)}</div>
                        <div class="fp-online-dot ${f.online ? 'is-online' : ''}">${f.online ? '\u25cf Online' : '\u25cb Offline'}</div>
                    </div>
                </div>
                <div class="fp-friend-actions">
                    <button class="fp-btn fp-challenge" onclick="challengeFriend('${f.uid}','${aEsc(f.username)}')">\u2694 Play</button>
                    <button class="fp-btn fp-decline" onclick="removeFriend('${f.id}','${aEsc(f.username)}')" title="Remove">\u2715</button>
                </div>
            </div>`).join('');
        listEl.innerHTML = buildList(friendsData);

        const uids = friendsData.map(f => f.uid);
        const chunks = [];
        for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
        chunks.forEach(chunk => {
            db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get()
                .then(snap => {
                    snap.forEach(doc => {
                        const f = friendsData.find(fr => fr.uid === doc.id);
                        if (f) f.online = doc.data().online || false;
                    });
                    if (listEl) listEl.innerHTML = buildList(friendsData);
                }).catch(() => { });
        });
    }
}

let searchTimer = null;
function onSearchInput() {
    clearTimeout(searchTimer);
    const q = document.getElementById('fp-search').value.trim();
    if (!q) { document.getElementById('fp-search-result').style.display = 'none'; return; }
    searchTimer = setTimeout(() => searchUser(q), 400);
}

async function searchUser(query) {
    const el = document.getElementById('fp-search-result');
    el.style.display = '';
    el.innerHTML = '<div class="fp-searching">Searching\u2026</div>';
    try {
        const prefix = query.toLowerCase();
        const end = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
        const snap = await db.collection('users')
            .where('usernameLower', '>=', prefix)
            .where('usernameLower', '<', end)
            .limit(8)
            .get();
        if (snap.empty) { el.innerHTML = '<div class="fp-no-result">No users found</div>'; return; }
        let html = '';
        for (const doc of snap.docs) {
            const uid = doc.id, uname = doc.data().username;
            if (uid === currentUser.uid) continue;
            const fid = [currentUser.uid, uid].sort().join('_');
            const fDoc = await db.collection('friends').doc(fid).get();
            let action = '';
            if (fDoc.exists) {
                const st = fDoc.data().status;
                if (st === 'accepted') action = '<span class="fp-pill accepted">Friends ✓</span>';
                else if (fDoc.data().requester === currentUser.uid) action = '<span class="fp-pill pending">Request Sent</span>';
                else action = `<button class="fp-btn fp-accept" onclick="acceptFriendReq('${fDoc.id}')">Accept</button>`;
            } else {
                action = `<button class="fp-btn fp-add" onclick="sendFriendRequest('${uid}','${aEsc(uname)}')">+ Add</button>`;
            }
            html += `<div class="fp-search-card" style="margin-bottom:4px"><div class="fp-friend-info"><div class="fp-avatar">${uname[0].toUpperCase()}</div><span class="fp-friend-name">${hEsc(uname)}</span></div>${action}</div>`;
        }
        el.innerHTML = html || '<div class="fp-no-result">No users found</div>';
    } catch (e) { el.innerHTML = '<div class="fp-no-result">Error. Try again.</div>'; }
}

async function sendFriendRequest(targetUid, targetUsername) {
    if (!currentUser || !currentProfile) return;
    const fid = [currentUser.uid, targetUid].sort().join('_');
    try {
        await db.collection('friends').doc(fid).set({
            uids: [currentUser.uid, targetUid],
            usernames: { [currentUser.uid]: currentProfile.username, [targetUid]: targetUsername },
            status: 'pending', requester: currentUser.uid, requesterUsername: currentProfile.username,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showMsg('Friend request sent to ' + targetUsername + '!');
        searchUser(targetUsername);
    } catch (e) { showMsg('Failed to send request.'); }
}

async function acceptFriendReq(docId) {
    try {
        await db.collection('friends').doc(docId).update({ status: 'accepted' });
        showMsg('Friend added! \uD83C\uDF89');
        document.getElementById('fp-search-result').style.display = 'none';
        document.getElementById('fp-search').value = '';
    } catch (e) { showMsg('Failed to accept.'); }
}

async function declineFriendReq(docId) {
    try { await db.collection('friends').doc(docId).delete(); } catch (e) { }
}

async function removeFriend(docId, username) {
    if (!confirm('Remove ' + username + ' from friends?')) return;
    try { await db.collection('friends').doc(docId).delete(); showMsg(username + ' removed.'); } catch (e) { }
}

async function challengeFriend(friendUid, friendUsername) {
    if (!currentUser || !currentProfile) { showMsg('Sign in to challenge friends.'); return; }
    try {
        const docRef = await db.collection('challenges').add({
            from: currentUser.uid, fromUsername: currentProfile.username,
            to: friendUid, toUsername: friendUsername,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showMsg('Challenge sent to ' + friendUsername + '!');
        closeFriendsPanel();
        const popup = document.getElementById('ol-friends-popup');
        if (popup) popup.classList.remove('open');

        listenForChallengeAccepted(docRef.id, friendUsername);
    } catch (e) { showMsg('Failed to send challenge.'); }
}

function listenForChallengeAccepted(docId, friendUsername) {
    if (challengeDocUnsub) challengeDocUnsub();
    openOnlineMenu();
    setOlStatus('Waiting for <strong>' + hEsc(friendUsername) + '</strong> to accept\u2026', 'success');
    document.getElementById('btn-create').disabled = true;
    document.getElementById('btn-join').disabled = true;
    document.getElementById('btn-random').disabled = true;

    challengeDocUnsub = db.collection('challenges').doc(docId).onSnapshot(snap => {
        const d = snap.data();
        if (!d) return;
        if (d.status === 'accepted' && d.roomCode) {
            if (challengeDocUnsub) { challengeDocUnsub(); challengeDocUnsub = null; }
            setOlStatus('Challenge accepted! Connecting\u2026', 'success');
            document.getElementById('ol-name').value = currentProfile?.username || 'Player';
            document.getElementById('ol-room').value = d.roomCode;
            setTimeout(() => {
                joinRoom();
                document.getElementById('btn-create').disabled = false;
                document.getElementById('btn-join').disabled = false;
                document.getElementById('btn-random').disabled = false;
            }, 500);
        } else if (d.status === 'declined') {
            if (challengeDocUnsub) { challengeDocUnsub(); challengeDocUnsub = null; }
            setOlStatus(hEsc(friendUsername) + ' declined the challenge.', 'error');
            document.getElementById('btn-create').disabled = false;
            document.getElementById('btn-join').disabled = false;
            document.getElementById('btn-random').disabled = false;
        }
    });
}

function startChallengeListener() {
    if (!currentUser) return;
    if (challengeUnsub) challengeUnsub();
    challengeUnsub = db.collection('challenges')
        .where('to', '==', currentUser.uid)
        .where('status', '==', 'pending')
        .onSnapshot(snap => {
            snap.docChanges().forEach(ch => {
                if (ch.type === 'added') {
                    const d = ch.doc.data();
                    const age = d.createdAt ? (Date.now() - d.createdAt.toMillis()) : 0;
                    if (age < 86400000) showChallengeToast(ch.doc.id, d);
                }
            });
        }, () => { });
}

function showChallengeToast(docId, data) {
    if (activeToasts.has(docId)) return;
    activeToasts.add(docId);
    const t = document.createElement('div');
    t.className = 'challenge-toast';
    t.id = 'ct-' + docId;
    t.innerHTML = `
        <div class="ct-icon">\u2694\uFE0F</div>
        <div class="ct-body">
            <div class="ct-title">Match Challenge!</div>
            <div class="ct-sub"><strong>${hEsc(data.fromUsername)}</strong> wants to play!</div>
        </div>
        <div class="ct-actions">
            <button class="ct-btn ct-accept" onclick="acceptChallenge('${docId}','${aEsc(data.fromUsername)}')">Accept</button>
            <button class="ct-btn ct-decline" onclick="declineChallenge('${docId}')">Decline</button>
        </div>`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('visible'), 50);
    setTimeout(() => dismissToast(docId), 30000);
}

function dismissToast(docId) {
    const t = document.getElementById('ct-' + docId);
    if (t) { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }
    activeToasts.delete(docId);
}

async function acceptChallenge(docId, fromUsername) {
    dismissToast(docId);
    const rc = genCode();
    try {
        await db.collection('challenges').doc(docId).update({ status: 'accepted', roomCode: rc });
    } catch (e) { showMsg('Failed to accept challenge.'); return; }
    openOnlineMenu();
    if (currentProfile) document.getElementById('ol-name').value = currentProfile.username;
    myName = currentProfile?.username || 'Player';
    cleanupPeer();
    document.getElementById('btn-create').disabled = true;
    document.getElementById('btn-join').disabled = true;
    setOlStatus('Setting up match with <strong>' + hEsc(fromUsername) + '</strong>\u2026', 'success');

    const p = new Peer('chessie-' + rc, peerOpts);
    peer = p;
    p.on('open', () => {
        setOlStatus('Waiting for <strong>' + hEsc(fromUsername) + '</strong> to connect\u2026', 'success');
    });
    p.on('connection', c => {
        if (conn) { c.close(); return; }
        conn = c; myColor = 'w'; flipped = false; initConn();
    });
    p.on('error', e => {
        setOlStatus('Error: ' + e.type, 'error');
        document.getElementById('btn-create').disabled = false;
        document.getElementById('btn-join').disabled = false;
    });
}

async function declineChallenge(docId) {
    dismissToast(docId);
    try { await db.collection('challenges').doc(docId).update({ status: 'declined' }); } catch (e) { }
}

async function findRandomMatch() {
    if (!currentUser) { showMsg('Only users with accounts can use this option!'); return; }
    const name = currentProfile?.username || document.getElementById('ol-name').value.trim() || 'Player';
    myName = name;
    const statusEl = document.getElementById('ol-random-status');
    statusEl.style.display = '';
    statusEl.innerHTML = 'Looking for an opponent\u2026';
    statusEl.className = 'online-status';
    document.getElementById('btn-random').disabled = true;

    try {
        const waiting = await db.collection('matchmaking')
            .where('status', '==', 'waiting')
            .orderBy('createdAt')
            .limit(5)
            .get();

        let matched = false;
        for (const match of waiting.docs) {
            const data = match.data();
            if (data.uid === (currentUser?.uid || 'anon')) continue;
            try {
                await db.collection('matchmaking').doc(match.id).update({
                    status: 'matched',
                    matchedBy: currentUser?.uid || 'anon',
                    matchedName: name
                });
                matched = true;
                statusEl.innerHTML = 'Found <strong>' + hEsc(data.playerName) + '</strong>! Connecting\u2026';
                statusEl.className = 'online-status success';

                cleanupPeer();
                document.getElementById('btn-create').disabled = true;
                document.getElementById('btn-join').disabled = true;
                const p = new Peer('chessie-' + data.roomCode, peerOpts);
                peer = p;
                p.on('open', () => {
                    const c = p.connect('chessie-host-' + data.roomCode);
                    conn = c;
                    myColor = 'b';
                    flipped = true;
                    initConn();
                    statusEl.style.display = 'none';
                    document.getElementById('btn-random').disabled = false;
                    document.getElementById('btn-create').disabled = false;
                    document.getElementById('btn-join').disabled = false;
                });
                p.on('error', e => {
                    statusEl.innerHTML = 'Connection error. Try again.';
                    statusEl.className = 'online-status error';
                    document.getElementById('btn-random').disabled = false;
                });
                break;
            } catch (e) { continue; }
        }

        if (!matched) {
            const rc = genCode();
            const docRef = await db.collection('matchmaking').add({
                uid: currentUser?.uid || 'anon-' + rc,
                playerName: name,
                roomCode: rc,
                status: 'waiting',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            cleanupPeer();
            document.getElementById('btn-create').disabled = true;
            document.getElementById('btn-join').disabled = true;
            const p = new Peer('chessie-host-' + rc, peerOpts);
            peer = p;
            p.on('open', () => {
                statusEl.innerHTML = 'Waiting for a random opponent\u2026';
            });
            p.on('connection', c => {
                if (conn) { c.close(); return; }
                conn = c; myColor = 'w'; flipped = false;
                db.collection('matchmaking').doc(docRef.id).delete().catch(() => { });
                if (randomSearchUnsub) { randomSearchUnsub(); randomSearchUnsub = null; }
                document.getElementById('btn-random').disabled = false;
                document.getElementById('btn-create').disabled = false;
                document.getElementById('btn-join').disabled = false;
                statusEl.style.display = 'none';
                initConn();
            });
            p.on('error', e => {
                statusEl.innerHTML = 'Error: ' + e.type;
                statusEl.className = 'online-status error';
                document.getElementById('btn-random').disabled = false;
            });

            randomSearchUnsub = db.collection('matchmaking').doc(docRef.id).onSnapshot(snap => {
                if (snap.data()?.status === 'matched') {
                    statusEl.innerHTML = 'Opponent found! Waiting for connection\u2026';
                    statusEl.className = 'online-status success';
                    if (randomSearchUnsub) { randomSearchUnsub(); randomSearchUnsub = null; }
                }
            });

            setTimeout(() => {
                if (randomSearchUnsub) {
                    randomSearchUnsub(); randomSearchUnsub = null;
                    db.collection('matchmaking').doc(docRef.id).delete().catch(() => { });
                    statusEl.innerHTML = 'No opponent found. Try again or use a room code.';
                    statusEl.className = 'online-status error';
                    document.getElementById('btn-random').disabled = false;
                    document.getElementById('btn-create').disabled = false;
                    document.getElementById('btn-join').disabled = false;
                    cleanupPeer();
                }
            }, 60000);
        }
    } catch (e) {
        statusEl.innerHTML = 'Error finding match. Try room code instead.';
        statusEl.className = 'online-status error';
        document.getElementById('btn-random').disabled = false;
    }
}

function hEsc(s) { const d = document.createElement('div'); d.innerText = s; return d.innerHTML; }
function aEsc(s) { return s.replace(/'/g, "\\'"); }
function showMsg(msg) {
    const t = document.createElement('div');
    t.className = 'toast-msg'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('visible'), 50);
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
}
