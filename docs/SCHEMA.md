# Database Schema

MongoDB (via Mongoose). Three collections. All timestamps are stored as
native BSON dates; the API serializes them to ISO 8601 strings.

## `responses`

One document per monitoring tick (every 5 minutes). Failed probes are stored
too — a failed request is monitoring data, not an exception.

| Field            | Type               | Notes                                                        |
| ---------------- | ------------------ | ------------------------------------------------------------ |
| `_id`            | ObjectId           | Primary key, exposed to clients as `id`                      |
| `requestPayload` | Mixed (object)     | The random JSON payload sent to httpbin                      |
| `statusCode`     | Number \| null     | HTTP status; `null` on network failure / timeout            |
| `ok`             | Boolean            | `true` for 2xx responses                                     |
| `durationMs`     | Number             | Round-trip time in milliseconds                              |
| `responseBody`   | Mixed \| null      | Parsed JSON, raw string, or a truncation marker for >100 KB  |
| `responseSize`   | Number             | Response body size in bytes                                  |
| `error`          | String \| null     | Error label, e.g. `HTTP 503` or a network error message      |
| `createdAt`      | Date               | Set on insert (`timestamps`)                                 |

**Indexes:** `{ createdAt: -1 }` — every list/stats/baseline query is time-ranged.

Example:

```json
{
  "id": "6a29591e42ba004abb584df1",
  "requestPayload": { "probeId": "foxtrot-1732", "sentAt": "2026-01-01T00:00:00.000Z", "data": { "metric_0": 4821 } },
  "statusCode": 200,
  "ok": true,
  "durationMs": 312.4,
  "responseBody": { "json": { "probeId": "foxtrot-1732" } },
  "responseSize": 1422,
  "error": null,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

## `incidents`

One document per detected anomaly (response time > 2× the rolling 1-hour
average). Created by the anomaly watcher; a 15-minute cooldown prevents storms.

| Field             | Type                      | Notes                                              |
| ----------------- | ------------------------- | -------------------------------------------------- |
| `_id`             | ObjectId                  | Exposed as `id`                                    |
| `responseId`      | String                    | The `responses._id` that triggered the incident    |
| `endpoint`        | String                    | Monitored URL                                      |
| `severity`        | `'warning' \| 'critical'` | `critical` at ≥ 3× baseline                        |
| `durationMs`      | Number                    | The anomalous response time                        |
| `baselineAvgMs`   | Number                    | Rolling 1-hour average at the time                 |
| `ratio`           | Number                    | `durationMs / baselineAvgMs`                       |
| `summary`         | String                    | Human-readable one-line description                |
| `rootCauses`      | String[]                  | LLM-suggested (or rule-based fallback) hypotheses  |
| `recommendations` | String[]                  | LLM-suggested (or rule-based fallback) next steps  |
| `llmGenerated`    | Boolean                   | `false` when the fallback produced the text        |
| `createdAt`       | Date                      | Set on insert                                      |

**Indexes:** `{ createdAt: -1 }`.

## `llmusages`

One document per LLM API call, for cost tracking and the dashboard cost panel.

| Field       | Type                                 | Notes                          |
| ----------- | ------------------------------------ | ------------------------------ |
| `_id`       | ObjectId                             |                                |
| `purpose`   | `'chat' \| 'incident' \| 'analysis'` | Which feature made the call    |
| `tokensIn`  | Number                               | Input tokens (from API usage)  |
| `tokensOut` | Number                               | Output tokens (from API usage) |
| `costUsd`   | Number                               | Computed at Haiku pricing      |
| `createdAt` | Date                                 | Set on insert                  |

**Indexes:** `{ createdAt: -1 }`.
