const {
  PutCommand,
  GetCommand,
  DeleteCommand,
  BatchWriteCommand,
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

/** Look up the venue to determine how many seats (tickets) the event has. */
async function getVenue(venueId) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLES.VENUES, Key: { venueId } })
  );
  return result.Item;
}

/**
 * Seed one ticket row per seat. BatchWrite accepts at most 25 items per
 * request, so writes are chunked and dispatched concurrently.
 */
async function createTicketsForEvent(eventId, seatCount) {
  const items = [];
  for (let i = 1; i <= seatCount; i++) {
    items.push({
      PutRequest: {
        Item: {
          eventId,
          ticketId: `SEAT-${String(i).padStart(4, "0")}`,
          status: "AVAILABLE",
        },
      },
    });
  }

  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }

  await Promise.all(
    chunks.map((chunk) =>
      docClient.send(
        new BatchWriteCommand({ RequestItems: { [TABLES.TICKETS]: chunk } })
      )
    )
  );

  return seatCount;
}

async function createEvent(body) {
  requireFields(body, ["eventId", "name", "date", "venueId"]);

  const venue = await getVenue(body.venueId);
  if (!venue) {
    const error = new Error(`Venue ${body.venueId} not found`);
    error.statusCode = 404;
    throw error;
  }

  const item = {
    eventId: body.eventId,
    name: body.name,
    date: body.date,
    venueId: body.venueId,
    performerId: body.performerId,
    genre: body.genre,
    posterKey: body.posterKey, // S3 object key uploaded via presigned URL
    createdAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({ TableName: TABLES.EVENTS, Item: item })
  );

  const ticketCount = await createTicketsForEvent(body.eventId, venue.seats);
  return { event: item, ticketCount };
}

async function getEvent(eventId) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLES.EVENTS, Key: { eventId } })
  );
  return result.Item;
}

async function updateEvent(body) {
  requireFields(body, ["eventId"]);
  const existing = await getEvent(body.eventId);
  if (!existing) {
    const error = new Error(`Event ${body.eventId} not found`);
    error.statusCode = 404;
    throw error;
  }

  const item = { ...existing, ...body };
  await docClient.send(
    new PutCommand({ TableName: TABLES.EVENTS, Item: item })
  );
  return item;
}

async function deleteEvent(eventId) {
  await docClient.send(
    new DeleteCommand({ TableName: TABLES.EVENTS, Key: { eventId } })
  );
}

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;
    const eventId =
      (event.pathParameters && event.pathParameters.eventId) ||
      (event.queryStringParameters && event.queryStringParameters.eventId);

    if (method === "POST") {
      const result = await createEvent(parseBody(event));
      return created({
        message: "Event created",
        event: result.event,
        ticketsCreated: result.ticketCount,
      });
    }

    if (method === "GET") {
      const item = await getEvent(eventId);
      return item ? ok({ event: item }) : notFound(`Event ${eventId} not found`);
    }

    if (method === "PUT") {
      const item = await updateEvent(parseBody(event));
      return ok({ message: "Event updated", event: item });
    }

    if (method === "DELETE") {
      await deleteEvent(eventId);
      return ok({ message: `Event ${eventId} deleted` });
    }

    return methodNotAllowed();
  } catch (error) {
    return toResponse(error);
  }
};
