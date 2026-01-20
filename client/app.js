const WS_URL = 'ws://3.27.148.153:3000'; // 배포 시 실제 IP/도메인 확인 필요
const API_URL = 'https://l791s8zxya.execute-api.ap-southeast-2.amazonaws.com/prod'; // AWS API Gateway 주소를 입력하세요.

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
            } else {
                alert('방 생성 실패');
            }
        } catch (e) {
            console.error(e);
            alert('API 호출 오류');
        }
    });
});

// 방 입장 시도
function joinSessionAttempt(id, name) {
    showPopup('방 입장', '닉네임', '비밀번호', async (userNickname, password) => {
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
            // 실시간 그리기 반영 (sendToServer=false)
            draw(data.x, data.y, data.color, data.tool, false, data.lastX, data.lastY);
        } 
        else if (data.type === 'history') {
            // ⭐ [추가됨] 입장 시 기존 그림 이어 그리기
            // 서버에서 받은 배열을 순회하며 빠르게 그려줌
            data.data.forEach(item => {
                draw(item.x, item.y, item.color, item.tool, false, item.lastX, item.lastY);
            });
        }
        else if (data.type === 'clients') {
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
    // 스로틀링: 일정 시간(THROTTLE_DELAY)마다 서버 전송
    if (now - lastSendTime > THROTTLE_DELAY) {
        draw(e.offsetX, e.offsetY, currentColor, currentTool, true);
        lastSendTime = now;
    } else {
        // 서버 전송 없이 로컬 화면에만 부드럽게 그림
        draw(e.offsetX, e.offsetY, currentColor, currentTool, false);
    }
});

// 도구 변경 이벤트
document.getElementById('tool-pencil').addEventListener('click', () => { currentTool = 'pencil'; });
document.getElementById('tool-eraser').addEventListener('click', () => { currentTool = 'eraser'; });
document.getElementById('color-picker').addEventListener('input', (e) => { currentColor = e.target.value; });


// ⭐ [핵심 수정] 그리기 함수
function draw(x, y, color, tool, sendToServer = false, fromX = lastX, fromY = lastY) {
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = tool === 'eraser' ? 20 : 5;

    ctx.beginPath();
    
    // 이전 좌표가 있으면 거기서부터, 없으면 점 찍기
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
            lastX: fromX, lastY: fromY, // 끊김 방지용 이전 좌표
            color: color,
            tool: tool
        }));
    }
    
    // ⭐ [중요 수정] 화면에 그림을 그렸다면, 서버 전송 여부와 상관없이 
    // 내 좌표는 무조건 현재 위치로 갱신해야 선이 부드럽게 이어짐.
    lastX = x;
    lastY = y;
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
