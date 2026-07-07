const { getClient, EVENTS_INDEX } = require("../lib/opensearch");
const { ok, badRequest, methodNotAllowed, toResponse } = require("../lib/http");

/**
 * Full search over indexed events. `name` is analyzed with an edge-ngram
 * autocomplete analyzer at index time and a synonym-aware analyzer at search
 * time (see opensearch/events-index.json), so partial words ("ham" →
 * "Hamilton") and synonyms ("concert" → "gig", "show") both match.
 */
async function searchEvents(query, size) {
  const response = await getClient().search({
    index: EVENTS_INDEX,
    body: {
      size,
      query: {
        multi_match: {
          query,
          fields: ["name^3", "genre", "performerName"],
          fuzziness: "AUTO",
        },
      },
    },
  });

  return response.body.hits.hits.map((hit) => ({
    score: hit._score,
    ...hit._source,
  }));
}

/** Lightweight prefix suggestions for a search-as-you-type box. */
async function autocompleteEvents(prefix, size) {
  const response = await getClient().search({
    index: EVENTS_INDEX,
    body: {
      size,
      _source: ["eventId", "name"],
      query: {
        match: {
          "name.autocomplete": { query: prefix, operator: "and" },
        },
      },
    },
  });

  return response.body.hits.hits.map((hit) => hit._source);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return methodNotAllowed();

    const params = event.queryStringParameters || {};
    const query = (params.q || "").trim();
    if (!query) return badRequest("Query parameter 'q' is required");

    const size = Math.min(Number(params.size) || 10, 50);
    const path = event.path || "";

    if (path.endsWith("/autocomplete")) {
      const suggestions = await autocompleteEvents(query, size);
      return ok({ query, suggestions });
    }

    const results = await searchEvents(query, size);
    return ok({ query, count: results.length, results });
  } catch (error) {
    return toResponse(error);
  }
};
