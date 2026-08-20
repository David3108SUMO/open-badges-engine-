# Open Badges Engine

This repository hosts a GitHub Pages-based certificate verification flow and an automated badge/certificate generation workflow.

## What it does

- Receives a `repository_dispatch` event of type `issue-badge`
- Generates a signed verifiable credential JSON in `data/`
- Renders a PDF certificate in `certs/`
- Publishes verification data through GitHub Pages (`index.html`)

## Repository structure

- `index.html` – certificate verification page
- `scripts/generate.js` – certificate + credential generation script
- `templates/badge.svg` – badge graphic embedded into certificates
- `.github/workflows/issue-badge.yml` – automation workflow

## Required secret

Set this repository secret before using the workflow:

- `ISSUER_PRIVATE_KEY` – PEM private key used to sign credential data

## Trigger payload

The workflow expects a `repository_dispatch` payload (`client_payload`) containing at least:

- `credentialId`
- `recipientName`
- `courseName`
- `completionDate` (optional)
