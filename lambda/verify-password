const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        const { sessionId, password } = body;

        const res = await db.send(new GetCommand({
            TableName: "Sessions",
            Key: { sessionId }
        }));

        if (!res.Item) {
            return response(404, { success: false, message: "방을 찾을 수 없습니다." });
        }

        // 비밀번호 대조 (설정 안 된 경우 빈 문자열과 비교)
        const isCorrect = (res.Item.password === (password || ""));

        if (isCorrect) {
            return response(200, { success: true });
        } else {
            return response(401, { success: false, message: "비밀번호가 일치하지 않습니다." });
        }
    } catch (err) {
        return response(500, { success: false, message: "서버 오류 발생" });
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
