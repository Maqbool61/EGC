# Security Policy

## Supported Versions

| Version | Supported |
| :--- | :--- |
| 0.9.x | Yes |

## Reporting a Vulnerability

Do not open public GitHub issues for security vulnerabilities.

Use GitHub's private vulnerability reporting:
https://github.com/Fmarzochi/everything-gemini/security/advisories/new

Alternatively, email [fmarzochi@gmail.com](mailto:fmarzochi@gmail.com).

Include in your report:
- A description of the vulnerability
- Steps to reproduce
- Affected version(s)
- Potential impact

## Response Timeline

- Acknowledgment: within 72 hours
- Status update: within 14 days
- Resolution or mitigation: within 90 days of confirmed vulnerability

## Scope

This policy covers the `everything-gemini` repository, including:

- Core runtime scripts (`scripts/`)
- MCP server sources (`src/`)
- Installation scripts (`install.sh`, `install.ps1`)
- Hook and skill definitions (`hooks/`, `skills/`)

## Out of Scope

The following are not treated as vulnerabilities under this policy:

- Vulnerabilities in third-party dependencies (report upstream)
- Issues requiring physical access to the host machine
- Denial-of-service against a local-only runtime with no network exposure
- Behaviors that require the reporter to already have write access to the host
