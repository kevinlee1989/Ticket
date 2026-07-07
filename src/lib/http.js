/**
 * Small helpers so every handler returns a consistent API Gateway response
 * shape and parses request bodies the same way.
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

const respond = (statusCode, body) => ({
  statusCode,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});

const ok = (body) => respond(200, body);
const created = (body) => respond(201, body);
const badRequest = (message) => respond(400, { message });
const notFound = (message) => respond(404, { message });
const conflict = (message) => respond(409, { message });
const methodNotAllowed = () => respond(405, { message: "Method not allowed" });
const serverError = (error) =>
  respond(500, { message: "Internal server error", error: error.message });

/**
 * Parse a JSON request body. Throws a tagged error the handlers convert
 * into a 400 response.
 */
function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (err) {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

/** Ensure the given fields exist on the payload; throws a 400-tagged error. */
function requireFields(payload, fields) {
  const missing = fields.filter(
    (f) => payload[f] === undefined || payload[f] === null || payload[f] === ""
  );
  if (missing.length > 0) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
}

/** Convert a thrown error into an HTTP response. */
function toResponse(error) {
  if (error.statusCode === 400) return badRequest(error.message);
  if (error.statusCode === 404) return notFound(error.message);
  if (error.statusCode === 409) return conflict(error.message);
  console.error("Unhandled error:", error);
  return serverError(error);
}

module.exports = {
  ok,
  created,
  badRequest,
  notFound,
  conflict,
  methodNotAllowed,
  serverError,
  parseBody,
  requireFields,
  toResponse,
};
