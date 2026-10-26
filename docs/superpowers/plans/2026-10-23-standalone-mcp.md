# Standalone Pterodactyl MCP implementation plan

> For agentic workers: use superpowers:executing-plans to implement each task.

Goal: reusable Application/Client tools and practical game-server workflows,
verified over real MCP transports, with a separately owned private deployment.

Architecture: one fixed panel per process; a typed operation catalogue owns
input validation and tool availability. The SDK owns MCP transports, the API
client owns provider requests, and file/console modules own bounded transfers.

Tech stack: Node 24.22.1+, TypeScript, MCP SDK 2.3.1, Zod, Vitest and the pinned
shared quality-ratchet tool.

Spec: `docs/design.md`.

## Constraints and review focus

- Public source and CI must contain only synthetic provider data and no private
  deployment bindings or credentials.
- A missing Client key must not substitute an Application key or break admin reads.
- Typed operation inputs must preserve supported provider parameters and reject
  unknown operations or attempts to change the configured origin.
- Timeouts after sending writes produce uncertain outcomes without automatic replay.
- Provider pagination, upload destination/hash and actual SDK transport behavior
  need independent assertions; counts or self-reported readiness are insufficient.

## Task 1: Test and package foundation

Files: package/config files, `test/helpers/`, CI workflow, package smoke script.

- [ ] Pin dependencies and install under an isolated supported Node runtime.
- [ ] Add unit tests, real SDK in-memory/STDIO test helpers and coverage reporting.
- [ ] Add lint, format, strict types, package checks and Linux/Windows CI.
- [ ] Verify the clean foundation and record baseline commands.

## Task 2: Provider client and configuration

Files: `src/config.ts`, `src/api/{client,errors,response}.ts`, `test/api/`.
Interface: validated `PanelConfig`; `PanelClient.execute(Operation, input)`.

- [ ] Write and run failing tests for key-kind separation, URL construction,
      redirect refusal, bounded bodies/errors, request deadlines and uncertain writes.
- [ ] Implement the minimum client/config to pass; test against a controlled
      HTTP server and preserve TLS verification outside an explicit loopback test fixture.
- [ ] Run the complete suite and strict types before committing this task.

## Task 3: Catalogue and working MCP inventory

Files: `src/operations/`, `src/mcp/`, `src/index.ts`, `test/{operations,mcp}/`.
Interface: immutable operation definitions; `createServer(config)`; CLI STDIO.

- [ ] Pin independent Pterodactyl route evidence and explicitly classify all routes.
- [ ] Write/run failing catalogue and SDK tests for discovery/details, wrong IDs,
      unknown operations, unavailable credentials and server/node/egg inventory calls.
- [ ] Implement catalogue-backed reads/writes/deletes with validated input and
      accurate hints; enforce operator write policy at execution, not registration only.
- [ ] Prove the built CLI speaks MCP over STDIO against the controlled provider.
- [ ] Expand standard Application and Client operations with per-family request
      contract tests; publish a coverage matrix with exclusions/pending entries.

## Task 4: Files, console and practical workflows

Files: `src/{files,console}/`, focused MCP tools, `test/{files,console}/`.

- [ ] Write/run failing tests for binary upload, destination path, streamed size
      limits, hash verification and explicit artifact/Wings destination policy.
- [ ] Implement generic upload and optional native-file input adaptation.
- [ ] Write/run failing console tests for auth, bounded tail, cancellation,
      token lifecycle, verified TLS and cleanup before implementing those paths.
- [ ] Exercise backup, startup and disposable-provisioning flows through actual
      SDK/provider fixtures, including failed/uncertain operation outcomes.

## Task 5: Shared quality and release readiness

Files: `quality-ratchet.json`, quality workflow, README/tool docs, package smoke.

- [ ] Consume qualified quality-ratchet v1.0.2 at
      `84fa993cf93b9dedd4da19ecbad75bc8712d0874`; keep tests/tools in scope.
- [ ] Run full checks, catalogue drift, coverage and installed-package STDIO smoke.
- [ ] Obtain fresh whole-branch review; fix material findings with failing
      regression tests first; verify every final completion claim from fresh results.
- [ ] Create/push the selected remote source repository only after visibility is
      confirmed and the initial tree is sanitized and reviewable.

## Task 6: Private deployment integration and live acceptance

Private owner: basic-infra. Public artifacts contain no operator identities.

- [ ] Prepare reviewed pinned runtime/install/rollback recipes and secret
      references, preserving other operator-host services.
- [ ] Establish actual panel versions, correct credentials and connection scopes.
- [ ] After rollout authorization, verify fresh cloud discovery and reads for
      both panel instances; report unavailable API/Wings separately.
- [ ] After exact disposable-target approval, verify upload/hash, power/console,
      backups and provisioning; then verify reconnection and alert delivery.

Production actions remain separately reviewed. An offline milestone does not
mark the private deployment or native file path accepted.
