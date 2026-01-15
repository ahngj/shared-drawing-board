const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    // DynamoDB Scan은 비용이 비싸므로 실무에선 Query를 쓰거나 Limit을 걸어야 함.
    const params = {
        TableName: 'Sessions',
        Limit: 20 // 최대 20개까지만 가져오도록 제한 (안전장치)
    };
  
    try {
        const data = await db.scan(params).promise();
        
        // 최신순 정렬 (Client-side sorting)
        // DynamoDB Scan은 정렬을 지원하지 않으므로 가져와서 정렬
        let items = data.Items || [];
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,GET"
            },
            body: JSON.stringify(items),
        };
    } catch (error) {
        console.error("DynamoDB Scan Error:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: 'Failed to retrieve sessions' }),
        };
    }
};
