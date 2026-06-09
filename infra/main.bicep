targetScope = 'subscription'

@description('Name of the azd environment. Used in resource names and tags.')
param environmentName string

@description('Azure region for the resource group and regional resources.')
param location string

@description('Optional object id for the operator who should receive data-plane roles. Leave empty to skip human role assignments.')
param principalId string = ''

@description('Capacity for the Azure OpenAI judge model deployment.')
param judgeModelCapacity int = 10

var tags = {
  'azd-env-name': environmentName
  app: 'srs'
  managedby: 'bicep'
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-srs-${environmentName}'
  location: location
  tags: tags
}

module app './main.rg.bicep' = {
  name: 'srs-stack-${environmentName}'
  scope: rg
  params: {
    environmentName: environmentName
    location: location
    principalId: principalId
    judgeModelCapacity: judgeModelCapacity
  }
}

output resourceGroupName string = rg.name
output AZURE_CONTAINER_APP_NAME string = app.outputs.containerAppName
output AZURE_CONTAINER_APP_URL string = app.outputs.containerAppUrl
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = app.outputs.containerRegistryLoginServer
output SRS_MANAGED_IDENTITY_CLIENT_ID string = app.outputs.managedIdentityClientId
output SRS_COSMOS_ENDPOINT string = app.outputs.cosmosEndpoint
output SRS_COSMOS_DATABASE_NAME string = app.outputs.cosmosDatabaseName
output SRS_STORAGE_ACCOUNT_NAME string = app.outputs.storageAccountName
output SRS_STORAGE_UPLOADS_CONTAINER_NAME string = app.outputs.uploadsContainerName
output SRS_FOUNDRY_ENDPOINT string = app.outputs.foundryEndpoint
output SRS_FOUNDRY_RESOURCE_GROUP string = rg.name
output SRS_FOUNDRY_PROJECT_NAME string = app.outputs.foundryProjectName
output SRS_JUDGE_DEPLOYMENT_NAME string = app.outputs.judgeDeploymentName
output APPLICATIONINSIGHTS_CONNECTION_STRING string = app.outputs.applicationInsightsConnectionString
