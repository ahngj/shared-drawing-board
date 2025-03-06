const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();
const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint: 'wss://kepb70r5dl.execute-api.ap-northeast-2.amazonaws.com/production/',
});

exports.handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    const body = JSON.parse(event.body);

    const connections = await db.scan({ TableName: 'Connections' }).promise();

    const postCalls = connections.Items.map(async ({ connectionId }) => {
        try {
            await apigwManagementApi.postToConnection({
                ConnectionId: connectionId,
                Data: JSON.stringify(body.data),
            }).promise();
        } catch (err) {
            if (err.statusCode === 410) {
                await db.delete({
                    TableName: 'Connections',
                    Key: { connectionId },
                }).promise();
            }
        }
    });

    await Promise.all(postCalls);

    return { statusCode: 200, body: 'Message sent.' };
};



