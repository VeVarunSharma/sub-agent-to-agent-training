import { CosmosClient, type Container } from "@azure/cosmos"
import { DefaultAzureCredential } from "@azure/identity"

type CosmosContainers = {
  runs: Container
  reports: Container
}

let containers: CosmosContainers | null | undefined

export function getRunsContainer() {
  return getCosmosContainers()?.runs ?? null
}

export function getReportsContainer() {
  return getCosmosContainers()?.reports ?? null
}

function getCosmosContainers() {
  if (containers !== undefined) return containers

  const endpoint = readEnv("SRS_COSMOS_ENDPOINT")
  const databaseName = readEnv("SRS_COSMOS_DATABASE_NAME")
  const runsContainerName = readEnv("SRS_COSMOS_RUNS_CONTAINER_NAME") ?? "runs"
  const reportsContainerName = readEnv("SRS_COSMOS_REPORTS_CONTAINER_NAME") ?? "reports"

  if (!endpoint || !databaseName) {
    containers = null
    return containers
  }

  const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() })
  const database = client.database(databaseName)
  containers = {
    runs: database.container(runsContainerName),
    reports: database.container(reportsContainerName),
  }

  return containers
}

function readEnv(name: string) {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : null
}
