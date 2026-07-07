const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

// Inside Lambda, credentials and region come from the execution role /
// environment. Never hardcode keys.
const client = new DynamoDBClient({});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLES = {
  EVENTS: process.env.EVENTS_TABLE || "Events",
  VENUES: process.env.VENUES_TABLE || "Venues",
  PERFORMERS: process.env.PERFORMERS_TABLE || "Performers",
  TICKETS: process.env.TICKETS_TABLE || "Tickets",
};

module.exports = { docClient, TABLES };
