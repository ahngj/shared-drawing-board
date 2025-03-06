exports.handler = async () => {
    const params = {
        TableName: 'Sessions',
    };
  
    try {
        const data = await db.scan(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify(data.Items),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to retrieve sessions' }),
        };
    }
  };
  