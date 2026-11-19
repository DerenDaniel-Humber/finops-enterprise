# FinOps Enterprise — Assignment 3

Northbridge Commercial Bank’s financial operations platform with MongoDB persistence, deterministic transaction risk scoring, approval workflows, and approval-gated atomic transfers.

## What is included

- Corporate client and financial account directories with create and update API support.
- Transfer initiation with idempotency keys; integer minor-unit money values (for example, CAD 12.50 is `1250`).
- A versioned MongoDB risk policy, eight seeded default rules, configurable thresholds, and immutable assessment snapshots.
- Low, Medium, High, and Critical classifications. Medium has one reviewer stage; High and Critical have two sequential stages.
- Server-validated reviewer decisions, rejection reasons, separation of duties, idempotency keys, escalation records, and MongoDB transaction boundaries.
- Processing checks that keep balances unchanged while review is pending or rejected, then debit and credit accounts atomically after approval.
- React dashboards, searchable directories, policy screens, approval queue, assessment and workflow details, and transaction processing controls.
- MongoDB 7 replica set, migration and demo-data initialization containers, Express API, and a production React build served by NGINX.
- Postman collection and automated unit tests.

## Run with Docker Compose

Requirements: Docker Desktop (or Docker Engine) with the Compose plugin.

From this directory:

```bash
docker compose up --build
```

Open <http://localhost:8080>. Compose starts MongoDB, initializes its single-node replica set, applies the repeatable Assignment 3 migration, seeds demo records, starts the Express API, and serves the React application through NGINX. The MongoDB data volume is named `finops-enterprise_mongo_data` by default and survives container restarts.

To stop the containers while preserving data:

```bash
docker compose down
```

To reset the local demonstration database and re-seed it from scratch:

```bash
docker compose down -v
docker compose up --build
```

The reset command deletes the local MongoDB volume. It is only for the developer’s disposable demonstration data.

## Demo records and workflow actors

The startup seed is idempotent and creates five fictional clients, six accounts, four example transactions, and four simulated reviewers. The sample transaction scenarios are designed to show every risk category:

| Reference | Expected risk | Approval route |
| --- | --- | --- |
| `LOW-DEMO` | Low | None |
| `MEDIUM-DEMO` | Medium | Olivia Chen, Operations Reviewer |
| `HIGH-DEMO` | High | Operations Reviewer → Senior Reviewer |
| `CRITICAL-DEMO` | Critical | Senior Reviewer → Compliance Reviewer |

Use the reviewer selector in the top-right of the application to select a seeded identity. The API resolves the role from its server-side actor registry; it ignores client-supplied role claims. These identities are a demonstration only and are not real authentication. Assignment 4 is expected to replace actor selection with authenticated identity claims.

To demonstrate a pending-transfer block, open a Medium, High, or Critical transaction and choose **Process transaction** before approval. The API returns `409 APPROVAL_REQUIRED` and does not update either balance. Complete the required workflow, return to the transaction, and process it.

## Migration and persistence

The Compose `migrate` service creates the Assignment 3 indexes, seeds a default CAD and USD policy when none is active, creates the approval routing policy, and writes the `003-risk-approval-controls` marker in `schema_migrations`. It does not delete or replace clients, accounts, or transaction history. The subsequent seed service uses upserts and transaction idempotency keys, so container recreation does not add duplicate demo data.

To run the migration manually inside Docker after the application is up:

```bash
docker compose run --rm migrate
```

Useful endpoints:

- `GET /api/v1/health`
- `GET /api/v1/dashboard`
- `GET /api/v1/risk/dashboard`
- `GET /api/v1/approvals/dashboard`
- `GET /api/v1/approvals/queue`
- `GET /api/v1/risk-policies`
- `GET /api/v1/risk-assessments`
- `GET /api/v1/approval-workflows`

The API is available through NGINX at `http://localhost:8080/api/v1`. Error responses use the `{ "error": { "code", "message", "details" } }` envelope.

## Local development

Copy `.env.example` to `.env` and point `MONGO_URI` at a MongoDB replica set. From the root directory:

```bash
npm install
npm run dev
```

The web app uses Vite on port 5173 and proxies `/api` to `http://localhost:4000`. Initialize the local database in this order:

```bash
npm run migrate -w server
npm run seed -w server
```

To run the production frontend build:

```bash
npm run build -w web
```

## Tests

The risk classification, default rule configuration, currency minor-unit thresholds, and approval role routes have automated Node.js unit tests. Run those with:

```bash
npm test -w server
```

The workflow integration suite uses a separate MongoDB database named `finops_test` and refuses to connect unless the URI path contains `test`. Run it inside the Compose network with:

```bash
docker compose --profile test run --rm test
```

It covers all four risk classes, approval role validation, sequential stages, decision idempotency, approved processing, rejection, and escalation. It drops and recreates only the isolated `finops_test` database. Never point it at the demonstration or production database.

## API examples

Initiate a transfer (the amount is in minor units):

```http
POST /api/v1/transactions
Idempotency-Key: transaction-demo-1001
Content-Type: application/json

{
  "sourceAccountId": "ACC-2001",
  "destinationAccountId": "ACC-2002",
  "amountMinor": 1500000,
  "currency": "CAD",
  "reference": "Quarterly supplier payment"
}
```

Submit an approval decision. The API looks up the reviewer’s role from `workflow_actors`:

```http
POST /api/v1/approval-workflows/{workflowId}/decisions
Idempotency-Key: approval-demo-1001
Content-Type: application/json

{
  "actorId": "ACTOR-OPERATIONS-001",
  "decision": "Approved",
  "comments": "Reviewed against the client mandate."
}
```

The Postman collection at `postman/FinOps-Assignment-3.postman_collection.json` contains the directory, dashboard, risk, transfer, approval, and escalation requests.

## Submission notes

The supplied Assignment 3 specification names the private `finops-enterprise` GitHub repository as the submission and says a ZIP is not required. It lists the source, configuration, migration, tests, Postman collection, README, and screenshots of demonstrated workflows. The supplied specification does **not** request a separate PDF. Before submitting, push this project to the instructor-accessible private repository and add genuine screenshots captured from the running application to `docs/screenshots/`.

Do not commit `.env`, credentials, `node_modules`, or generated dependencies. Use `.env.example` as the configuration template.
