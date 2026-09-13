# Security policy

## Supported versions

The latest published minor receives fixes. Older majors are not maintained.

| Version | Supported |
|---|---|
| 5.x | yes |
| 4.x and below | no |

## Reporting a vulnerability

Open a private report through GitHub: go to https://github.com/rynaqrtz/sengkrep/security/advisories/new and describe the issue. If you cannot use that form, open a normal issue that asks for a private channel and leave out the details until one is set up.

Please include:

- the version you tested,
- a minimal reproduction, ideally a script that runs against a local server,
- what you expected instead,
- your assessment of impact.

Do not open a public issue with a working exploit. Do not test against systems you do not own or have permission to test.

## Response

Expect an initial reply within a few days. Once a fix is ready it ships as a patch release with a note in `CHANGELOG.md` and, when it warrants one, a GitHub security advisory.

## Scope

In scope:

- `SecurityGuard` domain, port and private address checks, including redirect hops,
- header handling across redirects and proxies,
- request smuggling, header injection and CRLF issues,
- denial of service in parsers, decoders, the WebSocket client or the capture proxy,
- anything that lets a remote page or server reach resources it should not.

Out of scope:

- detection, bypass or fingerprint evasion requests. This library does not promise to defeat anti-bot systems, and issues framed that way are closed.
- the legal use of the tool. `robots.txt`, terms of service and data protection law are the operator's responsibility.

## Design note

The library ships controls that are off by default: `robots.txt` checks, `Retry-After` handling, `X-Robots-Tag`, audit logs and field masking. `security` guard options are also opt-in. A report that something is "not blocked" while the relevant option is disabled is a configuration question, not a vulnerability.
