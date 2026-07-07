const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
const {
  ok,
  badRequest,
  methodNotAllowed,
  parseBody,
  requireFields,
  toResponse,
} = require("../lib/http");

const s3 = new S3Client({});

const BUCKET = process.env.ASSETS_BUCKET;
const URL_TTL_SECONDS = Number(process.env.UPLOAD_URL_TTL_SECONDS || 300);

// Only event posters and venue seat maps may be uploaded, and only as images.
const ALLOWED_KINDS = new Set(["poster", "seat-map"]);
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

/**
 * Issue a short-lived presigned PUT URL so clients upload assets directly to
 * S3. The API never proxies file bytes — Lambda only signs the request, which
 * keeps time-to-first-byte low and payloads off the function entirely.
 */
async function createUploadUrl({ kind, contentType, ownerId }) {
  const extension = contentType.split("/")[1].replace("+xml", "");
  const key = `${kind}s/${ownerId}/${crypto.randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: URL_TTL_SECONDS,
  });

  return { uploadUrl, key, expiresIn: URL_TTL_SECONDS };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return methodNotAllowed();

    const body = parseBody(event);
    requireFields(body, ["kind", "contentType", "ownerId"]);

    if (!ALLOWED_KINDS.has(body.kind)) {
      return badRequest(
        `kind must be one of: ${[...ALLOWED_KINDS].join(", ")}`
      );
    }
    if (!ALLOWED_CONTENT_TYPES.has(body.contentType)) {
      return badRequest(
        `contentType must be one of: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`
      );
    }

    const result = await createUploadUrl(body);
    return ok(result);
  } catch (error) {
    return toResponse(error);
  }
};
