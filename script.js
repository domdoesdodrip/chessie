const gridEl = document.getElementById('grid');
const piecesLayer = document.getElementById('pieces-layer');
const statusEl = document.getElementById('status');
const historyList = document.getElementById('history-list');
const modalOverlay = document.getElementById('modal-overlay');
const btnNew = document.getElementById('btn-new');
const graveW = document.getElementById('grave-w');
const graveB = document.getElementById('grave-b');
const sidebar = document.getElementById('sidebar');
const timerCol = document.getElementById('timer-col');
const gameView = document.getElementById('game-view');
const promoOverlay = document.getElementById('promo-overlay');
const arrowLayer = document.getElementById('arrow-layer');
const mobStatus = document.getElementById('mob-status');
const mobBtnNew = document.getElementById('mob-btn-new');
const thinkingEl = document.getElementById('thinking');
const banner = document.getElementById('game-over-banner');

const pieceImgs = {
    wP: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Chess_plt60.png',
    bP: 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Chess_pdt60.png',
    wK: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Chess_klt60.png',
    bK: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Chess_kdt60.png',
    wQ: 'https://upload.wikimedia.org/wikipedia/commons/4/49/Chess_qlt60.png',
    bQ: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Chess_qdt60.png',
    wB: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Chess_blt60.png',
    bB: 'https://upload.wikimedia.org/wikipedia/commons/8/81/Chess_bdt60.png',
    wN: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Chess_nlt60.png',
    bN: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Chess_ndt60.png',
    wR: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Chess_rlt60.png',
    bR: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Chess_rdt60.png'
};

const pieceNames = { P: '', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K' };
const valMap = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

let board = Array(8).fill(null).map(() => Array(8).fill(null));
let turn = 'w', selected = null, legalMoves = [], isPaused = false;
let timeW = 480, timeB = 480, timerInterval = null, moveCount = 0;
let gameStarted = false, gameOver = false, enPassantTarget = null;
let castleRights = { wK: true, wQR: true, wKR: true, bK: true, bQR: true, bKR: true };
let arrowStart = null, arrows = [], yellowSquares = new Set(), lastMoveSquares = [], dragging = null;
let moveHistory = [];

let isOnline = false, myColor = 'w', flipped = false;
let peer = null, conn = null, myName = 'You', oppName = 'Opponent';
let myElo = 225, oppElo = 225, myUid = null, oppUid = null;
let unreadChat = 0, connectionReady = false, helloSent = false, helloReceived = false;
let scoreMe = 0, scoreOpp = 0;
let isBot = false, botLevel = 1, botColor = 'b', botThinking = false;
const botNames = { 1: 'Bot 1', 2: 'Bot 2', 3: 'Bot 3', 4: 'Coach Bot' };
const moveSound = new Audio('move.mp3');
let soundEnabled = localStorage.getItem('chessie-sound') !== 'off';
function toggleSound() { soundEnabled = !soundEnabled; localStorage.setItem('chessie-sound', soundEnabled ? 'on' : 'off'); document.getElementById('sound-on-icon').style.display = soundEnabled ? '' : 'none'; document.getElementById('sound-off-icon').style.display = soundEnabled ? 'none' : ''; }
window.addEventListener('DOMContentLoaded', () => { document.getElementById('sound-on-icon').style.display = soundEnabled ? '' : 'none'; document.getElementById('sound-off-icon').style.display = soundEnabled ? 'none' : ''; });

const PST = {
    P: [[0, 0, 0, 0, 0, 0, 0, 0], [50, 50, 50, 50, 50, 50, 50, 50], [10, 10, 20, 30, 30, 20, 10, 10], [5, 5, 10, 25, 25, 10, 5, 5], [0, 0, 0, 35, 35, 0, 0, 0], [5, -5, -10, 10, 10, -10, -5, 5], [5, 10, 10, -25, -25, 10, 10, 5], [0, 0, 0, 0, 0, 0, 0, 0]],
    N: [[-50, -40, -30, -30, -30, -30, -40, -50], [-40, -20, 0, 0, 0, 0, -20, -40], [-30, 0, 10, 15, 15, 10, 0, -30], [-30, 5, 15, 20, 20, 15, 5, -30], [-30, 0, 15, 20, 20, 15, 0, -30], [-30, 5, 10, 15, 15, 10, 5, -30], [-40, -20, 0, 5, 5, 0, -20, -40], [-50, -40, -30, -30, -30, -30, -40, -50]],
    B: [[-20, -10, -10, -10, -10, -10, -10, -20], [-10, 0, 0, 0, 0, 0, 0, -10], [-10, 0, 10, 10, 10, 10, 0, -10], [-10, 5, 5, 10, 10, 5, 5, -10], [-10, 0, 10, 10, 10, 10, 0, -10], [-10, 10, 10, 10, 10, 10, 10, -10], [-10, 5, 0, 0, 0, 0, 5, -10], [-20, -10, -10, -10, -10, -10, -10, -20]],
    R: [[0, 0, 0, 0, 0, 0, 0, 0], [5, 10, 10, 10, 10, 10, 10, 5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [0, 0, 0, 5, 5, 0, 0, 0]],
    Q: [[-20, -10, -10, -5, -5, -10, -10, -20], [-10, 0, 0, 0, 0, 0, 0, -10], [-10, 0, 5, 5, 5, 5, 0, -10], [-5, 0, 5, 5, 5, 5, 0, -5], [0, 0, 5, 5, 5, 5, 0, -5], [-10, 5, 5, 5, 5, 5, 0, -10], [-10, 0, 5, 0, 0, 0, 0, -10], [-20, -10, -10, -5, -5, -10, -10, -20]],
    K: [[-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-20, -30, -30, -40, -40, -30, -30, -20], [-10, -20, -20, -20, -20, -20, -20, -10], [20, 20, 0, 0, 0, 0, 20, 20], [20, 30, 10, 0, 0, 10, 30, 20]]
};
function getPST(t, r, c, col) { const tb = PST[t]; return tb ? (tb[col === 'w' ? r : 7 - r][c]) : 0; }

function hideStart() { document.getElementById('start-screen').classList.add('gone'); }
function startLocal() { hideStart(); isOnline = false; isBot = false; myColor = 'w'; flipped = false; oppName = 'Black'; scoreMe = 0; scoreOpp = 0; coachActive = false; updateCoachLayout(); resetGame(); }

function togglePlusMenu(e) { e.stopPropagation(); document.getElementById('plus-btn').classList.toggle('open'); document.getElementById('plus-dropdown').classList.toggle('open'); }
function closePlusMenu() { document.getElementById('plus-btn').classList.remove('open'); document.getElementById('plus-dropdown').classList.remove('open'); }
document.addEventListener('click', function (e) { if (!e.target.closest('#plus-wrap')) closePlusMenu(); });

let selectedBotLevel = 0;
function openBotMenu() { document.getElementById('bot-overlay').style.display = 'flex'; document.getElementById('bot-color-section').style.display = 'none'; selectedBotLevel = 0; document.querySelectorAll('.bot-level-card').forEach(c => c.classList.remove('selected-level')); }
function closeBotMenu() { document.getElementById('bot-overlay').style.display = 'none'; }
function selectBotLevel(l) { selectedBotLevel = l; document.getElementById('bot-color-section').style.display = 'block'; document.querySelectorAll('.bot-level-card').forEach(c => c.classList.remove('selected-level')); document.getElementById('blc-' + l).classList.add('selected-level'); }
function startBotGame(cc) { hideStart(); botLevel = selectedBotLevel; if (cc === 'r') cc = Math.random() < .5 ? 'w' : 'b'; myColor = cc; botColor = cc === 'w' ? 'b' : 'w'; flipped = myColor === 'b'; isBot = true; isOnline = false; oppName = botNames[botLevel]; document.getElementById('bot-overlay').style.display = 'none'; scoreMe = 0; scoreOpp = 0; coachActive = (botLevel === 4); updateCoachLayout(); resetGame(); if (botColor === 'w') setTimeout(botMove, 500); }

function evaluateBoard(b) { let s = 0; const mv = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 }; for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++) { const p = b[r][c]; if (!p) continue; const v = mv[p.type[1]] + getPST(p.type[1], r, c, p.type[0]); s += p.type[0] === 'w' ? v : -v; } return s; }
function cloneBoard(b) { return b.map(row => row.map(cell => cell ? { type: cell.type, el: cell.el } : null)); }
function getAllMoves(color, b) { const moves = []; for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++)if (b[r][c]?.type[0] === color) getSafeMoves(r, c, b).forEach(m => moves.push({ fR: r, fC: c, tR: m.r, tC: m.c })); return moves; }
function simMove(b, fR, fC, tR, tC, pr) { const nb = cloneBoard(b); const mv = nb[fR][fC]; if (!mv) return nb; const col = mv.type[0], tp = mv.type[1]; if (tp === 'P' && tC !== fC && !nb[tR][tC]) nb[fR][tC] = null; nb[tR][tC] = { type: mv.type, el: mv.el }; nb[fR][fC] = null; if (tp === 'K' && Math.abs(tC - fC) === 2) { if (tC === 6) { nb[fR][5] = nb[fR][7]; nb[fR][7] = null; } else { nb[fR][3] = nb[fR][0]; nb[fR][0] = null; } } if (tp === 'P' && (tR === 0 || tR === 7)) nb[tR][tC] = { type: col + (pr || 'Q'), el: mv.el }; return nb; }
function orderMoves(moves, b) { return moves.map(m => { let s = 0; const tgt = b[m.tR][m.tC], mvr = b[m.fR][m.fC]; const cv = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 }; if (tgt) s += cv[tgt.type[1]] * 10 - cv[mvr.type[1]]; if (m.tR >= 2 && m.tR <= 5 && m.tC >= 2 && m.tC <= 5) s += 5; if (mvr.type[1] === 'P' && (m.tR === 0 || m.tR === 7)) s += 800; return { ...m, score: s }; }).sort((a, b) => b.score - a.score); }
function minimax(b, depth, alpha, beta, isMax, sEP, sCR) { if (depth === 0) return evaluateBoard(b); const col = isMax ? 'w' : 'b'; const oEP = enPassantTarget, oCR = { ...castleRights }; enPassantTarget = sEP; Object.assign(castleRights, sCR); let moves = getAllMoves(col, b); if (!moves.length) { enPassantTarget = oEP; Object.assign(castleRights, oCR); return isInCheck(col, b) ? (isMax ? -99999 + (3 - depth) : 99999 - (3 - depth)) : 0; } if (depth >= 2) moves = orderMoves(moves, b); let best = isMax ? -Infinity : Infinity; for (const m of moves) { const mvr = b[m.fR][m.fC]; const nEP = (mvr.type[1] === 'P' && Math.abs(m.tR - m.fR) === 2) ? { r: (m.fR + m.tR) / 2, c: m.fC } : null; const nCR = { ...castleRights }; if (mvr.type[1] === 'K') { nCR[col + 'K'] = false; nCR[col + 'QR'] = false; nCR[col + 'KR'] = false; } if (mvr.type[1] === 'R') { if (m.fC === 0) nCR[col + 'QR'] = false; if (m.fC === 7) nCR[col + 'KR'] = false; } const nb = simMove(b, m.fR, m.fC, m.tR, m.tC, 'Q'); const val = minimax(nb, depth - 1, alpha, beta, !isMax, nEP, nCR); if (isMax) { best = Math.max(best, val); alpha = Math.max(alpha, val); } else { best = Math.min(best, val); beta = Math.min(beta, val); } if (beta <= alpha) break; } enPassantTarget = oEP; Object.assign(castleRights, oCR); return best; }

function findBestAndPlayedEval(color, b, savedEP, savedCR, fR, fC, tR, tC) {
    const oEP = enPassantTarget, oCR = { ...castleRights };
    enPassantTarget = savedEP;
    Object.assign(castleRights, savedCR);
    const moves = getAllMoves(color, b);
    const isMax = color === 'w';
    let bestVal = isMax ? -Infinity : Infinity;
    let playedVal = null;
    for (const m of moves) {
        const mvr = b[m.fR][m.fC];
        const nEP = (mvr.type[1] === 'P' && Math.abs(m.tR - m.fR) === 2) ? { r: (m.fR + m.tR) / 2, c: m.fC } : null;
        const nCR = { ...castleRights };
        if (mvr.type[1] === 'K') { nCR[color + 'K'] = false; nCR[color + 'QR'] = false; nCR[color + 'KR'] = false; }
        if (mvr.type[1] === 'R') { if (m.fC === 0) nCR[color + 'QR'] = false; if (m.fC === 7) nCR[color + 'KR'] = false; }
        const nb = simMove(b, m.fR, m.fC, m.tR, m.tC, 'Q');
        const val = minimax(nb, 2, -Infinity, Infinity, !isMax, nEP, nCR);
        if (isMax ? val > bestVal : val < bestVal) bestVal = val;
        if (m.fR === fR && m.fC === fC && m.tR === tR && m.tC === tC) playedVal = val;
    }
    enPassantTarget = oEP;
    Object.assign(castleRights, oCR);
    if (!moves.length) bestVal = playedVal = evaluateBoard(b);
    if (playedVal === null) playedVal = bestVal;
    return { bestVal, playedVal };
}

function botMove() { if (!turn || turn !== botColor || !isBot || gameOver) return; botThinking = true; thinkingEl.classList.add('visible'); let effectiveLevel = botLevel; if (botLevel === 4) { let playerAcc = 50; if (moveHistory.length > 1) { let goodMoves = 0; let playerMoves = moveHistory.filter(m => m.color !== botColor); if (playerMoves.length > 0) { playerMoves.forEach(m => { const ev = findBestAndPlayedEval(m.color, m.boardBefore, m.savedEP, m.savedCR, m.fR, m.fC, m.tR, m.tC); const cl = classifyMove(ev.bestVal, ev.playedVal, m.color, m.isBook); if (['best', 'excellent', 'good', 'book', 'brilliant'].includes(cl.cls)) goodMoves++; }); playerAcc = (goodMoves / playerMoves.length) * 100; } } if (playerAcc < 40) effectiveLevel = 1; else if (playerAcc < 75) effectiveLevel = 2; else effectiveLevel = 3; } const thinkBase = effectiveLevel === 3 ? 1800 : effectiveLevel === 2 ? 1200 : 800; const thinkTime = thinkBase + ~~(Math.random() * 1200); setTimeout(() => { const moves = getAllMoves(botColor, board); if (!moves.length) return; let best = null; if (effectiveLevel === 1) { const caps = moves.filter(m => board[m.tR][m.tC]); best = (caps.length && Math.random() < .4) ? caps[~~(Math.random() * caps.length)] : moves[~~(Math.random() * moves.length)]; } else if (effectiveLevel === 2) { const isMax = botColor === 'w'; let scored = moves.map(m => ({ ...m, val: evaluateBoard(simMove(board, m.fR, m.fC, m.tR, m.tC, 'Q')) + (Math.random() - .5) * 250 })); scored.sort((a, b) => isMax ? b.val - a.val : a.val - b.val); best = scored[Math.random() < .25 ? Math.min(~~(Math.random() * 4), scored.length - 1) : 0]; } else { const isMax = botColor === 'w'; let bestVal = isMax ? -Infinity : Infinity; const ord = orderMoves(moves, board); const sEP = enPassantTarget, sCR = { ...castleRights }; for (const m of ord) { const mvr = board[m.fR][m.fC]; const nEP = (mvr.type[1] === 'P' && Math.abs(m.tR - m.fR) === 2) ? { r: (m.fR + m.tR) / 2, c: m.fC } : null; const nCR = { ...castleRights }; if (mvr.type[1] === 'K') { nCR[botColor + 'K'] = false; nCR[botColor + 'QR'] = false; nCR[botColor + 'KR'] = false; } if (mvr.type[1] === 'R') { if (m.fC === 0) nCR[botColor + 'QR'] = false; if (m.fC === 7) nCR[botColor + 'KR'] = false; } const nb = simMove(board, m.fR, m.fC, m.tR, m.tC, 'Q'); const val = minimax(nb, 2, -Infinity, Infinity, !isMax, nEP, nCR) + (Math.random() - .5) * 120; if (isMax ? val > bestVal : val < bestVal) { bestVal = val; best = m; } } enPassantTarget = sEP; Object.assign(castleRights, sCR); } botThinking = false; thinkingEl.classList.remove('visible'); if (best) { const mvr = board[best.fR][best.fC]; const pr = (mvr.type[1] === 'P' && (best.tR === 0 || best.tR === 7)) ? 'Q' : null; executeMove(best.fR, best.fC, best.tR, best.tC, pr, true); } }, thinkTime); }

function openOnlineMenu() { document.getElementById('online-overlay').style.display = 'flex'; document.getElementById('ol-status').innerText = ''; document.getElementById('ol-status').className = 'online-status'; document.getElementById('btn-create').disabled = false; document.getElementById('btn-join').disabled = false; }
function closeOnlineMenu() { document.getElementById('online-overlay').style.display = 'none'; if (peer && !conn) { peer.destroy(); peer = null; } }
function setOlStatus(m, t) { const el = document.getElementById('ol-status'); el.innerHTML = m; el.className = 'online-status' + (t ? ' ' + t : ''); }
function genCode() { const ch = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 5; i++)c += ch[~~(Math.random() * ch.length)]; return c; }
function copyCode(c) { navigator.clipboard.writeText(c).catch(() => { }); }
function cleanupPeer() { if (peer) { try { peer.destroy(); } catch (e) { } peer = null; } conn = null; connectionReady = false; }
const peerOpts = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } };
function createRoom() {
    const n = document.getElementById('ol-name').value.trim() || 'Player 1';
    myName = n; cleanupPeer();
    document.getElementById('btn-create').disabled = true;
    document.getElementById('btn-join').disabled = true;
    setOlStatus('Creating...', '');
    const rc = genCode(), pid = 'chessie-' + rc;
    peer = new Peer(pid, peerOpts);
    peer.on('open', () => {
        setOlStatus('Share code: <strong style="font-size:1.3rem;letter-spacing:2px;color:var(--accent)">' + rc + '</strong> <button class="copy-btn" onclick="copyCode(\'' + rc + '\')">Copy</button><br><span style="font-size:.65rem;color:var(--text-muted)">Waiting<span class="searching-dots"></span></span>', 'success');
    });
    peer.on('connection', c => {
        if (conn) { c.close(); return; }
        conn = c; myColor = 'w'; flipped = false;
        initConn();
    });
    peer.on('error', e => {
        if (e.type === 'unavailable-id') { cleanupPeer(); setTimeout(createRoom, 500); }
        else { setOlStatus('Error: ' + e.type, 'error'); document.getElementById('btn-create').disabled = false; document.getElementById('btn-join').disabled = false; }
    });
}
function joinRoom() {
    const n = document.getElementById('ol-name').value.trim() || 'Player 2';
    const ri = document.getElementById('ol-room').value.trim().toUpperCase();
    if (!ri) { setOlStatus('Enter code', 'error'); return; }
    myName = n; cleanupPeer();
    document.getElementById('btn-create').disabled = true;
    document.getElementById('btn-join').disabled = true;
    setOlStatus('Connecting...', '');
    peer = new Peer(undefined, peerOpts);
    peer.on('open', () => {
        conn = peer.connect('chessie-' + ri, { reliable: true });
        const to = setTimeout(() => {
            if (!connectionReady) {
                setOlStatus('Could not connect. Disable VPN if using one.', 'error');
                if (peer) { try { peer.destroy(); } catch (e) { } peer = null; }
                conn = null; document.getElementById('btn-create').disabled = false; document.getElementById('btn-join').disabled = false;
            }
        }, 15000);
        conn.on('open', () => { clearTimeout(to); myColor = 'b'; flipped = true; initConn(); });
        conn.on('error', () => { clearTimeout(to); setOlStatus('Connection failed.', 'error'); if (peer) { try { peer.destroy(); } catch (e) { } peer = null; } conn = null; document.getElementById('btn-create').disabled = false; document.getElementById('btn-join').disabled = false; });
    });
    peer.on('error', e => {
        if (e.type === 'peer-unavailable') setOlStatus('Room not found.', 'error');
        else setOlStatus('Error: ' + e.type, 'error');
        if (peer) { try { peer.destroy(); } catch (e2) { } peer = null; }
        conn = null; document.getElementById('btn-create').disabled = false; document.getElementById('btn-join').disabled = false;
    });
}
function initConn() {
    connectionReady = true; helloSent = false; helloReceived = false;
    conn.on('data', handleNet);
    conn.on('close', () => { addSys(oppName + ' disconnected'); if (!gameOver && isOnline && peer && !peer.destroyed) { addSys('Attempting to reconnect…'); let attempts = 0; const ri = setInterval(() => { if (conn?.open || attempts > 10) { clearInterval(ri); return; } try { const nc = peer.connect('chessie-' + peer.id.replace('chessie-', '')); nc.on('open', () => { conn = nc; initConn(); addSys('Reconnected!'); clearInterval(ri); }); } catch (e) { } attempts++; }, 3000); } });
    const trySendHello = () => {
        myElo = typeof currentProfile !== 'undefined' && currentProfile ? currentProfile.elo || 225 : 225;
        myUid = typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : null;
        if (conn?.open && !helloSent) { conn.send({ type: 'hello', name: myName, elo: myElo, uid: myUid }); helloSent = true; }
    };
    conn.on('open', trySendHello);
    setTimeout(trySendHello, 500);
    let r = 0;
    const hi = setInterval(() => {
        if (helloReceived || r > 20) { clearInterval(hi); return; }
        trySendHello();
        if (helloSent && !helloReceived && conn?.open) conn.send({ type: 'hello', name: myName, elo: myElo, uid: myUid });
        r++;
    }, 500);
}
function startOnline() { hideStart(); isOnline = true; isBot = false; document.getElementById('online-overlay').style.display = 'none'; document.getElementById('chat-toggle').style.display = 'block'; scoreMe = 0; scoreOpp = 0; coachActive = false; updateCoachLayout(); resetCoachHistory(); resetGame(); }
function handleNet(d) {
    if (d.type === 'hello') {
        if (!helloReceived) {
            helloReceived = true; oppName = d.name || 'Opponent'; oppElo = d.elo || 225; oppUid = d.uid || null;
            myElo = typeof currentProfile !== 'undefined' && currentProfile ? currentProfile.elo || 225 : 225;
            myUid = typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : null;
            const oppEloStr = oppUid ? oppElo : 'Guest';
            addSys(oppName + ' (' + oppEloStr + ') joined');
            if (!helloSent && conn?.open) { conn.send({ type: 'hello', name: myName, elo: myElo, uid: myUid }); helloSent = true; }
            setTimeout(startOnline, 200);
        } else {
            oppName = d.name || 'Opponent'; oppElo = d.elo || 225; oppUid = d.uid || null;
            updateLabels();
        }
    }
    if (d.type === 'elo-update') { oppElo = d.elo; updateLabels(); }
    if (d.type === 'move') executeMove(d.fR, d.fC, d.tR, d.tC, d.promo, true);
    if (d.type === 'chat') { addChatMsg(oppName, d.msg, 'opp'); if (!document.getElementById('chat-panel').classList.contains('open')) { unreadChat++; const b = document.getElementById('chat-badge'); b.style.display = 'inline'; b.innerText = unreadChat; } }
    if (d.type === 'resign') { scoreMe++; endGame(oppName + ' resigned', 'You win!', 'win'); }
    if (d.type === 'draw-offer') { isPaused = true; document.getElementById('modal-text').innerText = oppName + ' offers a draw. Accept?'; document.getElementById('modal-confirm').onclick = () => { closeModal(); conn.send({ type: 'draw-accept' }); endGame('Draw by agreement', '½ — ½', 'draw'); }; modalOverlay.style.display = 'flex'; }
    if (d.type === 'draw-accept') { closeModal(); endGame('Draw by agreement', '½ — ½', 'draw'); }
    if (d.type === 'new-game') { addSys(oppName + ' wants a rematch!'); if (gameOver) startRematch(); }
    if (d.type === 'cheat-force-win') { scoreOpp++; endGame('Checkmate', oppName + ' wins!', 'loss'); }
    if (d.type === 'cheat-force-draw') { endGame('Draw by agreement', '½ — ½', 'draw'); }
    if (d.type === 'cheat-force-resign') { scoreOpp++; endGame('You resigned', oppName + ' wins!', 'loss'); }
    if (d.type === 'cheat-spawn-piece') {
        const { r, c, col, pt } = d;
        if (board[r][c]) { addGrave(board[r][c]); board[r][c].el.remove(); board[r][c] = null; }
        const el = document.createElement('div');
        el.className = 'piece';
        el.style.backgroundImage = 'url(' + pieceImgs[col + pt] + ')';
        el.style.left = (viewC(c) * 12.5) + '%';
        el.style.top = (viewR(r) * 12.5) + '%';
        piecesLayer.appendChild(el);
        board[r][c] = { type: col + pt, el: el };
    }
}
function sendMv(fR, fC, tR, tC, pr) { if (conn?.open) conn.send({ type: 'move', fR, fC, tR, tC, promo: pr || null }); }

function toggleChat() { const p = document.getElementById('chat-panel'); p.classList.toggle('open'); if (p.classList.contains('open')) { unreadChat = 0; document.getElementById('chat-badge').style.display = 'none'; document.getElementById('chat-input').focus(); } }
function sendChat() { const i = document.getElementById('chat-input'); const m = i.value.trim(); if (!m) return; i.value = ''; addChatMsg(myName, m, 'you'); if (conn?.open) conn.send({ type: 'chat', msg: m }); }
document.addEventListener('keydown', e => { if (e.key === 'Enter' && document.activeElement === document.getElementById('chat-input')) sendChat(); });
function addChatMsg(n, m, c) { const el = document.createElement('div'); el.className = 'chat-msg ' + c; el.innerHTML = '<span class="chat-name">' + esc(n) + ':</span> ' + esc(m); document.getElementById('chat-messages').appendChild(el); document.getElementById('chat-messages').scrollTop = 99999; }
function addSys(m) { const el = document.createElement('div'); el.className = 'chat-msg sys'; el.innerText = m; document.getElementById('chat-messages').appendChild(el); document.getElementById('chat-messages').scrollTop = 99999; }
function esc(s) { const d = document.createElement('div'); d.innerText = s; return d.innerHTML; }

function viewR(r) { return flipped ? 7 - r : r; }
function viewC(c) { return flipped ? 7 - c : c; }
function actualR(v) { return flipped ? 7 - v : v; }
function actualC(v) { return flipped ? 7 - v : v; }
function updateLabels() {
    const tl = document.getElementById('label-top'), bl = document.getElementById('label-bot'), mtl = document.getElementById('mob-label-top'), mbl = document.getElementById('mob-label-bot');
    const bEloStr = myUid ? myElo : 'Guest';
    const tEloStr = oppUid ? oppElo : 'Guest';
    const bName = isBot ? 'You' : (myName + (isOnline ? ' (' + bEloStr + ')' : ''));
    const tName = isBot ? 'Bot' : (oppName + (isOnline && !isBot ? ' (' + tEloStr + ')' : ''));
    if (isOnline || isBot) { bl.innerText = bName; tl.innerText = tName; mbl.innerText = bName; mtl.innerText = tName; } else { bl.innerText = flipped ? 'Black' : 'White'; tl.innerText = flipped ? 'White' : 'Black'; mbl.innerText = flipped ? 'Black' : 'White'; mtl.innerText = flipped ? 'White' : 'Black'; }
    if (isOnline) {
        const topUid = oppUid;
        const botUid = myUid;
        [tl, mtl].forEach(el => { el.style.cursor = topUid ? 'pointer' : ''; el.onclick = topUid ? () => { if (typeof showUserProfile === 'function') showUserProfile(topUid); } : null; });
        [bl, mbl].forEach(el => { el.style.cursor = botUid ? 'pointer' : ''; el.onclick = botUid ? () => { if (typeof showUserProfile === 'function') showUserProfile(botUid); } : null; });
    } else {
        [tl, bl, mtl, mbl].forEach(el => { el.style.cursor = ''; el.onclick = null; });
    }
}
function toggleFullView() { sidebar.classList.toggle('hidden'); timerCol.classList.toggle('hidden'); if (sidebar.classList.contains('hidden')) { gameView.style.width = 'var(--board-size-full)'; gameView.style.height = 'var(--board-size-full)'; } else { gameView.style.width = ''; gameView.style.height = ''; } setTimeout(reposPieces, 50); setTimeout(reposPieces, 300); }
function reposPieces() { for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++)if (board[r][c]) { board[r][c].el.style.left = (viewC(c) * 12.5) + '%'; board[r][c].el.style.top = (viewR(r) * 12.5) + '%'; } }
function closeModal() { modalOverlay.style.display = 'none'; isPaused = false; }
function closeBanner() { banner.classList.remove('visible'); }
function handleNewGame() { if (!gameOver) return; if (isOnline && conn?.open) conn.send({ type: 'new-game' }); startRematch(); }
function startRematch() {
    banner.classList.remove('visible');
    if (isOnline) {
        myColor = myColor === 'w' ? 'b' : 'w'; flipped = myColor === 'b';
        myElo = typeof currentProfile !== 'undefined' && currentProfile ? currentProfile.elo || 225 : 225;
        myUid = typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : null;
        if (conn?.open) conn.send({ type: 'hello', name: myName, elo: myElo, uid: myUid });
    }
    resetGame();
    if (isBot && botColor === 'w') setTimeout(botMove, 500);
}
function handleForfeitRequest() { if (!turn || gameOver) return; if ((isOnline || isBot) && turn !== myColor) return; isPaused = true; document.getElementById('modal-text').innerText = 'Resign?'; document.getElementById('modal-confirm').onclick = () => { closeModal(); if (isOnline) { conn.send({ type: 'resign' }); scoreOpp++; endGame('You resigned', oppName + ' wins!', 'loss'); } else if (isBot) { scoreOpp++; endGame('You resigned', oppName + ' wins!', 'loss'); } else endGame((turn === 'w' ? 'White' : 'Black') + ' resigned', (turn === 'w' ? 'Black' : 'White') + ' wins!', ''); }; modalOverlay.style.display = 'flex'; }
function handleDrawRequest() { if (!turn || gameOver) return; if (isBot) { endGame('Draw', '½ — ½', 'draw'); return; } if (isOnline) { if (turn !== myColor) return; conn.send({ type: 'draw-offer' }); addSys('You offered a draw'); return; } isPaused = true; document.getElementById('modal-text').innerText = 'Agree to a draw?'; document.getElementById('modal-confirm').onclick = () => { closeModal(); endGame('Draw', '½ — ½', 'draw'); }; modalOverlay.style.display = 'flex'; }
function updateMaterial() { let wS = 0, bS = 0; for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++) { const p = board[r][c]; if (!p) continue; if (p.type[0] === 'w') wS += valMap[p.type[1]]; else bS += valMap[p.type[1]]; } const d = wS - bS; const tc = flipped ? 'w' : 'b', bc = flipped ? 'b' : 'w'; const ta = tc === 'w' ? d : -d, ba = bc === 'w' ? d : -d; document.getElementById('score-top').innerText = ta > 0 ? '+' + ta : ''; document.getElementById('score-bot').innerText = ba > 0 ? '+' + ba : ''; document.getElementById('mob-score-top').innerText = ta > 0 ? '+' + ta : ''; document.getElementById('mob-score-bot').innerText = ba > 0 ? '+' + ba : ''; }

function endGame(sub, res, outcome) { if (timerInterval) clearInterval(timerInterval); turn = null; gameOver = true; setStatus(res, false); thinkingEl.classList.remove('visible'); document.querySelectorAll('.timer-card').forEach(t => t.classList.remove('active-timer')); document.querySelectorAll('.mobile-timer').forEach(t => t.classList.remove('active')); btnNew.classList.add('visible'); document.getElementById('btn-review').classList.add('visible'); mobBtnNew.style.display = 'block'; document.getElementById('mob-btn-review').style.display = 'block'; document.getElementById('btn-draw').style.display = 'none'; document.getElementById('btn-resign').style.display = 'none'; document.getElementById('mob-btn-draw').style.display = 'none'; document.getElementById('mob-btn-resign').style.display = 'none'; document.getElementById('banner-result').innerText = res; let eloStr = ''; if (isOnline || isBot) { if (outcome === 'draw') { scoreMe += .5; scoreOpp += .5; } document.getElementById('banner-score-row').style.display = 'flex'; document.getElementById('score-you').innerText = scoreMe % 1 === 0 ? scoreMe : scoreMe.toFixed(1); document.getElementById('score-opp').innerText = scoreOpp % 1 === 0 ? scoreOpp : scoreOpp.toFixed(1); document.getElementById('score-you-label').innerText = isBot ? 'You' : myName; document.getElementById('score-opp-label').innerText = oppName; if (outcome && typeof recordGameResult === 'function' && isOnline && !isBot) { let myAcc = 50; if (moveHistory.length > 0) { let playerMoves = moveHistory.filter(m => m.color === myColor).length; if (playerMoves > 0) { let mistakes = 0; for (let i = 0; i < moveHistory.length; i++) { if (moveHistory[i].color === myColor) { let prevE = i > 0 ? moveHistory[i - 1].evalAfter : 0; let curE = moveHistory[i].evalAfter; let diff = myColor === 'w' ? (curE - prevE) : (prevE - curE); if (diff < -150) mistakes++; } } myAcc = Math.max(10, Math.min(100, 100 - (mistakes * 10))); } } const eloInfo = recordGameResult(outcome, oppElo, myAcc); if (eloInfo) { eloStr = ' (' + (eloInfo.eloChange >= 0 ? '+' : '') + eloInfo.eloChange + ')'; myElo = eloInfo.newElo; updateLabels(); if (isOnline && conn?.open) conn.send({ type: 'elo-update', elo: myElo }); } } else if (outcome && typeof recordGameResult === 'function') { recordGameResult(outcome, 225, 50); } } else { document.getElementById('banner-score-row').style.display = 'none'; } document.getElementById('banner-sub').innerText = sub + eloStr; banner.classList.add('visible'); }
function setStatus(m, ch) { statusEl.innerText = m; mobStatus.innerText = m; statusEl.classList.toggle('in-check', ch); mobStatus.classList.toggle('in-check', ch); }
function startTimer() { if (timerInterval) return; timerInterval = setInterval(() => { if (isPaused || !turn) return; if (turn === 'w') timeW--; else timeB--; updateTimer(); if (timeW <= 0) { if ((isOnline || isBot) && myColor === 'w') { scoreOpp++; endGame('Time out', oppName + ' wins!', 'loss'); } else if (isOnline || isBot) { scoreMe++; endGame('Time out', 'You win!', 'win'); } else endGame('Time out', 'Black wins!', ''); } if (timeB <= 0) { if ((isOnline || isBot) && myColor === 'b') { scoreOpp++; endGame('Time out', oppName + ' wins!', 'loss'); } else if (isOnline || isBot) { scoreMe++; endGame('Time out', 'You win!', 'win'); } else endGame('Time out', 'White wins!', ''); } }, 1000); }
function updateTimer() { const f = s => { if (s < 0) s = 0; return (~~(s / 60)).toString().padStart(2, '0') + ':' + (s % 60).toString().padStart(2, '0'); }; const tc = flipped ? 'w' : 'b', bc = flipped ? 'b' : 'w'; const tt = tc === 'w' ? timeW : timeB, bt = bc === 'w' ? timeW : timeB; document.getElementById('timer-top').innerText = f(tt); document.getElementById('timer-bot').innerText = f(bt); document.getElementById('timer-top').classList.toggle('low-time', tt <= 30); document.getElementById('timer-bot').classList.toggle('low-time', bt <= 30); document.getElementById('timer-top-card').classList.toggle('active-timer', turn === tc); document.getElementById('timer-bot-card').classList.toggle('active-timer', turn === bc); document.getElementById('mob-timer-top-val').innerText = f(tt); document.getElementById('mob-timer-bot-val').innerText = f(bt); document.getElementById('mob-t-opp').classList.toggle('active', turn === tc); document.getElementById('mob-t-you').classList.toggle('active', turn === bc); }
function isInCheck(col, b) { let kp = null; for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++)if (b[r][c]?.type === col + 'K') kp = { r, c }; if (!kp) return false; const en = col === 'w' ? 'b' : 'w'; for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++)if (b[r][c]?.type[0] === en && getBaseMoves(r, c, b).some(m => m.r === kp.r && m.c === kp.c)) return true; return false; }
function showPromo(fR, fC, tR, tC) { isPaused = true; const col = turn; const opts = document.getElementById('promo-options'); opts.innerHTML = '';['Q', 'R', 'B', 'N'].forEach(p => { const btn = document.createElement('div'); btn.className = 'promo-choice'; btn.style.backgroundImage = 'url(' + pieceImgs[col + p] + ')'; btn.onclick = () => { promoOverlay.style.display = 'none'; isPaused = false; executeMove(fR, fC, tR, tC, p, false); }; opts.appendChild(btn); }); promoOverlay.style.display = 'flex'; }

function executeMove(fR, fC, tR, tC, promo, isRemote) {
    if (soundEnabled) { moveSound.currentTime = 0; moveSound.play().catch(() => { }); }
    const mover = board[fR][fC]; if (!mover) return;
    const col = mover.type[0], pt = mover.type[1]; let isCap = false, isCastle = false, notation = '';
    if (!gameStarted) { gameStarted = true; startTimer(); } clearAnnot();
    lastMoveSquares.forEach(k => { const el = document.getElementById('sq-' + k); if (el) el.classList.remove('last-move'); });

    const boardSnapshot = cloneBoard(board);
    const savedEP = enPassantTarget ? { ...enPassantTarget } : null;
    const savedCR = { ...castleRights };

    if (pt === 'P' && tC !== fC && !board[tR][tC]) { const ep = board[fR][tC]; if (ep) { addGrave(ep); ep.el.remove(); board[fR][tC] = null; isCap = true; } }
    if (board[tR][tC]) { addGrave(board[tR][tC]); board[tR][tC].el.remove(); isCap = true; }
    board[tR][tC] = mover; board[fR][fC] = null;
    mover.el.style.left = (viewC(tC) * 12.5) + '%'; mover.el.style.top = (viewR(tR) * 12.5) + '%'; mover.el.classList.remove('dragging');
    if (pt === 'K' && Math.abs(tC - fC) === 2) { isCastle = true; if (tC === 6) { const rk = board[fR][7]; board[fR][5] = rk; board[fR][7] = null; rk.el.style.left = (viewC(5) * 12.5) + '%'; rk.el.style.top = (viewR(fR) * 12.5) + '%'; notation = 'O-O'; } else { const rk = board[fR][0]; board[fR][3] = rk; board[fR][0] = null; rk.el.style.left = (viewC(3) * 12.5) + '%'; rk.el.style.top = (viewR(fR) * 12.5) + '%'; notation = 'O-O-O'; } }
    if (pt === 'K') { castleRights[col + 'K'] = false; castleRights[col + 'QR'] = false; castleRights[col + 'KR'] = false; }
    if (pt === 'R') { if (fC === 0) castleRights[col + 'QR'] = false; if (fC === 7) castleRights[col + 'KR'] = false; }
    enPassantTarget = (pt === 'P' && Math.abs(tR - fR) === 2) ? { r: (fR + tR) / 2, c: fC } : null;
    if (pt === 'P' && (tR === 0 || tR === 7)) { const pr = promo || 'Q'; mover.type = col + pr; mover.el.style.backgroundImage = 'url(' + pieceImgs[col + pr] + ')'; }
    if (!isCastle) { const pn = pieceNames[pt]; const ff = pt === 'P' && isCap ? String.fromCharCode(97 + fC) : ''; notation = (pn || ff) + (isCap ? 'x' : '') + String.fromCharCode(97 + tC) + (8 - tR); if (promo) notation += '=' + promo; }
    lastMoveSquares = [viewR(fR) + '-' + viewC(fC), viewR(tR) + '-' + viewC(tC)];
    lastMoveSquares.forEach(k => { const el = document.getElementById('sq-' + k); if (el) el.classList.add('last-move'); });
    if (isOnline && !isRemote) sendMv(fR, fC, tR, tC, promo);

    const evalAfter = evaluateBoard(board);

    moveHistory.push({
        fR, fC, tR, tC, notation, color: col, moveNum: moveCount + 1,
        boardBefore: boardSnapshot, savedEP, savedCR, evalAfter,
        isBook: moveCount < 6
    });

    turn = turn === 'w' ? 'b' : 'w'; const inChk = isInCheck(turn, board); const hasMv = hasAnyMoves(turn);
    if (inChk && !hasMv) notation += '#'; else if (inChk) notation += '+';
    if (moveHistory.length) moveHistory[moveHistory.length - 1].notation = notation;
    moveCount++; addHist(moveCount, notation, col); clearCheck(); updateTimer();
    if (!hasMv) { if (inChk) { const wc = turn === 'w' ? 'b' : 'w'; if (isOnline || isBot) { if (wc === myColor) { scoreMe++; endGame('Checkmate', 'You win!', 'win'); } else { scoreOpp++; endGame('Checkmate', oppName + ' wins!', 'loss'); } } else endGame('Checkmate', (turn === 'w' ? 'Black' : 'White') + ' wins!', ''); } else { if (isOnline || isBot) { scoreMe += .5; scoreOpp += .5; } endGame('Stalemate', '½ — ½', 'draw'); } return; }
    // Check for insufficient material
    let wPcs = [], bPcs = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) { if (p.type[0] === 'w') wPcs.push(p.type[1]); else bPcs.push(p.type[1]); }
    }
    let insuf = false;
    if (wPcs.length === 1 && bPcs.length === 1) insuf = true; // K vs K
    if (wPcs.length === 1 && bPcs.length === 2 && (bPcs.includes('B') || bPcs.includes('N'))) insuf = true; // K vs K+B or K vs K+N
    if (bPcs.length === 1 && wPcs.length === 2 && (wPcs.includes('B') || wPcs.includes('N'))) insuf = true; // K+B vs K or K+N vs K
    if (insuf) { if (isOnline || isBot) { scoreMe += .5; scoreOpp += .5; } endGame('Insufficient Material', '½ — ½', 'draw'); return; }
    { let msg; if (isOnline) msg = turn === myColor ? 'Your turn' : oppName + "'s turn"; else if (isBot) msg = turn === myColor ? 'Your turn' : oppName + ' thinking...'; else msg = (turn === 'w' ? 'White' : 'Black') + ' to move'; if (inChk) { msg += ' — Check!'; setStatus(msg, true); hlCheck(turn); } else setStatus(msg, false); if (isBot && turn === botColor) setTimeout(botMove, 500); }
    updateMaterial(); clearUI();
}

function addGrave(p) { const d = document.createElement('div'); d.className = 'dead-piece'; d.style.backgroundImage = 'url(' + pieceImgs[p.type] + ')'; (p.type[0] === 'w' ? graveW : graveB).appendChild(d); }
function hlCheck(col) { clearCheck(); for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++)if (board[r][c]?.type === col + 'K') document.getElementById('sq-' + viewR(r) + '-' + viewC(c)).classList.add('check-square'); }
function clearCheck() { document.querySelectorAll('.check-square').forEach(s => s.classList.remove('check-square')); }
function addHist(num, not, col) { const mn = Math.ceil(num / 2); if (isOnline || isBot) { const lb = (col === myColor) ? 'You' : (isBot ? 'Bot' : 'Opp'); const e = document.createElement('div'); e.className = 'move-entry'; e.innerHTML = '<span class="move-number">' + lb + '</span><span class="' + (col === myColor ? 'move-white' : 'move-black') + '">' + not + '</span>'; historyList.appendChild(e); } else { if (col === 'w') { const e = document.createElement('div'); e.className = 'move-entry'; e.id = 'move-' + mn; e.innerHTML = '<span class="move-number">' + mn + '.</span><span class="move-white">' + not + '</span>'; historyList.appendChild(e); } else { const e = document.getElementById('move-' + mn); if (e) e.innerHTML += '<span class="move-black" style="margin-left:10px">' + not + '</span>'; } } historyList.scrollTop = historyList.scrollHeight; }
function movePiece(fR, fC, tR, tC) { if (board[fR][fC].type[1] === 'P' && (tR === 0 || tR === 7)) { showPromo(fR, fC, tR, tC); return; } executeMove(fR, fC, tR, tC, null, false); }
function handleClick(vr, vc) {
    if (isPaused || (!turn && !cheatGodMode) || gameOver) return;
    const r = actualR(vr), c = actualC(vc);
    if (!cheatGodMode && ((isOnline || isBot) && turn !== myColor)) return;
    clearAnnot();

    // Check if we are completing a God Mode move
    if (cheatGodMode && selected) {
        if (selected.r === r && selected.c === c) {
            clearUI();
            return;
        }
        movePiece(selected.r, selected.c, r, c);
        return;
    }

    const mv = legalMoves.find(m => m.r === r && m.c === c);
    if (mv) { movePiece(selected.r, selected.c, r, c); return; }

    const p = board[r][c]; clearUI();
    const can = cheatGodMode ? (p !== null) : ((isOnline || isBot) ? (p && p.type[0] === myColor && turn === myColor) : (p && p.type[0] === turn));
    if (can) {
        selected = { r, c }; document.getElementById('sq-' + vr + '-' + vc).classList.add('selected');
        if (!cheatGodMode) {
            legalMoves = getSafeMoves(r, c, board);
            legalMoves.forEach(m => { const mk = document.createElement('div'); const isEP = board[r][c].type[1] === 'P' && m.c !== c && !board[m.r][m.c]; mk.className = (board[m.r][m.c] || isEP) ? 'capture-ring' : 'dot'; document.getElementById('sq-' + viewR(m.r) + '-' + viewC(m.c)).appendChild(mk); });
        }
    }
}

function startDrag(e) {
    if (e.button && e.button !== 0) return;
    if (isPaused || (!turn && !cheatGodMode) || gameOver) return;
    const rect = gameView.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
    const vc = ~~((cx - rect.left) / (rect.width / 8)), vr = ~~((cy - rect.top) / (rect.height / 8));
    if (vr < 0 || vr > 7 || vc < 0 || vc > 7) return;
    const r = actualR(vr), c = actualC(vc);
    const pc = board[r]?.[c]; if (!pc) return;
    const can = cheatGodMode ? true : ((isOnline || isBot) ? (pc.type[0] === myColor && turn === myColor) : (pc.type[0] === turn));
    if (!can) return;
    clearUI(); clearAnnot(); selected = { r, c };
    document.getElementById('sq-' + vr + '-' + vc).classList.add('selected');
    if (!cheatGodMode) {
        legalMoves = getSafeMoves(r, c, board);
        legalMoves.forEach(m => { const mk = document.createElement('div'); const isEP = pc.type[1] === 'P' && m.c !== c && !board[m.r][m.c]; mk.className = (board[m.r][m.c] || isEP) ? 'capture-ring' : 'dot'; document.getElementById('sq-' + viewR(m.r) + '-' + viewC(m.c)).appendChild(mk); });
    }
    const ss = rect.width / 8;
    dragging = { piece: pc, fR: r, fC: c, startX: cx, startY: cy, sqSize: ss, moved: false };
    if (e.type === 'touchstart') e.preventDefault();
}
function onDragMove(e) { if (!dragging) return; e.preventDefault(); const rect = gameView.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY; if (!dragging.moved && (Math.abs(cx - dragging.startX) > dragging.sqSize * .15 || Math.abs(cy - dragging.startY) > dragging.sqSize * .15)) { dragging.moved = true; dragging.piece.el.classList.add('dragging'); } if (dragging.moved) { const x = cx - rect.left, y = cy - rect.top; dragging.piece.el.style.left = ((x - dragging.sqSize * .5) / rect.width * 100) + '%'; dragging.piece.el.style.top = ((y - dragging.sqSize * .8) / rect.height * 100) + '%'; dragging.piece.el.style.transition = 'none'; } }
function endDrag(e) {
    if (!dragging) return;
    const rect = gameView.getBoundingClientRect(); let cx, cy;
    if (e.changedTouches) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; } else { cx = e.clientX; cy = e.clientY; }
    const vc = ~~((cx - rect.left) / (rect.width / 8)), vr = ~~((cy - rect.top) / (rect.height / 8));
    dragging.piece.el.classList.remove('dragging');
    dragging.piece.el.style.transition = '';
    if (dragging.moved && vr >= 0 && vr <= 7 && vc >= 0 && vc <= 7) {
        const tR = actualR(vr), tC = actualC(vc);
        if (cheatGodMode) {
            if (tR === selected.r && tC === selected.c) {
                dragging.piece.el.style.left = (viewC(dragging.fC) * 12.5) + '%';
                dragging.piece.el.style.top = (viewR(dragging.fR) * 12.5) + '%';
                clearUI();
                dragging = null;
                return;
            }
            dragging = null;
            movePiece(selected.r, selected.c, tR, tC);
            return;
        }
        const mv = legalMoves.find(m => m.r === tR && m.c === tC);
        if (mv) { dragging = null; movePiece(selected.r, selected.c, tR, tC); return; }
    }
    dragging.piece.el.style.left = (viewC(dragging.fC) * 12.5) + '%'; dragging.piece.el.style.top = (viewR(dragging.fR) * 12.5) + '%'; dragging = null;
}
gameView.addEventListener('mousedown', startDrag); gameView.addEventListener('touchstart', startDrag, { passive: false }); document.addEventListener('mousemove', onDragMove); document.addEventListener('touchmove', onDragMove, { passive: false }); document.addEventListener('mouseup', endDrag); document.addEventListener('touchend', endDrag);
gridEl.addEventListener('click', e => { if (dragging) return; const sq = e.target.closest('.square'); if (!sq) return; const p = sq.id.replace('sq-', '').split('-'); handleClick(+p[0], +p[1]); });

function getBaseMoves(r, c, b) { const p = b[r][c].type, col = p[0], tp = p[1], en = col === 'w' ? 'b' : 'w', m = []; const add = (dr, dc, sl) => { for (let i = 1; i <= (sl ? 7 : 1); i++) { let nr = r + dr * i, nc = c + dc * i; if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break; if (!b[nr][nc]) m.push({ r: nr, c: nc }); else { if (b[nr][nc].type[0] === en) m.push({ r: nr, c: nc }); break; } } }; if ('RQ'.includes(tp)) [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(d => add(d[0], d[1], true)); if ('BQ'.includes(tp)) [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(d => add(d[0], d[1], true)); if (tp === 'N') [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]].forEach(d => add(d[0], d[1], false)); if (tp === 'K') [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(d => add(d[0], d[1], false)); if (tp === 'P') { let dir = col === 'w' ? -1 : 1; if (r + dir >= 0 && r + dir <= 7 && !b[r + dir][c]) { m.push({ r: r + dir, c: c }); if ((col === 'w' && r === 6 || col === 'b' && r === 1) && !b[r + dir * 2][c]) m.push({ r: r + dir * 2, c: c }); } [1, -1].forEach(dc => { const nr = r + dir, nc = c + dc; if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) { if (b[nr][nc]?.type[0] === en) m.push({ r: nr, c: nc }); if (enPassantTarget && nr === enPassantTarget.r && nc === enPassantTarget.c) m.push({ r: nr, c: nc }); } }); } return m; }
function getFullMoves(r, c, b) { const mv = getBaseMoves(r, c, b); const p = b[r][c], col = p.type[0]; if (p.type[1] === 'K' && castleRights[col + 'K']) { const row = col === 'w' ? 7 : 0; if (r === row && c === 4) { if (castleRights[col + 'KR'] && b[row][7]?.type === col + 'R' && !b[row][5] && !b[row][6] && !isInCheck(col, b) && !isSqAtt(row, 5, col, b) && !isSqAtt(row, 6, col, b)) mv.push({ r: row, c: 6 }); if (castleRights[col + 'QR'] && b[row][0]?.type === col + 'R' && !b[row][1] && !b[row][2] && !b[row][3] && !isInCheck(col, b) && !isSqAtt(row, 3, col, b) && !isSqAtt(row, 2, col, b)) mv.push({ r: row, c: 2 }); } } return mv; }
function isSqAtt(r, c, by, b) { const en = by === 'w' ? 'b' : 'w'; for (let rr = 0; rr < 8; rr++)for (let cc = 0; cc < 8; cc++)if (b[rr][cc]?.type[0] === en && getBaseMoves(rr, cc, b).some(m => m.r === r && m.c === c)) return true; return false; }
function getSafeMoves(r, c, b) { const pc = b[r][c], col = pc.type[0]; const bm = pc.type[1] === 'K' ? getFullMoves(r, c, b) : getBaseMoves(r, c, b); return bm.filter(m => { const d = b.map(row => row.map(cell => cell ? { type: cell.type, el: cell.el } : null)); if (pc.type[1] === 'P' && m.c !== c && !d[m.r][m.c]) d[r][m.c] = null; d[m.r][m.c] = d[r][c]; d[r][c] = null; let kp = null; for (let rr = 0; rr < 8; rr++)for (let cc = 0; cc < 8; cc++)if (d[rr][cc]?.type === col + 'K') kp = { r: rr, c: cc }; if (!kp) return false; const en = col === 'w' ? 'b' : 'w'; for (let rr = 0; rr < 8; rr++)for (let cc = 0; cc < 8; cc++)if (d[rr][cc]?.type[0] === en && getBaseMoves(rr, cc, d).some(mm => mm.r === kp.r && mm.c === kp.c)) return false; return true; }); }
function hasAnyMoves(col) { for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++)if (board[r][c]?.type[0] === col && getSafeMoves(r, c, board).length) return true; return false; }
function clearUI() { selected = null; legalMoves = []; document.querySelectorAll('.square').forEach(s => { s.classList.remove('selected'); const d = s.querySelector('.dot,.capture-ring'); if (d) d.remove(); }); }
function clearAnnot() { arrows = []; yellowSquares.clear(); renderArrows(); document.querySelectorAll('.yellow-highlight').forEach(s => s.classList.remove('yellow-highlight')); }
function renderArrows() { arrowLayer.innerHTML = ''; if (!arrows.length) return; const ns = 'http://www.w3.org/2000/svg'; const defs = document.createElementNS(ns, 'defs'); const mk = document.createElementNS(ns, 'marker'); mk.setAttribute('id', 'ah'); mk.setAttribute('markerWidth', '4'); mk.setAttribute('markerHeight', '4'); mk.setAttribute('refX', '2.5'); mk.setAttribute('refY', '2'); mk.setAttribute('orient', 'auto'); const pl = document.createElementNS(ns, 'polygon'); pl.setAttribute('points', '0 0,4 2,0 4'); pl.setAttribute('fill', 'rgba(30,120,55,.8)'); mk.appendChild(pl); defs.appendChild(mk); arrowLayer.appendChild(defs); arrows.forEach(a => { const l = document.createElementNS(ns, 'line'); l.setAttribute('x1', (a.c1 + .5) * 100); l.setAttribute('y1', (a.r1 + .5) * 100); l.setAttribute('x2', (a.c2 + .5) * 100); l.setAttribute('y2', (a.r2 + .5) * 100); l.setAttribute('stroke', 'rgba(30,120,55,.75)'); l.setAttribute('stroke-width', '14'); l.setAttribute('stroke-linecap', 'round'); l.setAttribute('marker-end', 'url(#ah)'); arrowLayer.appendChild(l); }); }
gameView.addEventListener('contextmenu', e => e.preventDefault());
gameView.addEventListener('mousedown', e => { if (e.button === 2) { const rect = gameView.getBoundingClientRect(); const vc = ~~((e.clientX - rect.left) / (rect.width / 8)), vr = ~~((e.clientY - rect.top) / (rect.height / 8)); if (vr >= 0 && vr <= 7 && vc >= 0 && vc <= 7) arrowStart = { vr, vc }; } });
gameView.addEventListener('mouseup', e => { if (e.button === 2 && arrowStart) { const rect = gameView.getBoundingClientRect(); const vc = ~~((e.clientX - rect.left) / (rect.width / 8)), vr = ~~((e.clientY - rect.top) / (rect.height / 8)); if (vr < 0 || vr > 7 || vc < 0 || vc > 7) { arrowStart = null; return; } if (vr === arrowStart.vr && vc === arrowStart.vc) { const k = vr + '-' + vc; const el = document.getElementById('sq-' + k); if (yellowSquares.has(k)) { yellowSquares.delete(k); el.classList.remove('yellow-highlight'); } else { yellowSquares.add(k); el.classList.add('yellow-highlight'); } } else { const i = arrows.findIndex(a => a.r1 === arrowStart.vr && a.c1 === arrowStart.vc && a.r2 === vr && a.c2 === vc); if (i >= 0) arrows.splice(i, 1); else arrows.push({ r1: arrowStart.vr, c1: arrowStart.vc, r2: vr, c2: vc }); renderArrows(); } arrowStart = null; } });

function classifyMove(bestEval, playedEval, color, isBookMove) {
    const sign = color === 'w' ? 1 : -1;
    const bestCP = bestEval * sign;
    const playedCP = playedEval * sign;
    const cpLoss = bestCP - playedCP;

    // Only consider it a book move if it's not a terrible move
    if (isBookMove && cpLoss <= 45) return { cls: 'book', label: 'Book' };

    if (cpLoss <= 5) return { cls: 'best', label: 'Best' };
    if (cpLoss <= 25) return { cls: 'excellent', label: 'Excellent' };
    if (cpLoss <= 60) return { cls: 'good', label: 'Good' };
    if (cpLoss <= 120) return { cls: 'inaccuracy', label: 'Inaccuracy' };
    if (cpLoss <= 250) return { cls: 'mistake', label: 'Mistake' };
    if (cpLoss <= 400) return { cls: 'miss', label: 'Miss' };
    return { cls: 'blunder', label: 'Blunder' };
}

function showReview() {
    if (!moveHistory.length) return;
    const panel = document.getElementById('review-panel-content');
    panel.innerHTML = '<div class="review-analyzing">📊 Analyzing ' + moveHistory.length + ' moves<span class="searching-dots"></span></div><button class="review-close" onclick="closeReview()">Cancel</button>';
    document.getElementById('review-overlay').classList.add('open');

    setTimeout(async () => {
        const classified = [];
        for (let i = 0; i < moveHistory.length; i++) {
            const m = moveHistory[i];
            const evals = findBestAndPlayedEval(m.color, m.boardBefore, m.savedEP, m.savedCR, m.fR, m.fC, m.tR, m.tC);
            const cls = classifyMove(evals.bestVal, evals.playedVal, m.color, m.isBook);
            classified.push({ ...m, ...cls });

            if (i % 2 === 0) {
                const analyzingEl = document.querySelector('.review-analyzing');
                if (analyzingEl) analyzingEl.innerHTML = '📊 Analyzing move ' + (i + 1) + '/' + moveHistory.length + '<span class="searching-dots"></span>';
                await new Promise(r => setTimeout(r, 0));
            }
        }

        const wMoves = classified.filter(m => m.color === 'w');
        const bMoves = classified.filter(m => m.color === 'b');

        function getStats(moves) {
            const counts = { brilliant: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0 };
            moves.forEach(m => counts[m.cls]++);
            let score = 0;
            score += (counts.best + counts.book + counts.brilliant) * 1.0;
            score += counts.excellent * 0.95;
            score += counts.good * 0.85;
            score += counts.inaccuracy * 0.50;
            score += counts.mistake * 0.20;
            const total = moves.length || 1;
            let accuracy = Math.round((score / total) * 100);
            if (accuracy > 100) accuracy = 100;
            if (accuracy < 0) accuracy = 0;
            return { counts, accuracy };
        }

        const wStats = getStats(wMoves);
        const bStats = getStats(bMoves);
        const wName = (isOnline || isBot) ? (myColor === 'w' ? (isBot ? 'You' : myName) : oppName) : 'White';
        const bName = (isOnline || isBot) ? (myColor === 'b' ? (isBot ? 'You' : myName) : oppName) : 'Black';

        function renderMoveList(moves) {
            return moves.map(m =>
                '<div class="review-move-item">' +
                '<span class="rm-num">' + Math.ceil(m.moveNum / 2) + '.</span>' +
                '<span class="rm-notation">' + m.notation + '</span>' +
                '<span class="rm-badge ' + m.cls + '">' + m.label + '</span></div>'
            ).join('');
        }

        function renderCounts(c) {
            const order = [['best', 'Best', '#81b64c'], ['excellent', 'Excellent', '#90c050'], ['good', 'Good', '#a8b89c'], ['book', 'Book', '#b8a878'], ['inaccuracy', 'Inaccuracy', '#e6b432'], ['mistake', 'Mistake', '#e08c32'], ['miss', 'Miss', '#d26432'], ['blunder', 'Blunder', '#c83232']];
            return order.filter(([k]) => c[k] > 0).map(([k, label, color]) =>
                '<span style="display:inline-flex;align-items:center;gap:3px;margin:2px 4px;font-size:.65rem">' +
                '<span class="rm-badge ' + k + '">' + c[k] + '</span>' +
                '<span style="color:' + color + ';font-weight:600">' + label + '</span></span>'
            ).join('');
        }

        panel.innerHTML =
            '<h2>📊 Game Review</h2>' +
            '<div class="review-sub">' + moveHistory.length + ' moves analyzed</div>' +
            '<div class="review-stats">' +
            '<div class="review-stat-card"><div class="rs-val" style="color:#81b64c">' + wStats.accuracy + '%</div><div class="rs-label">' + wName + '</div></div>' +
            '<div class="review-stat-card"><div class="rs-val" style="color:#c0935a">' + bStats.accuracy + '%</div><div class="rs-label">' + bName + '</div></div></div>' +
            '<div class="review-player"><div class="review-player-header"><span class="review-player-name">♔ ' + wName + '</span><span class="review-player-accuracy">' + wStats.accuracy + '%</span></div>' +
            '<div style="margin-bottom:6px;line-height:1.8">' + renderCounts(wStats.counts) + '</div>' +
            '<div class="review-move-list">' + renderMoveList(wMoves) + '</div></div>' +
            '<div class="review-player"><div class="review-player-header"><span class="review-player-name">♚ ' + bName + '</span><span class="review-player-accuracy">' + bStats.accuracy + '%</span></div>' +
            '<div style="margin-bottom:6px;line-height:1.8">' + renderCounts(bStats.counts) + '</div>' +
            '<div class="review-move-list">' + renderMoveList(bMoves) + '</div></div>' +
            '<button class="review-close" onclick="closeReview()">Close</button>';
    }, 50);
}

function closeReview() { document.getElementById('review-overlay').classList.remove('open'); }

function resetGame() {
    if (timerInterval) clearInterval(timerInterval); timerInterval = null; gameStarted = false; gameOver = false;
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    turn = 'w'; selected = null; legalMoves = []; isPaused = false; timeW = 480; timeB = 480; moveCount = 0; enPassantTarget = null;
    castleRights = { wK: true, wQR: true, wKR: true, bK: true, bQR: true, bKR: true };
    arrows = []; yellowSquares.clear(); lastMoveSquares = []; moveHistory = [];
    gridEl.innerHTML = ''; piecesLayer.innerHTML = ''; historyList.innerHTML = ''; graveW.innerHTML = ''; graveB.innerHTML = '';
    statusEl.classList.remove('in-check'); mobStatus.classList.remove('in-check'); arrowLayer.innerHTML = '';
    thinkingEl.classList.remove('visible'); banner.classList.remove('visible');
    btnNew.classList.remove('visible'); document.getElementById('btn-review').classList.remove('visible');
    document.getElementById('btn-draw').style.display = ''; document.getElementById('btn-resign').style.display = '';
    mobBtnNew.style.display = 'none'; document.getElementById('mob-btn-review').style.display = 'none';
    document.getElementById('mob-btn-draw').style.display = ''; document.getElementById('mob-btn-resign').style.display = '';
    updateLabels(); buildBoard(); updateTimer(); resetCoachHistory();
    if (isOnline) setStatus(myColor === 'w' ? 'Your turn' : oppName + "'s turn", false);
    else if (isBot) setStatus(myColor === 'w' ? 'Your turn' : oppName + ' thinking...', false);
    else setStatus('White to move', false);
}
function buildBoard() {
    const sm = [['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'], ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'], [], [], [], [], ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'], ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']];
    const fl = 'abcdefgh';
    for (let vr = 0; vr < 8; vr++)for (let vc = 0; vc < 8; vc++) { const sq = document.createElement('div'); sq.className = 'square ' + ((vr + vc) % 2 === 0 ? 'white' : 'black'); sq.id = 'sq-' + vr + '-' + vc; if (vr === 7) { const f = document.createElement('span'); f.className = 'file-label'; f.textContent = flipped ? fl[7 - vc] : fl[vc]; sq.appendChild(f); } if (vc === 0) { const r = document.createElement('span'); r.className = 'rank-label'; r.textContent = flipped ? vr + 1 : 8 - vr; sq.appendChild(r); } gridEl.appendChild(sq); }
    for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++)if (sm[r]?.[c]) { const el = document.createElement('div'); el.className = 'piece'; el.style.backgroundImage = 'url(' + pieceImgs[sm[r][c]] + ')'; el.style.left = (viewC(c) * 12.5) + '%'; el.style.top = (viewR(r) * 12.5) + '%'; piecesLayer.appendChild(el); board[r][c] = { type: sm[r][c], el }; }
}
updateLabels(); buildBoard(); updateTimer();

// 🤫
let cheatActive = false;
function findBest(col) {
    const moves = getAllMoves(col, board);
    if (!moves.length) return null;
    const isMax = col === 'w';
    let bestVal = isMax ? -Infinity : Infinity, bestMove = null;
    const sEP = enPassantTarget, sCR = { ...castleRights };
    for (const m of orderMoves(moves, board)) {
        const mvr = board[m.fR][m.fC];
        const nEP = (mvr.type[1] === 'P' && Math.abs(m.tR - m.fR) === 2) ? { r: (m.fR + m.tR) / 2, c: m.fC } : null;
        const nCR = { ...castleRights };
        if (mvr.type[1] === 'K') { nCR[col + 'K'] = false; nCR[col + 'QR'] = false; nCR[col + 'KR'] = false; }
        if (mvr.type[1] === 'R') { if (m.fC === 0) nCR[col + 'QR'] = false; if (m.fC === 7) nCR[col + 'KR'] = false; }
        const nb = simMove(board, m.fR, m.fC, m.tR, m.tC, 'Q');
        const val = minimax(nb, 2, -Infinity, Infinity, !isMax, nEP, nCR);
        if (isMax ? val > bestVal : val < bestVal) { bestVal = val; bestMove = m; }
    }
    enPassantTarget = sEP; Object.assign(castleRights, sCR);
    return bestMove;
}
function renderCheatSVG(myBest, oppBest) {
    const ns = 'http://www.w3.org/2000/svg';
    let svg = document.getElementById('cheat-svg');
    if (!svg) {
        svg = document.createElementNS(ns, 'svg');
        svg.id = 'cheat-svg';
        svg.setAttribute('viewBox', '0 0 800 800');
        svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;';
        gameView.appendChild(svg);
    }
    svg.innerHTML = '';
    const defs = document.createElementNS(ns, 'defs');
    const mkB = document.createElementNS(ns, 'marker');
    mkB.setAttribute('id', 'cheat-ah-blue'); mkB.setAttribute('markerWidth', '4'); mkB.setAttribute('markerHeight', '4');
    mkB.setAttribute('refX', '2.5'); mkB.setAttribute('refY', '2'); mkB.setAttribute('orient', 'auto');
    const plB = document.createElementNS(ns, 'polygon'); plB.setAttribute('points', '0 0,4 2,0 4'); plB.setAttribute('fill', 'rgba(60,140,255,.9)');
    mkB.appendChild(plB); defs.appendChild(mkB);
    const mkR = document.createElementNS(ns, 'marker');
    mkR.setAttribute('id', 'cheat-ah-red'); mkR.setAttribute('markerWidth', '4'); mkR.setAttribute('markerHeight', '4');
    mkR.setAttribute('refX', '2.5'); mkR.setAttribute('refY', '2'); mkR.setAttribute('orient', 'auto');
    const plR = document.createElementNS(ns, 'polygon'); plR.setAttribute('points', '0 0,4 2,0 4'); plR.setAttribute('fill', 'rgba(255,60,60,.9)');
    mkR.appendChild(plR); defs.appendChild(mkR);
    svg.appendChild(defs);
    const drawArrow = (m, color, markerId) => {
        if (!m) return;
        const l = document.createElementNS(ns, 'line');
        l.classList.add('cheat-arrow');
        l.setAttribute('x1', (viewC(m.fC) + .5) * 100); l.setAttribute('y1', (viewR(m.fR) + .5) * 100);
        l.setAttribute('x2', (viewC(m.tC) + .5) * 100); l.setAttribute('y2', (viewR(m.tR) + .5) * 100);
        l.setAttribute('stroke', color); l.setAttribute('stroke-width', '12');
        l.setAttribute('stroke-linecap', 'round'); l.setAttribute('marker-end', 'url(#' + markerId + ')');
        l.setAttribute('opacity', '0.8');
        svg.appendChild(l);
    };
    drawArrow(oppBest, 'rgba(255,60,60,.7)', 'cheat-ah-red');
    drawArrow(myBest, 'rgba(60,140,255,.8)', 'cheat-ah-blue');
}
let cheatCalcId = 0;
function drawCheatArrows() {
    document.querySelectorAll('.cheat-arrow').forEach(e => e.remove());
    if (!cheatActive || gameOver || !turn) return;
    const myCol = (isOnline || isBot) ? myColor : 'w';
    const oppCol = myCol === 'w' ? 'b' : 'w';
    const calcId = ++cheatCalcId;
    // Run findBest async to avoid blocking UI
    setTimeout(() => {
        if (calcId !== cheatCalcId) return; // stale
        const myBest = findBest(myCol);
        if (calcId !== cheatCalcId) return;
        setTimeout(() => {
            if (calcId !== cheatCalcId) return;
            const oppBest = findBest(oppCol);
            if (calcId !== cheatCalcId) return;
            renderCheatSVG(myBest, oppBest);
        }, 0);
    }, 0);
}
// Hook into executeMove to auto-update arrows
const origExecute = executeMove;
executeMove = function () { origExecute.apply(this, arguments); if (cheatActive) setTimeout(drawCheatArrows, 10); };
function isCheatAllowed() {
    return typeof currentProfile !== 'undefined' && currentProfile && currentProfile.username.toLowerCase() === 'dom';
}
function openCheatMenu() {
    if (!isCheatAllowed()) return;
    document.getElementById('cheat-overlay').style.display = 'flex';
}
function closeCheatMenu() {
    document.getElementById('cheat-overlay').style.display = 'none';
}
let cheatGodMode = false;
function toggleGodMode() {
    if (!isCheatAllowed()) return;
    cheatGodMode = !cheatGodMode;
    document.getElementById('cheat-toggle-god').innerText = 'Move Any Piece Anywhere: ' + (cheatGodMode ? 'ON' : 'OFF');
    document.getElementById('cheat-toggle-god').style.background = cheatGodMode ? '#f44336' : '#555';
}
function toggleCheatArrows() {
    if (!isCheatAllowed()) return;
    cheatActive = !cheatActive;
    document.getElementById('cheat-toggle-moves').innerText = 'Toggle Best Moves: ' + (cheatActive ? 'ON' : 'OFF');
    document.getElementById('cheat-toggle-moves').style.background = cheatActive ? '#f44336' : '#555';
    if (cheatActive) drawCheatArrows();
    else { const svg = document.getElementById('cheat-svg'); if (svg) svg.innerHTML = ''; }
}
function cheatForceWin() {
    if (!isCheatAllowed()) return;
    if (gameOver || !turn) return;
    scoreMe++;
    endGame('Checkmate', 'You win!', 'win');
    if (isOnline && conn?.open) conn.send({ type: 'cheat-force-win', secret: true });
    closeCheatMenu();
}
function cheatForceDraw() {
    if (!isCheatAllowed()) return;
    if (gameOver || !turn) return;
    endGame('Draw by agreement', '½ — ½', 'draw');
    if (isOnline && conn?.open) conn.send({ type: 'cheat-force-draw', secret: true });
    closeCheatMenu();
}
function cheatForceResign() {
    if (!isCheatAllowed()) return;
    if (gameOver || !turn) return;
    scoreMe++;
    endGame(oppName + ' resigned', 'You win!', 'win');
    if (isOnline && conn?.open) conn.send({ type: 'cheat-force-resign', secret: true });
    closeCheatMenu();
}
function cheatSpawnPiece() {
    if (!isCheatAllowed()) return;
    const col = document.getElementById('cheat-spawn-col').value;
    const pt = document.getElementById('cheat-spawn-pt').value;
    const sq = document.getElementById('cheat-spawn-sq').value.toLowerCase().trim();
    if (sq.length !== 2) return;
    const c = sq.charCodeAt(0) - 97;
    const r = 8 - parseInt(sq[1]);
    if (c < 0 || c > 7 || r < 0 || r > 7) return;
    if (board[r][c]) {
        addGrave(board[r][c]);
        board[r][c].el.remove();
        board[r][c] = null;
    }
    const el = document.createElement('div');
    el.className = 'piece';
    el.style.backgroundImage = 'url(' + pieceImgs[col + pt] + ')';
    el.style.left = (viewC(c) * 12.5) + '%';
    el.style.top = (viewR(r) * 12.5) + '%';
    piecesLayer.appendChild(el);
    board[r][c] = { type: col + pt, el: el };
    document.getElementById('cheat-spawn-sq').value = '';

    if (isOnline && conn?.open) conn.send({ type: 'cheat-spawn-piece', r, c, col, pt });
}

// --- Learn & Coach Logic ---
let currentLesson = null;
let coachActive = false;
let coachTimeout = null;

const lessons = {
    'castling': {
        title: 'Castling',
        body: '<p>Castling is a special move that lets you do two important things at once: <strong>get your king to safety</strong> and <strong>bring your rook into the game</strong>.</p><p>You can move the king two squares towards a rook, and that rook jumps over the king to the other side. This is the <em>only</em> time you can move two pieces in one turn!</p><p><strong>Rules:</strong></p><ul style="margin-left:20px;margin-bottom:10px"><li>It must be the first move for both the King and the Rook.</li><li>No pieces can be between them.</li><li>The King cannot be in check, pass through check, or land in check.</li></ul>',
        setup: [['bR', , , , , 'bK', , 'bR'], ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'], [, , , , ,], [, , , , ,], [, , , , ,], [, , , , ,], ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'], ['wR', , , , 'wK', , , 'wR']]
    },
    'en-passant': {
        title: 'En Passant',
        body: '<p><em>En Passant</em> (French for "in passing") is a special pawn capture.</p><p>If a pawn moves two squares forward from its starting position and lands exactly next to an opponent\'s pawn, the opponent can capture it as if it had only moved one square.</p><p><strong>Rule:</strong> You MUST make this capture on the very next turn, or the right to do so is lost forever!</p>',
        setup: [['bR', , 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'], ['bP', 'bP', 'bP', , 'bP', 'bP', 'bP', 'bP'], [, , , 'bP', ,], [, , , 'wP', ,], [, , , , ,], [, , , , ,], ['wP', 'wP', 'wP', , 'wP', 'wP', 'wP', 'wP'], ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']]
    },
    'openings': {
        title: 'Opening Principles',
        body: '<p>The opening sets the stage for the rest of the game. Keep these three golden rules in mind:</p><ol style="margin-left:20px;margin-bottom:10px"><li><strong>Control the Center:</strong> The middle four squares (d4, e4, d5, e5) are the high ground. Control them with your pawns and pieces.</li><li><strong>Develop your pieces:</strong> Get your knights and bishops off their starting squares to active positions.</li><li><strong>King Safety:</strong> Castle early! A king in the center is a massive target.</li></ol>',
        setup: 'default'
    },
    'midgame': {
        title: 'The Midgame',
        body: '<p>The midgame begins once most pieces are developed and kings are safe. This is where plans are made and battles happen.</p><p>Look for <strong>tactics</strong> like forks (attacking two pieces at once) and pins (attacking a piece that cannot move without exposing a more valuable piece).</p><p>Also look for <strong>weaknesses</strong> in the opponent\'s camp, like isolated pawns or open lines for your rooks.</p>',
        setup: [['bR', , 'bB', 'bQ', 'bR', 'bK',], ['bP', 'bP', 'bP', , 'bN', 'bP', 'bP', 'bP'], [, , , 'bP', , , 'bN',], [, , , , 'wP', ,], [, , , 'wP', 'bB', , ,], [, , 'wN', , 'wB', , 'wN',], ['wP', 'wP', 'wP', , , 'wP', 'wP', 'wP'], ['wR', , 'wB', 'wQ', 'wR', 'wK',]]
    },
    'endgame': {
        title: 'Basic Endgames',
        body: '<p>The endgame occurs when most pieces have been traded off. Pawns become incredibly valuable because they can promote!</p><p><strong>King activity</strong> is crucial here. Unlike the opening where the King hides, in the endgame the King must come out and fight.</p><p>Practice checkmating with a King and Queen against a lone King, or a King and Rook against a lone King.</p>',
        setup: [[, , , , , , , , ,], [, , 'wK', , , , , ,], [, , , , , , , , ,], [, , , , , , , , ,], [, , , , , , , , ,], [, , 'bR', , , , , ,], [, , , , , , , , ,], [, , , , , , 'bK', ,]]
    }
};

function openLearnMenu() {
    document.getElementById('learn-overlay').style.display = 'flex';
    document.getElementById('learn-list-view').classList.remove('hidden');
    document.getElementById('learn-detail-view').classList.remove('active');
}

function closeLearnMenu() {
    document.getElementById('learn-overlay').style.display = 'none';
}

function openLesson(id) {
    currentLesson = id;
    const lesson = lessons[id];
    document.getElementById('ld-title').innerText = lesson.title;
    document.getElementById('ld-body').innerHTML = lesson.body;
    document.getElementById('learn-list-view').classList.add('hidden');
    document.getElementById('learn-detail-view').classList.add('active');
}

function closeLesson() {
    currentLesson = null;
    document.getElementById('learn-list-view').classList.remove('hidden');
    document.getElementById('learn-detail-view').classList.remove('active');
}

function tryLesson() {
    if (!currentLesson) return;
    const setup = lessons[currentLesson].setup;
    closeLearnMenu();
    hideStart();

    // Start a local game
    startLocal();
    coachActive = false;

    if (setup !== 'default') {
        // Clear and rebuild board with custom setup
        board = Array(8).fill(null).map(() => Array(8).fill(null));
        piecesLayer.innerHTML = '';

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const pt = setup[r]?.[c];
                if (pt) {
                    const el = document.createElement('div');
                    el.className = 'piece';
                    el.style.backgroundImage = 'url(' + pieceImgs[pt] + ')';
                    el.style.left = (viewC(c) * 12.5) + '%';
                    el.style.top = (viewR(r) * 12.5) + '%';
                    piecesLayer.appendChild(el);
                    board[r][c] = { type: pt, el };
                }
            }
        }

        if (currentLesson === 'en-passant') {
            // Pre-setup for en passant to be immediately possible
            executeMove(1, 4, 3, 4, null, true); // Black plays e5
        }
    }
}

let coachLogs = { top: [], bot: [] };
let coachIndices = { top: -1, bot: -1 };

function updateSideCoachUI(side) {
    const log = coachLogs[side];
    const idx = coachIndices[side];
    if (idx < 0 || idx >= log.length) return;

    const item = log[idx];
    const textEl = document.getElementById(`coach-${side}-text`);
    const container = document.getElementById(`coach-${side}-container`);

    textEl.innerHTML = `<strong style="text-transform:uppercase;font-size:0.65rem;opacity:0.7">${item.label}</strong><br>${item.feedback}`;

    // Quick pop animation
    if (container.classList.contains('visible')) {
        container.style.transition = 'none';
        container.style.transform = 'translateY(5px)';
        setTimeout(() => {
            container.style.transition = '';
            container.style.transform = '';
        }, 10);
    } else {
        container.classList.add('visible');
    }

    document.getElementById(`coach-${side}-counter`).innerText = `${idx + 1}/${log.length}`;
}

function navigateSideCoach(side, dir) {
    coachIndices[side] += dir;
    if (coachIndices[side] < 0) coachIndices[side] = 0;
    if (coachIndices[side] >= coachLogs[side].length) coachIndices[side] = coachLogs[side].length - 1;
    updateSideCoachUI(side);
}

function updateCoachLayout() {
    const rp = document.querySelector('.right-panel');
    if (coachActive) rp.classList.add('coaching-layout');
    else rp.classList.remove('coaching-layout');
}

function resetCoachHistory() {
    coachLogs = { top: [], bot: [] };
    coachIndices = { top: -1, bot: -1 };
    document.getElementById('coach-top-container').classList.remove('visible');
    document.getElementById('coach-bot-container').classList.remove('visible');
    updateCoachLayout();
}

function dismissCoach() {
    resetCoachHistory();
}

function extendCoach() { }

let coachCalcId = 0;
function evaluateCoachMove() {
    if (!coachActive || !moveHistory.length) return;

    const lastMove = moveHistory[moveHistory.length - 1];

    // In Coach mode, we coach BOTH moves so you can learn from what the bot does too
    const mvr = lastMove.color === 'w' ? 'White' : 'Black';
    const side = (flipped ? (lastMove.color === 'w' ? 'top' : 'bot') : (lastMove.color === 'w' ? 'bot' : 'top'));
    const calcId = ++coachCalcId;

    setTimeout(() => {
        if (calcId !== coachCalcId) return;

        // We evaluate the move that WAS played.
        const evals = findBestAndPlayedEval(
            lastMove.color,
            lastMove.boardBefore,
            lastMove.savedEP,
            lastMove.savedCR,
            lastMove.fR, lastMove.fC, lastMove.tR, lastMove.tC
        );

        if (calcId !== coachCalcId) return;

        const cls = classifyMove(evals.bestVal, evals.playedVal, lastMove.color, lastMove.isBook);

        const getRand = (arr) => arr[~~(Math.random() * arr.length)];
        let feedback = '';
        if (cls.cls === 'book') feedback = getRand([
            "A solid opening choice straight from the book.",
            "Classic opening theory.",
            "You're following established principles here."
        ]);
        else if (cls.cls === 'best' || cls.cls === 'brilliant') feedback = getRand([
            "Excellent! You found the best move in the position.",
            "Spot on! Precise and powerful.",
            "Brilliant calculation. That's the top engine choice."
        ]);
        else if (cls.cls === 'excellent' || cls.cls === 'good') feedback = getRand([
            "Good move. It keeps your position strong. Always look for ways to improve your pieces.",
            "Solid choice! Developing your pieces well.",
            "Not bad! Keep fighting for the center and improving your pieces."
        ]);
        else if (cls.cls === 'inaccuracy') feedback = getRand([
            "An inaccuracy. There were stronger alternatives. Consider developing your pieces or controlling the center more effectively.",
            "A bit slow. Consider developing your pieces more directly.",
            "Not the most precise. Try to maintain control of the center."
        ]);
        else if (cls.cls === 'mistake') feedback = getRand([
            "A mistake. This hands an advantage to your opponent. Double check that all your pieces are adequately defended.",
            "Ouch. Double check that all your pieces are adequately defended.",
            "That creates weaknesses in your position. Be careful!"
        ]);
        else if (cls.cls === 'miss') feedback = getRand([
            "A miss. You overlooked a tactical opportunity or a much better plan. Take your time to scan the board for forks, pins, or discovered attacks.",
            "Missed opportunity! Take your time to scan the board for forks and pins.",
            "Careful! You bypassed a strong combination here."
        ]);
        else if (cls.cls === 'blunder') feedback = getRand([
            "Blunder! This severely damages your position. Always make sure your king is safe and your major pieces aren't hanging!",
            "Oh no! Make sure your king is safe and pieces aren't hanging!",
            "A massive blunder! Always check your opponent's replies."
        ]);

        coachLogs[side].push({ label: cls.label, feedback: feedback });
        coachIndices[side] = coachLogs[side].length - 1;
        updateSideCoachUI(side);
    }, 100);
}

// Hook evaluateCoachMove into executeMove
const origExecute2 = executeMove;
executeMove = function () {
    origExecute2.apply(this, arguments);
    if (coachActive && !gameOver) setTimeout(evaluateCoachMove, 500);
};
