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

async function saveVenue(body) {
  requireFields(body, ["venueId", "name", "location", "seats"]);
  const item = {
    venueId: body.venueId,
    name: body.name,
    location: body.location,
    seats: Number(body.seats),
    seatMapKey: body.seatMapKey, // S3 object key uploaded via presigned URL
  };
  await docClient.send(
    new PutCommand({ TableName: TABLES.VENUES, Item: item })
  );
  return item;
}

async function getVenue(venueId) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLES.VENUES, Key: { venueId } })
  );
  return result.Item;
}

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;
    const venueId =
      (event.pathParameters && event.pathParameters.venueId) ||
      (event.queryStringParameters && event.queryStringParameters.venueId);

    if (method === "POST") {
      const item = await saveVenue(parseBody(event));
      return created({ message: "Venue created", venue: item });
    }

    if (method === "GET") {
      const item = await getVenue(venueId);
      return item ? ok({ venue: item }) : notFound(`Venue ${venueId} not found`);
    }

    if (method === "PUT") {
      const item = await saveVenue(parseBody(event));
      return ok({ message: "Venue updated", venue: item });
    }

    if (method === "DELETE") {
      await docClient.send(
        new DeleteCommand({ TableName: TABLES.VENUES, Key: { venueId } })
      );
      return ok({ message: `Venue ${venueId} deleted` });
    }

    return methodNotAllowed();
  } catch (error) {
    return toResponse(error);
  }
};
