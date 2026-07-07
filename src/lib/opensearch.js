const { Client } = require("@opensearch-project/opensearch");

const EVENTS_INDEX = process.env.OPENSEARCH_EVENTS_INDEX || "events";

let client;

/**
 * Lazily create a single OpenSearch client per Lambda container.
 * Endpoint and credentials are injected via environment variables.
 */
function getClient() {
  if (!client) {
    client = new Client({
      node: process.env.OPENSEARCH_ENDPOINT,
      auth: {
        username: process.env.OPENSEARCH_USERNAME,
        password: process.env.OPENSEARCH_PASSWORD,
      },
    });
  }
  return client;
}

module.exports = { getClient, EVENTS_INDEX };
