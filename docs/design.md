# Design

Use one panel and credential context per process. Keep operator addresses,
secrets, runtime units, account bindings and live acceptance records in private
infrastructure repositories.

An operation catalogue owns route identity, API family, validated parameters,
mutation classification and availability. It drives MCP discovery/details and
read/write/delete tools. Independent pinned provider-route evidence detects
unaccounted endpoints; declared exclusions remain visible. Common binary-file
and console workflows have focused tools.

Use the maintained MCP SDK for STDIO and real client transport tests. Keep
provider effects behind a bounded HTTP client with separate Application/Client
keys, verified TLS, redirect refusal, response limits and finite deadlines.
Writes are operator-enabled and never retried blindly after uncertain delivery.
Native host approval is a client interaction contract that needs acceptance,
not something a boolean argument proves.

Tests cover the actual MCP-client to controlled-provider path, package/CLI
startup and cancellation, hostile URL/path inputs, credential isolation and
ambiguous writes. Live tests are opt-in and use disposable operator-owned targets.
Binary upload acceptance includes destination SHA-256. Native cloud artifact
input must be verified separately from synthetic provider tests.

The verification baseline includes strict TypeScript, lint/format, unit and SDK
transport tests, coverage, source/catalogue drift and package smoke, plus the
existing shared quality-ratchet tool. No database, OAuth issuer, task queue,
website or general MCP framework is needed for the initial self-hosted runtime.

Prior art includes BASIC's VRChat MCP operation catalogue and STDIO harness,
Drasil's protocol/confirmation/outcome tests, Chronote's scoped authorization
tests, and destination/file guards from BASIC's Discord MCP fork. Adapted code
retains its original notice. New provider fixtures contain synthetic data only.

Community Pterodactyl MCPs informed the endpoint inventory and gap analysis.
This project has independent source, releases and verification.
