const {
  PutCommand,
  GetCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLES } = require("../lib/dynamo");
const {
  ok,
  created,
  notFound,
  methodNotAllowed,
  parseBody,
  requireFields,
  toResponse,
} = require("../lib/http");

async function savePerformer(body) {
  requireFields(body, ["performerId", "name"]);
  const item = {
    performerId: body.performerId,
    name: body.name,
    genre: body.genre,
    age: body.age !== undefined ? Number(body.age) : undefined,
  };
  await docClient.send(
    new PutCommand({ TableName: TABLES.PERFORMERS, Item: item })
  );
  return item;
}

async function getPerformer(performerId) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLES.PERFORMERS, Key: { performerId } })
  );
  return result.Item;
}

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;
    const performerId =
      (event.pathParameters && event.pathParameters.performerId) ||
      (event.queryStringParameters && event.queryStringParameters.performerId);

    if (method === "POST") {
      const item = await savePerformer(parseBody(event));
      return created({ message: "Performer created", performer: item });
    }

    if (method === "GET") {
      const item = await getPerformer(performerId);
      return item
        ? ok({ performer: item })
        : notFound(`Performer ${performerId} not found`);
    }

    if (method === "PUT") {
      const item = await savePerformer(parseBody(event));
      return ok({ message: "Performer updated", performer: item });
    }

    if (method === "DELETE") {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.PERFORMERS,
          Key: { performerId },
        })
      );
      return ok({ message: `Performer ${performerId} deleted` });
    }

    return methodNotAllowed();
  } catch (error) {
    return toResponse(error);
  }
};
