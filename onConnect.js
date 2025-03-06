const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    try {
        await db.put({
            TableName: 'Connections',
            Item: { connectionId }
        }).promise();
        return { statusCode: 200, body: 'Connected.' };
    } catch (err) {
        return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
    }
};
