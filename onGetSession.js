const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const params = {
        TableName: 'Sessions' // 테이블 이름 확인
    };
  
    try {
        const data = await db.scan(params).promise();
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // CORS 허용
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,GET"
            },
            body: JSON.stringify(data.Items),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: 'Failed to retrieve sessions' }),
        };
    }
};
