const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {
        // 1. Body 파싱 (API Gateway Proxy Integration 대응)
        let body;
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch (e) {
            return response(400, { message: "Invalid JSON format" });
        }

        const { sessionName, password } = body;
        
        // 2. 유효성 검사 (Validation)
        if (!sessionName || sessionName.trim() === "") {
            return response(400, { message: "Session name is required" });
        }
        
        // 3. 고유 ID 생성 (Timestamp + Random 조합으로 충돌 방지 강화)
        // 실무에선 uuid 라이브러리 사용 권장 (npm install uuid)
        const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        
        // 4. DynamoDB 저장
        const params = {
            TableName: 'Sessions', 
            Item: {
                sessionId: sessionId,
                sessionName: sessionName.trim(),
                password: password || "", // 비밀번호 없으면 빈 값
                createdAt: new Date().toISOString(),
                // TTL(Time To Live) 설정 (선택사항): 24시간 뒤 자동 삭제 (DynamoDB 설정 필요)
                // ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) 
            }
        };

        await db.put(params).promise();

        return response(200, { sessionId, sessionName });

    } catch (error) {
        console.error("DynamoDB Error:", error);
        return response(500, { message: "Internal Server Error" });
    }
};

// 응답 헬퍼 함수
function response(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        },
        body: JSON.stringify(body)
    };
}
