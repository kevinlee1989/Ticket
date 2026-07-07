const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { getClient, EVENTS_INDEX } = require("../lib/opensearch");

/**
 * Keeps the OpenSearch events index in sync with the Events DynamoDB table.
 *
 * DynamoDB Streams invoke this function with batches of INSERT / MODIFY /
 * REMOVE records; each is mirrored into OpenSearch so search results are
 * near-real-time without the write path ever touching OpenSearch directly.
 */
exports.handler = async (event) => {
  const client = getClient();

  for (const record of event.Records) {
    try {
      if (record.eventName === "INSERT" || record.eventName === "MODIFY") {
        const item = unmarshall(record.dynamodb.NewImage);
        await client.index({
          index: EVENTS_INDEX,
          id: item.eventId,
          body: item,
          refresh: false,
        });
      } else if (record.eventName === "REMOVE") {
        const item = unmarshall(record.dynamodb.OldImage);
        await client.delete({ index: EVENTS_INDEX, id: item.eventId });
      }
    } catch (error) {
      // Rethrow so the stream retries the batch instead of silently
      // dropping the record and letting the index drift.
      console.error(
        `Failed to sync ${record.eventName} record to OpenSearch:`,
        error
      );
      throw error;
    }
  }

  return { batchSize: event.Records.length };
};
