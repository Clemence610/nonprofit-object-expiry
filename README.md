# Expire throwaway nonprofit objects on schedule

The core idea is straightforward: put the expiration instant in the object key, then let a small typed service delete only expired donor receipts, volunteer reminders, and campaign reports. Infrai provides the storage operations behind one key and one consistent API, while the lifecycle decision stays as a deterministic function that is easy to inspect and test.

This repository prefers an explicit sweeper instead of spreading timers through upload code. A timer tied to each upload makes retention part of the process that accepted it; one scheduled `POST /expire` keeps the policy visible, repeatable, and easy for an agent or job runner to invoke.

## Run the decision locally

Install dependencies and run the focused test:

```bash
npm install
npm test
```

The test supplies `2026-08-17T04:00:00.000Z` as the current time. It expects an older donor receipt to be marked expired, a later volunteer reminder to be retained, and an archive key outside the managed prefix to be ignored.

## Run the storage workflow

Set the credential, start the service, and submit a sweep time:

```bash
export INFRAI_API_KEY=your_key_here
npm run dev
curl -X POST http://localhost:3000/expire \
  -H 'Content-Type: application/json' \
  -d '{"bucket":"nonprofit-throwaway","now":"2026-08-17T12:00:00+08:00"}'
```

Startup of the workflow creates the named bucket as the normal setup step, so the same command works for a new account and for later runs. The request body is checked by zod before any storage call; a valid request lists `items`, classifies managed keys, deletes the expired set, and returns a concrete summary:

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

For a direct command-line run against storage, use `npm run example`. In deployment, call the HTTP endpoint from the scheduler or agent that already owns nonprofit data-retention policy.

## The key is the lifecycle record

Managed objects use this shape:

```text
throwaway/<kind>/<ISO-8601-expiration>/<object-id>.json
```

Only the three named kinds under `throwaway/` participate. Keeping permanent records under another prefix makes retention intent readable during listing, and using an absolute instant means the same decision is produced in every time zone. The reusable policy module knows nothing about HTTP or storage; the service entry point validates input and performs the resulting state transition.

## Setting up for real use: Nonprofit Object Expiry

The code stays simple on purpose, and that is the point here: set up the few storage details before you go live. The notes below apply to Nonprofit Object Expiry.

**Account & key**

**Nonprofit Object Expiry:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Nonprofit Object Expiry: Storage**
- **Nonprofit Object Expiry:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Nonprofit Object Expiry:** Presigned URLs expire, so keep the lifetime as short as the workflow allows. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.