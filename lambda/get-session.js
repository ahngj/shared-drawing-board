const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Sessions";

exports.handler = async (event) => {
    try {
        // 1. DynamoDB에서 모든 방 목록 가져오기
        const params = {
            TableName: TABLE_NAME
        };

        const data = await db.send(new ScanCommand(params));

        // 2. 생성일자 기준 내림차순 정렬 (최신 방이 위로)
        const sortedSessions = data.Items.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        return response(200, sortedSessions);

    } catch (error) {
        console.error("DynamoDB Scan Error:", error);
        return response(500, { message: "Internal Server Error" });
    }
};

function response(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,GET"
        },
        body: JSON.stringify(body)
    };
}
