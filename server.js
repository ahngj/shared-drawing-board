const WebSocket = require('ws');

// WebSocket 서버 생성 (포트 3000)
const server = new WebSocket.Server({ port: 3000 });
const sessions = new Map(); // 메모리 세션 관리 (추후 Redis 대체 가능)

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
                // 메모리에 방이 없으면 생성 (Lambda DB와 별개로 소켓 관리용)
                sessions.set(sessionId, { clients: new Set() });
            }
            
            const session = sessions.get(sessionId);
            
            // 소켓에 사용자 정보 저장
            socket.sessionId = sessionId;
            socket.nickname = nickname;
            
            session.clients.add(socket);
            
            console.log(`[JOIN] ${nickname} joined session ${sessionId}`);
            broadcastClients(sessionId);
        } 
        
        // 2. 그림 데이터 중계 (Broadcasting)
        else if (data.type === 'draw') {
            const { sessionId } = data;
            const session = sessions.get(sessionId);

            if (session) {
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
                    sessions.delete(socket.sessionId); // 방 비면 삭제
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
