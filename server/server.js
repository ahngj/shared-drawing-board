const WebSocket = require('ws');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const server = new WebSocket.Server({ port: 3000 });
const sessions = new Map(); // 메모리 세션 관리

// 본인의 리전으로 수정 (예: ap-southeast-2)
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-southeast-2" }));

console.log("🚀 EC2 WebSocket Server Started (Auto-Managed)");

server.on('connection', (socket) => {
    socket.on('message', async (message) => {
        let data;
        try { data = JSON.parse(message); } catch (e) { return; }

        if (data.type === 'join') {
            const { sessionId, nickname } = data;
            if (!sessions.has(sessionId)) {
                sessions.set(sessionId, { clients: new Set(), drawHistory: [] });
            }
            const session = sessions.get(sessionId);
            socket.sessionId = sessionId;
            socket.nickname = nickname;
            session.clients.add(socket);
            
            console.log(`[JOIN] ${nickname} joined session ${sessionId}`);
            
            if (session.drawHistory.length > 0) {
                socket.send(JSON.stringify({ type: 'history', data: session.drawHistory }));
            }
            broadcastClients(sessionId);
        } 
        else if (data.type === 'draw') {
            const session = sessions.get(data.sessionId);
            if (session) {
                session.drawHistory.push(data); // 히스토리 저장
                session.clients.forEach(client => {
                    if (client !== socket && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
        }
    });

    socket.on('close', async () => {
        if (socket.sessionId && sessions.has(socket.sessionId)) {
            const session = sessions.get(socket.sessionId);
            session.clients.delete(socket);
            console.log(`[LEAVE] ${socket.nickname} left session`);
            
            // ⭐ 인원이 0명이면 DynamoDB에서 삭제
            if (session.clients.size === 0) {
                console.log(`Room ${socket.sessionId} is empty. Auto-deleting from DB...`);
                try {
                    await db.send(new DeleteCommand({
                        TableName: 'Sessions',
                        Key: { sessionId: socket.sessionId }
                    }));
                    sessions.delete(socket.sessionId); // 메모리 삭제
                } catch (err) {
                    console.error("Auto delete failed:", err);
                }
            } else {
                broadcastClients(socket.sessionId);
            }
        }
    });
});

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
