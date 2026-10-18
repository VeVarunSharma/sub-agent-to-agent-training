# Infra

Inspect the SRS tutorial stack authored in Bicep and Azure Developer CLI. Treat cloud provisioning and deployment as unverified. Start with the credential-free [local demo](../README.md#run-the-local-demo).

Keep all content synthetic. The app has no user authentication. Current Bicep enables external ingress, so require access controls and security review before exposing a deployment. Managed identity does not authenticate planner users.

## Build the local container

Run from the repository root. Use the root as the build context so workspace packages and local fixtures are available.

```bash
docker build -f apps/web/Dockerfile -t srs-demo .
docker run --rm --name srs-demo -p 127.0.0.1:3000:3000 srs-demo
```

Open <http://localhost:3000>. Leave Azure settings unset for the fixture path. Stop the foreground container with Ctrl+C. Treat local container verification as separate from `azd` and cloud verification.

## Prerequisites

Install these tools before you run `azd up`.

- Azure Developer CLI, `azd`
- Azure CLI, `az`
- Bicep CLI for local syntax checks
- Docker
- Node 22 or newer
- pnpm 10 or newer

Authenticate first.

```bash
az login
azd auth login
```

## Initialize an azd environment

Run this from the repo root.

```bash
azd init
```

Select the existing code in this directory. Keep the generated environment name short. Resource names include the environment token.

Set the subscription and location.

```bash
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
azd env set AZURE_LOCATION eastus2
```

Set a human principal only when the operator needs data-plane access.

```bash
az ad signed-in-user show --query id -o tsv
```

Copy that object id into `infra/main.parameters.json` under `principalId`. Leave it empty to skip human role assignments.

## Provision

Use these commands only for an operator-led cloud validation. No successful `azd up` or end-to-end Azure execution is asserted here. Confirm quotas, billing, permissions, and cleanup ownership first.

```bash
azd up
```

The first Container Apps revision uses `mcr.microsoft.com/k8se/quickstart:latest`. That lets provision complete before a web image exists in the registry. `azd deploy` replaces it with the built web image.

Use `apps/web/Dockerfile` with the repository root as its build context. The root `azure.yaml` declares `apps/web` as the service project. Validate or configure azd's Docker context before relying on `azd deploy`. A successful local Docker build does not prove azd packaging works.

## Expected resources

`infra/main.bicep` creates the resource group. `infra/main.rg.bicep` deploys these resources inside it.

- Azure Container Registry, Basic SKU
- Log Analytics workspace
- Application Insights component
- Azure Container Apps environment
- Azure Container Apps app for `apps/web`
- Cosmos DB for NoSQL account
- Cosmos DB database named `srs`
- Cosmos DB containers named `runs` and `reports`
- Storage account
- Blob container named `uploads`
- User-assigned managed identity
- AI Services account as the Foundry stand-in
- Azure OpenAI deployment named `srs-judge-gpt-4-1-20250414`

## Foundry stand-in

Use the AI Services account until a public Foundry project Bicep module is available. The module keeps a TODO in `modules/foundry.bicep`. Replace it with a project resource when the module lands.

The judge deployment uses these defaults.

| Setting | Value |
| --- | --- |
| Region | `eastus2` |
| Deployment name | `srs-judge-gpt-4-1-20250414` |
| Model | `gpt-4.1` |
| Snapshot | `2025-04-14` |
| Capacity | `10` |

Change `judgeModelCapacity` in `infra/main.parameters.json` when you need a different capacity.

## Role assignments

| Principal | Scope | Role |
| --- | --- | --- |
| Web user-assigned managed identity | Azure Container Registry | AcrPull |
| Web user-assigned managed identity | Cosmos DB account | Cosmos DB Built-in Data Contributor |
| Web user-assigned managed identity | `uploads` blob container | Storage Blob Data Contributor |
| Web user-assigned managed identity | AI Services account | Cognitive Services User |
| Operator principal, when set | Cosmos DB account | Cosmos DB Built-in Data Contributor |
| Operator principal, when set | `uploads` blob container | Storage Blob Data Contributor |
| Operator principal, when set | AI Services account | Cognitive Services User |

No Key Vault is provisioned in this slice, so no Key Vault Secrets User assignment is created.

## Web app environment contract

Bicep wires these variables into the Container App.

| Variable | Source | Purpose |
| --- | --- | --- |
| `PORT` | `aca.bicep` | Binds Next.js to port 3000. |
| `NODE_ENV` | `aca.bicep` | Runs production mode. |
| `AZURE_CLIENT_ID` | Managed identity output | Selects the user-assigned identity for Azure SDK auth. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights output | Sends web telemetry. |
| `SRS_COSMOS_ENDPOINT` | Cosmos output | Connects to Cosmos DB. |
| `SRS_COSMOS_DATABASE_NAME` | Cosmos output | Selects the `srs` database. |
| `SRS_COSMOS_RUNS_CONTAINER_NAME` | Cosmos output | Selects the `runs` container. |
| `SRS_COSMOS_REPORTS_CONTAINER_NAME` | Cosmos output | Selects the `reports` container. |
| `SRS_STORAGE_ACCOUNT_NAME` | Storage output | Connects to Blob Storage. |
| `SRS_STORAGE_UPLOADS_CONTAINER_NAME` | Storage output | Selects the `uploads` container. |
| `SRS_FOUNDRY_ENDPOINT` | AI Services output | Connects Foundry client code. |
| `SRS_FOUNDRY_RESOURCE_GROUP` | Resource group name | Helps `@srs/foundry` locate project resources. |
| `SRS_FOUNDRY_PROJECT_NAME` | Foundry stand-in output | Keeps the Foundry package contract stable. |
| `SRS_JUDGE_DEPLOYMENT_NAME` | AI Services deployment output | Selects the judge model deployment. |

`packages/foundry` currently reads `SRS_FOUNDRY_ENDPOINT`, `SRS_FOUNDRY_RESOURCE_GROUP`, and `SRS_FOUNDRY_PROJECT_NAME`. The web `/api/review` route always uses the deterministic mock pipeline. The separate `/api/decisions` path can invoke a hosted orchestrator when its endpoint and project are configured. Otherwise it streams fixture events.

The web Foundry client also accepts `SRS_FOUNDRY_PROJECT`, with optional `SRS_FOUNDRY_ORCHESTRATOR_AGENT_NAME` and `SRS_FOUNDRY_ORCHESTRATOR_URL`. Configured invocation failures can yield failed events. They do not silently switch to fixture orchestration.

Use `SRS_REQUIRE_AZURE=1` for strict Cosmos configuration and persistence checks. Do not interpret that setting as verification of every Azure client. See [architecture](../docs/architecture.md) for fallback boundaries.

## Verify before cloud use

- Validate azd packaging with the root Docker context.
- Verify provision, image deployment, resource outputs, managed identity, data-plane roles, and teardown.
- Replace the Foundry stand-in with a real project and deploy the hosted orchestrator.
- Verify run persistence, packet storage, report reads, streaming, and failure behavior end to end.
- Review authentication, external ingress, data retention, audit, monitoring, quotas, and costs.
- Resolve the [freeze, licensing, and ownership gates](../docs/README.md#check-readiness) before a customer pilot.

Do not publish credentials or tenant details in issues. Confirm a private security reporting channel and accountable owner before deployment.
