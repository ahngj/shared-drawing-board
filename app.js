const canvas = document.getElementById('drawing-board');
const ctx = canvas.getContext('2d');
const ws = new WebSocket('ws://15.164.210.177:3000');

let drawing = false;
let currentColor = '#000000';
let currentTool = 'pencil'; 
let sessionId = '';
let nickname = '';
let lastX = null;
let lastY = null;

// WebSocket 이벤트 설정
ws.onopen = () => {
    console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'draw') {
        draw(data.x, data.y, data.color, data.tool, false, data.lastX, data.lastY);
    } else if (data.type === 'clients') {
        updateClientList(data.clients); // 세션 내 사용자 목록 업데이트
    } else if (data.type === 'sessionList') {
        updateSessionList(data.sessions); // 전체 세션 목록 업데이트
    } else if (data.type === 'sessionCreated') {
        alert(`Session "${data.sessionId}" created successfully.`);
    } else if (data.type === 'error') {
        alert(data.message);
    }
};

// 캔버스 이벤트 설정
canvas.addEventListener('mousedown', (event) => {
    drawing = true;
    lastX = event.offsetX;
    lastY = event.offsetY;
    draw(lastX, lastY, currentColor, currentTool, true);
});
canvas.addEventListener('mouseup', () => {
    drawing = false;
    lastX = null;
    lastY = null;
});
canvas.addEventListener('mouseout', () => {
    drawing = false;
    lastX = null;
    lastY = null;
});
canvas.addEventListener('mousemove', (event) => {
    if (!drawing) return;
    draw(event.offsetX, event.offsetY, currentColor, currentTool, true);
});

// 색상 선택 이벤트
document.getElementById('color-picker').addEventListener('input', (event) => {
    currentColor = event.target.value;
});

// 연필/지우개 전환 이벤트
document.getElementById('toggle-pencil').addEventListener('click', () => {
    currentTool = currentTool === 'pencil' ? 'eraser' : 'pencil';
    console.log(`Tool changed to: ${currentTool}`);
});

// 세션 나가기 버튼
document.getElementById('leave-session').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'disconnectSession', sessionId }));
    alert('You have left the session.');
    location.reload(); // 페이지 새로고침으로 초기화
});

// 세션 생성 버튼 이벤트
document.getElementById('create-session').addEventListener('click', () => {
    showPopup('세션 생성', '세션 이름 입력', '비밀번호 입력', (sessionName, password) => {
        sessionId = sessionName;
        ws.send(JSON.stringify({ type: 'createSession', sessionId: sessionName, password }));
    });
});

// 세션 참여 버튼 이벤트
document.getElementById('join-session').addEventListener('click', () => {
    showPopup('세션 참여', '세션 이름 입력', '닉네임 입력', (sessionName, userNickname) => {
        sessionId = sessionName;
        nickname = userNickname;
        ws.send(JSON.stringify({ type: 'join', sessionId: sessionName, nickname: userNickname }));
        document.getElementById('session-list').style.display = 'none';
        document.getElementById('controls').style.display = 'block';
        canvas.style.display = 'block';
    });
});

// 그리기 함수
function draw(x, y, color, tool, sendToServer = false, fromX = null, fromY = null) {
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color; // 지우개는 흰색으로 설정
    ctx.lineWidth = tool === 'eraser' ? 10 : 4; // 지우개 크기 증가
    ctx.lineCap = 'round';

    if (fromX !== null && fromY !== null) {
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(x, y);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
    }

    if (sendToServer) {
        ws.send(
            JSON.stringify({
                type: 'draw',
                sessionId,
                x,
                y,
                color,
                tool,
                lastX,
                lastY,
            })
        );
        lastX = x;
        lastY = y;
    }
}

// 사용자 목록 업데이트 함수
function updateClientList(clients) {
    const clientList = document.getElementById('clients');
    clientList.innerHTML = ''; // 기존 목록 초기화

    clients.forEach((client) => {
        const li = document.createElement('li');
        li.textContent = client; // 닉네임 표시
        clientList.appendChild(li);
    });
}

// 세션 목록 업데이트 함수
function updateSessionList(sessions) {
    const sessionList = document.getElementById('sessions');
    sessionList.innerHTML = ''; // 기존 목록 초기화

    sessions.forEach((session) => {
        const li = document.createElement('li');
        li.textContent = session;
        sessionList.appendChild(li);

        // 세션 클릭 시 참여 처리
        li.addEventListener('click', () => {
            showPopup('세션 참여', '닉네임 입력', '', (userNickname) => {
                nickname = userNickname;
                sessionId = session;
                ws.send(JSON.stringify({ type: 'join', sessionId, nickname }));
                document.getElementById('session-list').style.display = 'none';
                document.getElementById('controls').style.display = 'block';
                canvas.style.display = 'block';
            });
        });
    });
}

// 팝업 표시 및 입력 처리 함수
function showPopup(title, input1Placeholder, input2Placeholder, submitCallback) {
    const overlay = document.getElementById('overlay');
    const popup = document.getElementById('popup');
    document.getElementById('popup-title').textContent = title;
    document.getElementById('popup-input1').placeholder = input1Placeholder;
    document.getElementById('popup-input2').placeholder = input2Placeholder;

    document.getElementById('popup-submit').onclick = () => {
        const input1 = document.getElementById('popup-input1').value;
        const input2 = document.getElementById('popup-input2').value;
        submitCallback(input1, input2);
        overlay.style.display = 'none';
        popup.style.display = 'none';
    };

    document.getElementById('popup-cancel').onclick = () => {
        overlay.style.display = 'none';
        popup.style.display = 'none';
    };

    overlay.style.display = 'block';
    popup.style.display = 'block';
}
