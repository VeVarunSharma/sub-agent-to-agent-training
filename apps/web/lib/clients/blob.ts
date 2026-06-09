import { DefaultAzureCredential } from "@azure/identity"
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob"

let uploadsContainer: ContainerClient | null | undefined

export function getUploadsContainerClient() {
  if (uploadsContainer !== undefined) return uploadsContainer

  const accountName = readEnv("SRS_STORAGE_ACCOUNT") ?? readEnv("SRS_STORAGE_ACCOUNT_NAME")
  const containerName = readEnv("SRS_STORAGE_UPLOADS_CONTAINER_NAME") ?? "uploads"

  if (!accountName) {
    uploadsContainer = null
    return uploadsContainer
  }

  const serviceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, new DefaultAzureCredential())
  uploadsContainer = serviceClient.getContainerClient(containerName)
  return uploadsContainer
}

function readEnv(name: string) {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : null
}
