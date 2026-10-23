# Pterodactyl MCP

A standalone, self-hosted MCP server for Pterodactyl Application and Client APIs.

Implementation is in progress. Provider access, native cloud file transfer and
production deployment are not yet verified. Each process will use one configured
panel. Operator deployment configuration and credentials belong outside this
repository.

The design uses an inspectable operation catalogue, maintained MCP SDK transports
and independent provider contract tests. See `docs/design.md` and the implementation
plan under `docs/superpowers/plans`.
