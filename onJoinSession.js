exports.handler = async (event) => {
  const { sessionId, password, nickname } = JSON.parse(event.body);
  const connectionId = event.requestContext.connectionId;

  const session = await db
      .get({
          TableName: 'Sessions',
          Key: { sessionId },
      })
      .promise();

  if (!session.Item) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Session not found' }) };
  }

  const hashedPassword = require('crypto')
      .createHash('sha256')
      .update(password)
      .digest('hex');

  if (hashedPassword !== session.Item.password) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Invalid password' }) };
  }

  const userParams = {
      TableName: 'Users',
      Item: {
          sessionId,
          connectionId,
          nickname,
          color: 'black', 
      },
  };

  try {
      await db.put(userParams).promise();
      return { statusCode: 200, body: JSON.stringify({ message: 'Joined session' }) };
  } catch (error) {
      return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Failed to join session' }),
      };
  }
};
