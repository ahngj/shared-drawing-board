const WebSocket = require('ws');

// WebSocket 서버 생성
const server = new WebSocket.Server({ port: 3000 });
const sessions = new Map(); // Map<sessionId, { clients: Map<socket, { nickname, color, tool }>, drawings: [] }>

server.on('connection', (socket) => {
    console.log('New client connected');

    // 새 클라이언트에게 현재 세션 목록 전송
    const sessionList = Array.from(sessions.keys());
    socket.send(JSON.stringify({ type: 'sessionList', sessions: sessionList }));

    socket.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'createSession') {
            if (!sessions.has(data.sessionId)) {
                sessions.set(data.sessionId, { clients: new Map(), drawings: [] });
                console.log(`Session ${data.sessionId} created.`);
                broadcastSessionList();
            } else {
                socket.send(JSON.stringify({ type: 'error', message: 'Session already exists.' }));
            }
        } else if (data.type === 'join') {
            const { sessionId, nickname } = data;
            const session = sessions.get(sessionId);

            if (!session) {
                socket.send(JSON.stringify({ type: 'error', message: 'Session does not exist.' }));
                return;
            }

            session.clients.set(socket, { nickname, color: '#000000', tool: 'pencil' });
            console.log(`${nickname} joined session ${sessionId}`);

            // 기존 그림 데이터 전송
            session.drawings.forEach((drawing) => {
                socket.send(JSON.stringify({ type: 'draw', ...drawing }));
            });

            // 사용자 목록 브로드캐스트
            broadcastClients(sessionId);
        } else if (data.type === 'draw') {
            const { sessionId, x, y, color, tool } = data;
            const session = sessions.get(sessionId);

            if (session) {
                // 그림 데이터 저장
                session.drawings.push({ x, y, color, tool });

                session.clients.forEach((clientData, clientSocket) => {
                    if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
                        clientSocket.send(
                            JSON.stringify({
                                type: 'draw',
                                x,
                                y,
                                color,
                                tool,
                            })
                        );
                    }
                });
            }
        } else if (data.type === 'changeTool') {
            const { sessionId, tool } = data;
            const session = sessions.get(sessionId);

            if (session && session.clients.has(socket)) {
                session.clients.get(socket).tool = tool;
                console.log(`Tool changed to ${tool} in session ${sessionId}`);
            }
        }
    });

    socket.on('close', () => {
        sessions.forEach((session, sessionId) => {
            if (session.clients.has(socket)) {
                const { nickname } = session.clients.get(socket);
                session.clients.delete(socket);
                console.log(`${nickname} disconnected from session ${sessionId}`);

                if (session.clients.size === 0) {
                    sessions.delete(sessionId);
                    console.log(`Session ${sessionId} deleted as it is empty.`);
                    broadcastSessionList();
                } else {
                    broadcastClients(sessionId);
                }
            }
        });
    });
});

// 사용자 목록 브로드캐스트
function broadcastClients(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;

    // 현재 세션의 모든 닉네임 목록 생성
    const clientList = Array.from(session.clients.values()).map((clientData) => clientData.nickname);

    session.clients.forEach((_, clientSocket) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(
                JSON.stringify({
                    type: 'clients',
                    clients: clientList,
                })
            );
        }
    });
}

// 세션 목록 브로드캐스트
function broadcastSessionList() {
    const sessionList = Array.from(sessions.keys());
    console.log('Broadcasting session list:', sessionList);
    server.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'sessionList', sessions: sessionList }));
        }
    });
}