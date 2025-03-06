const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    try {
        await db.delete({
            TableName: 'Connections',
            Key: { connectionId }
        }).promise();
        return { statusCode: 200, body: 'Disconnected.' };
    } catch (err) {
        return { statusCode: 500, body: 'Failed to disconnect: ' + JSON.stringify(err) };
    }
};
