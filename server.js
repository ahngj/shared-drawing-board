const WebSocket = require('ws');

// WebSocket 서버 생성 (포트 3000)
const server = new WebSocket.Server({ port: 3000 });
const sessions = new Map(); // 메모리 세션 관리 (운영 환경에선 Redis 권장)

console.log("🚀 EC2 WebSocket Server Started on port 3000");

server.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.error("Invalid JSON");
            return;
        }

        // 1. 방 입장 처리
        if (data.type === 'join') {
            const { sessionId, nickname } = data;

            if (!sessions.has(sessionId)) {
                // 메모리에 방이 없으면 생성
                // drawHistory: 이 방에서 그려진 모든 선의 기록을 저장
                sessions.set(sessionId, { clients: new Set(), drawHistory: [] });
            }
            
            const session = sessions.get(sessionId);
            
            // 소켓에 사용자 정보 저장
            socket.sessionId = sessionId;
            socket.nickname = nickname;
            
            session.clients.add(socket);
            
            console.log(`[JOIN] ${nickname} joined session ${sessionId}`);
            
            // 새로 들어온 사람에게 기존 그림 데이터 전송 (History Replay)
            if (session.drawHistory && session.drawHistory.length > 0) {
                console.log(`Sending history to ${nickname} (${session.drawHistory.length} strokes)`);
                socket.send(JSON.stringify({
                    type: 'history',
                    data: session.drawHistory
                }));
            }

            broadcastClients(sessionId);
        } 
        
        // 2. 그림 데이터 중계 (Broadcasting)
        else if (data.type === 'draw') {
            const { sessionId } = data;
            const session = sessions.get(sessionId);

            if (session) {
                // 서버 메모리에 그림 데이터 저장 (나중에 들어올 사람을 위해)
                if (!session.drawHistory) session.drawHistory = [];
                session.drawHistory.push(data);

                // 나를 제외한 방 안의 모든 사람에게 전송
                session.clients.forEach(client => {
                    if (client !== socket && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
        }
    });

    // 연결 종료 처리
    socket.on('close', () => {
        if (socket.sessionId && sessions.has(socket.sessionId)) {
            const session = sessions.get(socket.sessionId);
            if (session) {
                session.clients.delete(socket);
                console.log(`[LEAVE] ${socket.nickname} left session`);
                
                if (session.clients.size === 0) {
                    sessions.delete(socket.sessionId); // 방 비면 삭제 (히스토리도 같이 날아감)
                } else {
                    broadcastClients(socket.sessionId);
                }
            }
        }
    });
});

// 접속자 목록 전송 함수
function broadcastClients(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;

    const clientList = Array.from(session.clients).map(c => c.nickname || 'Unknown');
    session.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'clients', clients: clientList }));
        }
    });
}
