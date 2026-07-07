/**
 * One-time setup: creates the OpenSearch events index with the custom
 * edge-ngram autocomplete and synonym analyzers.
 *
 * Usage:
 *   OPENSEARCH_ENDPOINT=https://... OPENSEARCH_USERNAME=... OPENSEARCH_PASSWORD=... \
 *     node scripts/create-search-index.js
 */
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { getClient, EVENTS_INDEX } = require("../src/lib/opensearch");

async function main() {
  const client = getClient();
  const config = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "opensearch", "events-index.json"),
      "utf8"
    )
  );

  const exists = await client.indices.exists({ index: EVENTS_INDEX });
  if (exists.body) {
    console.log(`Index "${EVENTS_INDEX}" already exists — nothing to do.`);
    return;
  }

  await client.indices.create({ index: EVENTS_INDEX, body: config });
  console.log(`Created index "${EVENTS_INDEX}" with custom analyzers.`);
}

main().catch((err) => {
  console.error("Failed to create index:", err);
  process.exit(1);
});
