# Pterodactyl MCP

A standalone, self-hosted MCP server for Pterodactyl Application and Client APIs.

Run one process per panel. Application and Client keys remain separate, and
writes require operator enablement. Deployment bindings and credentials belong
in your private infrastructure repository.

The [coverage matrix](docs/coverage.md) lists every route in the pinned provider
source, including exclusions and pending work. Standard tools cover server,
user, node, allocation, location, nest, egg, database, backup, schedule, subuser,
startup and file operations. Focused tools handle verified binary upload,
file hashing and bounded console capture.

This is an initial implementation. Controlled-provider and SDK tests pass;
live panels, ChatGPT connection, native file delivery and reconnect behavior
require separate acceptance. No npm release has been published.

## Run

Use Node 24.22.1 or a later Node 24 release.

```sh
npm ci --ignore-scripts
npm run check
npm start
```

Set these environment variables through your MCP launcher or secret manager:

| Variable                      | Required or default                                             |
| ----------------------------- | --------------------------------------------------------------- |
| `PTERODACTYL_URL`             | Required HTTPS origin, for example `https://panel.example.test` |
| `PTERODACTYL_APPLICATION_KEY` | `ptla_` key; at least one API key is required                   |
| `PTERODACTYL_CLIENT_KEY`      | `ptlc_` key; needed for console, files and server control       |
| `PTERODACTYL_LABEL`           | Safe display label; defaults to `panel`                         |
| `PTERODACTYL_ALLOW_WRITES`    | Exact `true` or `false`; defaults to `false`                    |
| `PTERODACTYL_WINGS_ORIGINS`   | JSON array of allowed HTTPS Wings origins; defaults to `[]`     |

Never place real keys in checked-in MCP configuration. An Application key does
not substitute for a Client key. Provider permissions still apply. Console and
binary transfer require explicit Wings origins; ordinary panel API reads do not.

The process speaks STDIO MCP. Its stdout contains only protocol messages.
A private outbound MCP tunnel can launch it without exposing a public HTTP
listener. Installing source locally does not connect ChatGPT cloud.

## Tools

| Tool                      | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `ptero_operations`        | Discover operation IDs and availability without contacting the panel |
| `ptero_operation_details` | Inspect parameters, input schema and constraints                     |
| `ptero_read`              | Execute a validated GET operation                                    |
| `ptero_write`             | Execute an enabled POST, PUT or PATCH operation                      |
| `ptero_delete`            | Execute an enabled DELETE operation                                  |
| `ptero_file_upload`       | Upload an attached ChatGPT artifact and verify destination bytes     |
| `ptero_file_hash`         | Hash a server file internally without exposing a signed URL          |
| `ptero_console_tail`      | Capture a finite authenticated console tail                          |

Discover IDs, inspect details, then pass the operation's `path`, `query` and
`body` under `input`. Numeric Application server IDs differ from Client server
identifiers. For example, `ptero_read` accepts:

```json
{
  "operationId": "application.servers.list",
  "input": { "query": { "page": 2, "per_page": 25, "include": "node" } }
}
```

Pagination metadata is preserved. Fetch further pages explicitly. JSON key order
has no significance; text file writes preserve raw UTF-8 contents.

Upload accepts `server`, `directory`, `name`, `file.download_url` and an optional
expected `sha256`. The native file parameter is declared through
`openai/fileParams`; actual host delivery remains an acceptance requirement.
Artifact downloads accept HTTPS subdomains of `oaiusercontent.com`. Both upload
and verification use provider-issued links to configured Wings origins, without
forwarding the panel key. Files are bounded to 64 MiB and uploads are serialized
within one server process. Upload verification reads back the exact destination
and compares SHA-256; a failure after submission reports unknown completion.

Console capture defaults to three seconds and 100 lines. It is capped at 30
seconds, 200 lines and 24 KiB. Tokens remain internal. Expiring or invalid
authentication closes capture; start a fresh call to obtain a new token.

## Failure and data handling

The HTTP client verifies TLS, refuses redirects, bounds panel responses to
2 MiB and uses a 15-second panel deadline. File transfers have a two-minute
overall deadline. Cancellation reaches provider requests; it cannot undo a
submitted mutation. The server never automatically replays uncertain writes.
Inspect provider state before retrying `completion_unknown`.

Tool results are capped at 64 KiB. Reduce pagination or includes when a result
is too large. Known password/token/secret fields and environment values are
omitted from structured responses. This is not general secret detection:
arbitrary filenames, console text and file contents can contain sensitive data.
Use private connections and grant the provider credentials only the intended
permissions. Mutation annotations help the host request approval; they do not
replace its approval policy or provider authorization.

## Verify and contribute

`npm run check` runs formatting, lint, strict types, independent route drift,
generated coverage-matrix drift and tests with coverage thresholds. CI runs on
Linux and Windows and consumes BASIC's pinned shared quality checker.
`npm run smoke:package` installs the packed artifact with production dependencies
in a clean directory and performs a real STDIO handshake and discovery.

Tests contain synthetic data. Every executable catalogue operation has an
independent SDK-to-HTTP request contract. The pinned provider routes and their
license are under `spec/`; use `npm run generate:routes` and
`npm run generate:coverage` when updating them. Live tests require separately
approved disposable targets. Keep credentials and deployment automation out
of public CI.

See [the design](docs/design.md) for boundaries and prior art. This project
has independent source and releases; it is not a fork of a community MCP.
