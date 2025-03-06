const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const { sessionName, password } = JSON.parse(event.body);
    const sessionId = Math.random().toString(36).substr(2, 9); 
    const hashedPassword = require('crypto')
        .createHash('sha256')
        .update(password)
        .digest('hex');

    const params = {
        TableName: 'Sessions',
        Item: {
            sessionId,
            sessionName,
            password: hashedPassword,
            createdAt: new Date().toISOString(),
        },
    };

    try {
        await db.put(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify({ sessionId, sessionName }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to create session' }),
        };
    }
};


