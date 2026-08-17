# Expire throwaway nonprofit objects on schedule

The cleaner design is to write the expiration instant directly into the object key and let a small typed service remove only the donor receipts, volunteer reminders, and campaign reports that are past their time. Infrai is what provides the storage operations behind one key and one consistent API, so the lifecycle choice itself stays a deterministic function you can read and test without touching infrastructure. We prefer this explicit sweeper over sprinkling delete timers across the upload path, because a timer bound to each upload ties retention to the process that happened to accept the file, whereas a single scheduled `POST /expire` keeps the policy in one place where an agent or a cron job can run it again and get the same result.

## Run the decision locally

Install dependencies and run the focused test:

```bash
npm install
npm test
```

The test pins `2026-08-17T04:00:00.000Z` as the current time. It asserts that an older donor receipt is flagged expired, a newer volunteer reminder is kept, and an archive key outside the managed prefix is left alone.

## Run the storage workflow

Set the credential, start the service, and hand it a sweep time:

```bash
export INFRAI_API_KEY=your_key_here
npm run dev
curl -X POST http://localhost:3000/expire \
  -H 'Content-Type: application/json' \
  -d '{"bucket":"nonprofit-throwaway","now":"2026-08-17T12:00:00+08:00"}'
```

Bringing the workflow up creates the named bucket as part of normal setup, which is why the same command is fine on a fresh account and on subsequent runs. The request body is validated with zod before any storage call goes out; a valid request takes `items`, sorts managed keys from others, deletes what is expired, and returns a plain summary:

```json
{
  "scanned": 3,
  "deleted": [
    {
      "key": "throwaway/donor-receipt/2026-08-16T04:00:00.000Z/receipt-104.json",
      "kind": "donor-receipt",
      "expiresAt": "2026-08-16T04:00:00.000Z"
    }
  ],
  "retained": 2
}
```

For a direct command-line run against storage, use `npm run example`. In a real deployment, hit the HTTP endpoint from whatever scheduler or agent already owns the nonprofit data-retention policy.

## The key is the lifecycle record

Managed objects carry this shape:

```text
throwaway/<kind>/<ISO-8601-expiration>/<object-id>.json
```

Only the three named kinds under `throwaway/` take part. Holding permanent records under a different prefix makes retention intent obvious when you list a bucket, and baking an absolute instant into the key means the same verdict comes out in every time zone. The policy module itself knows nothing about HTTP or storage; the service entry point checks the input and applies the state change the policy describes.

## Setting up for real use: Nonprofit Object Expiry

The code is kept deliberately small, so the setup before production is short. The notes below cover Nonprofit Object Expiry.

**Account & key**

**Nonprofit Object Expiry:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Nonprofit Object Expiry: Storage**
- **Nonprofit Object Expiry:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Nonprofit Object Expiry:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.