const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        let body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        const { sessionName, password } = body;
        
        if (!sessionName || sessionName.trim() === "") {
            return response(400, { message: "방 이름을 입력해주세요." });
        }

        // 1. 중복 방 이름 체크
        const scanParams = {
            TableName: 'Sessions',
            FilterExpression: "sessionName = :name",
            ExpressionAttributeValues: { ":name": sessionName.trim() }
        };
        const existing = await db.send(new ScanCommand(scanParams));
        
        if (existing.Items && existing.Items.length > 0) {
            return response(400, { message: "이미 존재하는 방 이름입니다." });
        }
        
        // 2. 고유 ID 생성
        const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        
        const params = {
            TableName: 'Sessions', 
            Item: {
                sessionId: sessionId,
                sessionName: sessionName.trim(),
                password: password || "",
                createdAt: new Date().toISOString()
            }
        };

        await db.send(new PutCommand(params));
        return response(200, { sessionId, sessionName: sessionName.trim() });

    } catch (error) {
        console.error("DynamoDB Error:", error);
        return response(500, { message: "서버 오류가 발생했습니다." });
    }
};

function response(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        },
        body: JSON.stringify(body)
    };
}
