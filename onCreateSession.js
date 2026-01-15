const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {
        // API Gateway Proxy Integration 대응 (Body 파싱)
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        const { sessionName, password } = body;
        
        // 고유 ID 생성
        const sessionId = Math.random().toString(36).substr(2, 9);
        
        // DynamoDB 저장
        const params = {
            TableName: 'Sessions', // 테이블 이름 확인
            Item: {
                sessionId: sessionId,
                sessionName: sessionName,
                password: password, 
                createdAt: new Date().toISOString()
            }
        };

        await db.put(params).promise();

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // ⭐ CORS 허용
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            body: JSON.stringify({ sessionId, sessionName })
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Internal Server Error" })
        };
    }
};
