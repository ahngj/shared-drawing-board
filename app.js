const WS_URL = 'ws://15.164.210.177:3000'; 
const API_URL = 'https://YOUR_API_GATEWAY_URL'; // AWS API Gateway 주소를 입력.

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

// 스로틀링
let lastSendTime = 0;
const THROTTLE_DELAY = 30; // 초당 약 33회 전송으로 제한

// 캔버스 초기 설정
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// ========================
// 1. 방 관리 (Lambda API 호출)
// ========================

// 방 목록 불러오기 (초기 실행)
document.addEventListener('DOMContentLoaded', refreshSessions);
document.getElementById('refresh-sessions-btn').addEventListener('click', refreshSessions);

async function refreshSessions() {
    const listElement = document.getElementById('session-list');
    listElement.innerHTML = '<li>로드 중...</li>';
    
    try {
        const response = await fetch(`${API_URL}/sessions`, { method: 'GET' });
        if (!response.ok) throw new Error('목록 불러오기 실패');
        
        const sessions = await response.json();
        listElement.innerHTML = '';
        
        if (sessions.length === 0) {
            listElement.innerHTML = '<li>생성된 방이 없습니다.</li>';
            return;
        }

        sessions.forEach(session => {
            const li = document.createElement('li');
            li.textContent = `🎨 ${session.sessionName}`;
            li.onclick = () => joinSessionAttempt(session.sessionId, session.sessionName);
            listElement.appendChild(li);
        });
    } catch (e) {
        console.error(e);
        listElement.innerHTML = '<li>목록을 가져올 수 없습니다.</li>';
    }
}

// 방 만들기 버튼
document.getElementById('create-session-btn').addEventListener('click', () => {
    showPopup('세션 생성', '방 이름', '비밀번호', async (name, password) => {
        try {
            const response = await fetch(`${API_URL}/create-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: name, password: password })
            });
            
            if (response.ok) {
                const data = await response.json();
                alert('방이 생성되었습니다!');
                refreshSessions(); // 목록 갱신
                // 바로 입장하려면 아래 주석 해제
                // joinSessionAttempt(data.sessionId, name);
            } else {
                alert('방 생성 실패');
            }
        } catch (e) {
            console.error(e);
            alert('API 호출 오류');
        }
    });
});

// 방 입장 시도 (비밀번호 확인 등)
function joinSessionAttempt(id, name) {
    showPopup('방 입장', '닉네임', '비밀번호', async (userNickname, password) => {
        // 비밀번호 확인 API (선택 사항, 없다면 바로 접속)
        // 여기서는 바로 소켓 연결로 넘어갑니다.
        sessionId = id;
        nickname = userNickname;
        
        // UI 전환
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('game-room').style.display = 'block';
        document.getElementById('room-title').textContent = name;
        
        connectToSocket(sessionId, nickname);
    });
}

// 나가기 버튼
document.getElementById('leave-session-btn').addEventListener('click', () => {
    if (ws) ws.close();
    location.reload();
});


// ========================
// 2. 소켓 연결 (EC2)
// ========================

function connectToSocket(roomId, userNickname) {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('Connected to WebSocket');
        // 방 입장 패킷 전송
        ws.send(JSON.stringify({ type: 'join', sessionId: roomId, nickname: userNickname }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'draw') {
            // 다른 사람이 그린 내용 반영
            draw(data.x, data.y, data.color, data.tool, false, data.lastX, data.lastY);
        } else if (data.type === 'clients') {
            updateUserList(data.clients);
        }
    };
    
    ws.onclose = () => {
        alert('연결이 끊어졌습니다.');
        location.reload();
    }
}

function updateUserList(users) {
    const ul = document.getElementById('user-list');
    ul.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        ul.appendChild(li);
    });
}


// ========================
// 3. 그리기 로직 (스로틀링 적용)
// ========================

canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    lastX = e.offsetX;
    lastY = e.offsetY;
    draw(lastX, lastY, currentColor, currentTool, true);
});

canvas.addEventListener('mouseup', () => { drawing = false; });
canvas.addEventListener('mouseout', () => { drawing = false; });

canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    
    const now = Date.now();
    // 스로틀링
    if (now - lastSendTime > THROTTLE_DELAY) {
        draw(e.offsetX, e.offsetY, currentColor, currentTool, true);
        lastSendTime = now;
    } else {
        // 화면에는 부드럽게 그리기 위해 전송 없이 로컬 그리기만 수행
        draw(e.offsetX, e.offsetY, currentColor, currentTool, false, lastX, lastY);
    }
});

// 도구 변경
document.getElementById('tool-pencil').addEventListener('click', () => { currentTool = 'pencil'; });
document.getElementById('tool-eraser').addEventListener('click', () => { currentTool = 'eraser'; });
document.getElementById('color-picker').addEventListener('input', (e) => { currentColor = e.target.value; });


function draw(x, y, color, tool, sendToServer = false, fromX = lastX, fromY = lastY) {
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = tool === 'eraser' ? 20 : 5;

    ctx.beginPath();
    // 선이 끊기지 않게 이전 좌표(fromX, Y)에서 현재 좌표(x, y)로 선을 그음
    if (fromX !== null && fromY !== null) {
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(x, y);
    } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.closePath();

    if (sendToServer && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'draw',
            sessionId: sessionId,
            x: x, y: y,
            lastX: fromX, lastY: fromY, // 끊김 방지용 이전 좌표 동봉
            color: color,
            tool: tool
        }));
    }
    
    // 내 화면 좌표 업데이트 (서버로 보낸 경우에만)
    if (sendToServer) {
        lastX = x;
        lastY = y;
    }
}


// ========================
// 4. 유틸리티 (팝업 등)
// ========================

function showPopup(title, placeholder1, placeholder2, callback) {
    const overlay = document.getElementById('overlay');
    const popup = document.getElementById('popup');
    const titleEl = document.getElementById('popup-title');
    const input1 = document.getElementById('popup-input1');
    const input2 = document.getElementById('popup-input2');
    const submitBtn = document.getElementById('popup-submit');
    const cancelBtn = document.getElementById('popup-cancel');

    titleEl.textContent = title;
    input1.placeholder = placeholder1;
    input2.placeholder = placeholder2;
    input1.value = '';
    input2.value = '';

    overlay.style.display = 'block';
    popup.style.display = 'block';

    submitBtn.onclick = () => {
        if (!input1.value) return alert('값을 입력해주세요');
        callback(input1.value, input2.value);
        overlay.style.display = 'none';
        popup.style.display = 'none';
    };

    cancelBtn.onclick = () => {
        overlay.style.display = 'none';
        popup.style.display = 'none';
    };
}
