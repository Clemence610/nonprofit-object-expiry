import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { InfraiError, infrai } from "./infrai_storage.js";
import { classifyForExpiry, nonprofitKinds } from "./lifecycle_policy.js";

const sweepRequest = z.object({
  bucket: z.string().min(3).max(63).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  now: z.string().datetime({ offset: true }),
});

type SweepRequest = z.infer<typeof sweepRequest>;

export async function expireThrowawayObjects(input: SweepRequest) {
  await infrai.storage.bucket.create(input.bucket);
  const { items } = await infrai.storage.object.list(input.bucket);
  const decisions = items
    .map(({ key }) => classifyForExpiry(key, new Date(input.now)))
    .filter((decision) => decision !== null);
  const expired = decisions.filter((decision) => decision.expired);

  await Promise.all(expired.map(({ key }) => infrai.storage.object.delete(input.bucket, key)));

  return {
    scanned: items.length,
    deleted: expired.map(({ key, kind, expiresAt }) => ({ key, kind, expiresAt })),
    retained: decisions.filter((decision) => !decision.expired).length,
  };
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const example = {
  bucket: "nonprofit-throwaway",
  now: "2026-08-17T12:00:00+08:00",
};

if (process.argv.includes("--example")) {
  console.log(JSON.stringify(await expireThrowawayObjects(example), null, 2));
} else {
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/expire") {
      json(response, 404, { error: "Route not found" });
      return;
    }
    try {
      const input = sweepRequest.parse(await readJson(request));
      json(response, 200, await expireThrowawayObjects(input));
    } catch (error) {
      if (error instanceof z.ZodError) {
        json(response, 400, { error: "Invalid request", issues: error.issues });
      } else if (error instanceof InfraiError) {
        json(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
          error: error.message,
        });
      } else {
        json(response, 500, { error: "Request could not be processed" });
      }
    }
  });
  server.listen(Number(process.env.PORT ?? 3000), () => {
    console.log(`Nonprofit expiry service listening on http://localhost:${process.env.PORT ?? 3000}`);
    console.log(`Managed object kinds: ${nonprofitKinds.join(", ")}`);
  });
}
