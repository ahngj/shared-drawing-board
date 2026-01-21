const WS_URL = 'ws://3.27.148.153:3000'; 
const API_URL = 'https://l791s8zxya.execute-api.ap-southeast-2.amazonaws.com/prod'; 

const canvas = document.getElementById('drawing-board');
const ctx = canvas.getContext('2d');

let ws;
let drawing = false;
let currentColor = '#000000';
let currentTool = 'pencil';
let sessionId = '';
let nickname = '';
let lastX = null;
let lastY = null;
let lastSendTime = 0;
const THROTTLE_DELAY = 15; // 초당 전송 횟수 최적화 (기존 30에서 15로 개선)

ctx.lineCap = 'round';
ctx.lineJoin = 'round';

document.addEventListener('DOMContentLoaded', refreshSessions);
document.getElementById('refresh-sessions-btn').onclick = refreshSessions;

async function refreshSessions() {
    const listElement = document.getElementById('session-list');
    listElement.innerHTML = '<li>로드 중...</li>';
    try {
        const response = await fetch(`${API_URL}/sessions`);
        const sessions = await response.json();
        listElement.innerHTML = sessions.length === 0 ? '<li>생성된 방이 없습니다.</li>' : '';
        sessions.forEach(session => {
            const li = document.createElement('li');
            li.textContent = `🎨 ${session.sessionName}`;
            li.onclick = () => joinSessionAttempt(session.sessionId, session.sessionName);
            listElement.appendChild(li);
        });
    } catch (e) {
        listElement.innerHTML = '<li>목록 불러오기 실패</li>';
    }
}

// 방 만들기 로직 (자동 입장 포함)
document.getElementById('create-session-btn').onclick = () => {
    showPopup('세션 생성', '방 이름', '비밀번호', async (name, password) => {
        try {
            const response = await fetch(`${API_URL}/create-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: name, password: password })
            });
            const result = await response.json();
            
            if (response.ok) {
                alert('방이 생성되었습니다! 자동으로 입장합니다.');
                sessionId = result.sessionId;
                nickname = "방장"; // 혹은 닉네임 입력 로직 추가 가능
                
                document.getElementById('lobby').style.display = 'none';
                document.getElementById('game-room').style.display = 'block';
                document.getElementById('room-title').textContent = name;
                
                connectToSocket(sessionId, nickname);
            } else {
                alert(result.message); // 중복 이름 알림
            }
        } catch (e) {
            alert('연결 오류');
        }
    });
};

function joinSessionAttempt(id, name) {
    showPopup('방 입장', '닉네임', '비밀번호', (userNickname, password) => {
        sessionId = id;
        nickname = userNickname;
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('game-room').style.display = 'block';
        document.getElementById('room-title').textContent = name;
        connectToSocket(sessionId, nickname);
    });
}

function connectToSocket(roomId, userNickname) {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', sessionId: roomId, nickname: userNickname }));
    };
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'draw') {
            draw(data.x, data.y, data.color, data.tool, false, data.lastX, data.lastY);
        } else if (data.type === 'history') {
            data.data.forEach(item => draw(item.x, item.y, item.color, item.tool, false, item.lastX, item.lastY));
        } else if (data.type === 'clients') {
            const ul = document.getElementById('user-list');
            ul.innerHTML = data.clients.map(u => `<li>${u}</li>`).join('');
        }
    };
}

canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    lastX = e.offsetX; lastY = e.offsetY;
    draw(lastX, lastY, currentColor, currentTool, true);
});
canvas.addEventListener('mouseup', () => { drawing = false; });
canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const now = Date.now();
    if (now - lastSendTime > THROTTLE_DELAY) {
        draw(e.offsetX, e.offsetY, currentColor, currentTool, true);
        lastSendTime = now;
    } else {
        draw(e.offsetX, e.offsetY, currentColor, currentTool, false);
    }
});

function draw(x, y, color, tool, sendToServer = false, fromX = lastX, fromY = lastY) {
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = tool === 'eraser' ? 20 : 5;
    ctx.beginPath();
    if (fromX !== null && fromY !== null) {
        ctx.moveTo(fromX, fromY); ctx.lineTo(x, y);
    } else {
        ctx.moveTo(x, y); ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.closePath();

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
    document.getElementById('popup-title').textContent = title;
    const i1 = document.getElementById('popup-input1'), i2 = document.getElementById('popup-input2');
    i1.placeholder = p1; i2.placeholder = p2; i1.value = ''; i2.value = '';
    overlay.style.display = 'block'; popup.style.display = 'block';
    document.getElementById('popup-submit').onclick = () => {
        if (!i1.value) return alert('값을 입력해주세요');
        callback(i1.value, i2.value);
        overlay.style.display = 'none'; popup.style.display = 'none';
    };
    document.getElementById('popup-cancel').onclick = () => {
        overlay.style.display = 'none'; popup.style.display = 'none';
    };
}
