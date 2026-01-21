const WS_URL = 'ws://13.236.200.2:3000'; 
const API_URL = 'https://l791s8zxya.execute-api.ap-southeast-2.amazonaws.com/prod'; 

const canvas = document.getElementById('drawing-board');
const ctx = canvas.getContext('2d');
let ws, drawing = false, currentColor = '#000000', currentTool = 'pencil';
let sessionId = '', nickname = '', lastX = null, lastY = null, lastSendTime = 0;
const THROTTLE_DELAY = 15; 

ctx.lineCap = 'round'; ctx.lineJoin = 'round';

document.addEventListener('DOMContentLoaded', refreshSessions);
document.getElementById('refresh-sessions-btn').onclick = refreshSessions;

async function refreshSessions() {
    const listElement = document.getElementById('session-list');
    listElement.innerHTML = '<li>로드 중...</li>';
    try {
        const res = await fetch(`${API_URL}/sessions`);
        const sessions = await res.json();
        listElement.innerHTML = sessions.length === 0 ? '<li>생성된 방이 없습니다.</li>' : '';
        sessions.forEach(s => {
            const li = document.createElement('li');
            li.textContent = `🎨 ${s.sessionName}`;
            li.onclick = () => joinSessionAttempt(s.sessionId, s.sessionName);
            listElement.appendChild(li);
        });
    } catch (e) { listElement.innerHTML = '<li>로드 실패</li>'; }
}

// 1. 방 만들기 (방장 닉네임 추가 입력)
document.getElementById('create-session-btn').onclick = () => {
    showPopup('세션 생성', '방 제목', '비밀번호', async (name, password) => {
        const hostNickname = prompt("방에서 사용할 닉네임을 입력하세요:", "방장");
        if (!hostNickname) return;

        try {
            const res = await fetch(`${API_URL}/create-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: name, password: password })
            });
            const result = await res.json();
            if (res.ok) {
                sessionId = result.sessionId; nickname = hostNickname;
                enterGameRoom(name); connectToSocket(sessionId, nickname);
            } else { alert(result.message); }
        } catch (e) { alert('API 오류'); }
    });
};

// 2. 방 입장 (서버 비밀번호 검증)
function joinSessionAttempt(id, name) {
    showPopup('방 입장', '사용할 닉네임', '방 비밀번호', async (userNickname, password) => {
        try {
            const verifyRes = await fetch(`${API_URL}/verify-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: id, password: password })
            });
            const verifyResult = await verifyRes.json();

            if (!verifyRes.ok) return alert(verifyResult.message || "비밀번호가 틀렸습니다.");

            sessionId = id; nickname = userNickname;
            enterGameRoom(name); connectToSocket(sessionId, nickname);
        } catch (e) { alert("검증 중 오류 발생"); }
    });
}

function enterGameRoom(name) {
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-room').style.display = 'block';
    document.getElementById('room-title').textContent = name;
}

function connectToSocket(roomId, userNickname) {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', sessionId: roomId, nickname: userNickname }));
    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'draw') draw(data.x, data.y, data.color, data.tool, false, data.lastX, data.lastY);
        else if (data.type === 'history') data.data.forEach(item => draw(item.x, item.y, item.color, item.tool, false, item.lastX, item.lastY));
        else if (data.type === 'clients') {
            document.getElementById('user-list').innerHTML = data.clients.map(u => `<li>${u}</li>`).join('');
        }
    };
    ws.onclose = () => { alert('연결이 종료되었습니다.'); location.reload(); };
}

// 3. 드로잉 로직 (기존 유지)
canvas.addEventListener('mousedown', (e) => { drawing = true; lastX = e.offsetX; lastY = e.offsetY; draw(lastX, lastY, currentColor, currentTool, true); });
canvas.addEventListener('mouseup', () => { drawing = false; });
canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const now = Date.now();
    if (now - lastSendTime > THROTTLE_DELAY) {
        draw(e.offsetX, e.offsetY, currentColor, currentTool, true); lastSendTime = now;
    } else { draw(e.offsetX, e.offsetY, currentColor, currentTool, false); }
});

function draw(x, y, color, tool, sendToServer = false, fromX = lastX, fromY = lastY) {
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = tool === 'eraser' ? 20 : 5;
    ctx.beginPath();
    if (fromX !== null && fromY !== null) { ctx.moveTo(fromX, fromY); ctx.lineTo(x, y); }
    else { ctx.moveTo(x, y); ctx.lineTo(x, y); }
    ctx.stroke(); ctx.closePath();
    if (sendToServer && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'draw', sessionId, x, y, lastX: fromX, lastY: fromY, color, tool }));
    }
    lastX = x; lastY = y;
}

document.getElementById('leave-session-btn').onclick = () => location.reload();
document.getElementById('tool-pencil').onclick = () => currentTool = 'pencil';
document.getElementById('tool-eraser').onclick = () => currentTool = 'eraser';
document.getElementById('color-picker').oninput = (e) => currentColor = e.target.value;

function showPopup(title, p1, p2, callback) {
    const overlay = document.getElementById('overlay'), popup = document.getElementById('popup');
    const i1 = document.getElementById('popup-input1'), i2 = document.getElementById('popup-input2');
    document.getElementById('popup-title').textContent = title;
    i1.placeholder = p1; i2.placeholder = p2; i1.value = ''; i2.value = '';
    overlay.style.display = 'block'; popup.style.display = 'block';
    document.getElementById('popup-submit').onclick = () => {
        if (!i1.value) return alert('값을 입력해주세요');
        callback(i1.value, i2.value); overlay.style.display = 'none'; popup.style.display = 'none';
    };
    document.getElementById('popup-cancel').onclick = () => { overlay.style.display = 'none'; popup.style.display = 'none'; };
}
