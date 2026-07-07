const { QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLES } = require("../lib/dynamo");
const {
  ok,
  conflict,
  methodNotAllowed,
  parseBody,
  requireFields,
  toResponse,
} = require("../lib/http");

const HOLD_SECONDS = Number(process.env.HOLD_SECONDS || 600);

const STATUS = {
  AVAILABLE: "AVAILABLE",
  HELD: "HELD",
  SOLD: "SOLD",
};

const nowEpoch = () => Math.floor(Date.now() / 1000);

/**
 * List tickets for an event, optionally filtered by status.
 * Expired holds are surfaced as AVAILABLE so clients never see a stale lock.
 */
async function listTickets(eventId, status) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.TICKETS,
      KeyConditionExpression: "eventId = :eventId",
      ExpressionAttributeValues: { ":eventId": eventId },
    })
  );

  const now = nowEpoch();
  const tickets = (result.Items || []).map((t) => {
    const holdExpired = t.status === STATUS.HELD && (t.holdExpiresAt || 0) <= now;
    return holdExpired ? { ...t, status: STATUS.AVAILABLE } : t;
  });

  return status ? tickets.filter((t) => t.status === status) : tickets;
}

/**
 * Place a time-boxed hold on a seat using an optimistic conditional write.
 *
 * The condition allows the write only when the seat is AVAILABLE, or when a
 * previous hold has expired (holdExpiresAt in the past). Two users racing for
 * the same seat can never both succeed: DynamoDB evaluates the condition
 * atomically and the loser receives ConditionalCheckFailedException.
 */
async function holdTicket({ eventId, ticketId, userId }) {
  const now = nowEpoch();
  const expiresAt = now + HOLD_SECONDS;

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLES.TICKETS,
      Key: { eventId, ticketId },
      ConditionExpression:
        "attribute_exists(ticketId) AND " +
        "(#status = :available OR (#status = :held AND holdExpiresAt <= :now))",
      UpdateExpression:
        "SET #status = :held, holdExpiresAt = :expiresAt, heldBy = :userId",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":available": STATUS.AVAILABLE,
        ":held": STATUS.HELD,
        ":now": now,
        ":expiresAt": expiresAt,
        ":userId": userId,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return { ticket: result.Attributes, holdExpiresAt: expiresAt };
}

/**
 * Convert an active hold into a sale. Only the user who owns the hold may
 * confirm, and only while the hold is still live.
 */
async function confirmTicket({ eventId, ticketId, userId }) {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLES.TICKETS,
      Key: { eventId, ticketId },
      ConditionExpression:
        "#status = :held AND heldBy = :userId AND holdExpiresAt > :now",
      UpdateExpression:
        "SET #status = :sold, soldTo = :userId, soldAt = :now " +
        "REMOVE holdExpiresAt, heldBy",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":held": STATUS.HELD,
        ":sold": STATUS.SOLD,
        ":userId": userId,
        ":now": nowEpoch(),
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes;
}

/** Voluntarily release a hold (e.g. user abandoned checkout). */
async function releaseTicket({ eventId, ticketId, userId }) {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLES.TICKETS,
      Key: { eventId, ticketId },
      ConditionExpression: "#status = :held AND heldBy = :userId",
      UpdateExpression:
        "SET #status = :available REMOVE holdExpiresAt, heldBy",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":held": STATUS.HELD,
        ":available": STATUS.AVAILABLE,
        ":userId": userId,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes;
}

const isConditionFailure = (err) =>
  err.name === "ConditionalCheckFailedException";

exports.handler = async (event) => {
  try {
    const path = event.path || "";
    const method = event.httpMethod;

    // GET /events/{eventId}/tickets?status=AVAILABLE
    if (method === "GET") {
      const eventId =
        (event.pathParameters && event.pathParameters.eventId) ||
        (event.queryStringParameters && event.queryStringParameters.eventId);
      if (!eventId) {
        return toResponse(
          Object.assign(new Error("eventId is required"), { statusCode: 400 })
        );
      }
      const status =
        event.queryStringParameters && event.queryStringParameters.status;
      const tickets = await listTickets(eventId, status);
      return ok({ count: tickets.length, tickets });
    }

    if (method === "POST") {
      const body = parseBody(event);
      requireFields(body, ["eventId", "ticketId", "userId"]);

      if (path.endsWith("/hold")) {
        try {
          const result = await holdTicket(body);
          return ok({
            message: "Ticket held",
            holdExpiresAt: result.holdExpiresAt,
            ticket: result.ticket,
          });
        } catch (err) {
          if (isConditionFailure(err)) {
            return conflict("Ticket is not available (already held or sold)");
          }
          throw err;
        }
      }

      if (path.endsWith("/confirm")) {
        try {
          const ticket = await confirmTicket(body);
          return ok({ message: "Purchase confirmed", ticket });
        } catch (err) {
          if (isConditionFailure(err)) {
            return conflict(
              "No active hold for this user (hold expired or ticket sold)"
            );
          }
          throw err;
        }
      }

      if (path.endsWith("/release")) {
        try {
          const ticket = await releaseTicket(body);
          return ok({ message: "Hold released", ticket });
        } catch (err) {
          if (isConditionFailure(err)) {
            return conflict("No active hold owned by this user");
          }
          throw err;
        }
      }
    }

    return methodNotAllowed();
  } catch (error) {
    return toResponse(error);
  }
};
