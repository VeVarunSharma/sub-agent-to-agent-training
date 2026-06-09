targetScope = 'resourceGroup'

@description('Name of the azd environment. Used in resource names and tags.')
param environmentName string

@description('Azure region for regional resources in this resource group.')
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
var foundryLocation = 'eastus2'

module observability './modules/observability.bicep' = {
  name: 'observability-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
  }
}

module acr './modules/acr.bicep' = {
  name: 'acr-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
  }
}

module cosmos './modules/cosmos.bicep' = {
  name: 'cosmos-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
  }
}

module storage './modules/storage.bicep' = {
  name: 'storage-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
  }
}

module foundry './modules/foundry.bicep' = {
  name: 'foundry-${environmentName}'
  params: {
    environmentName: environmentName
    location: foundryLocation
    tags: tags
    judgeModelCapacity: judgeModelCapacity
  }
}

module identity './modules/identity-rbac.bicep' = {
  name: 'identity-rbac-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    operatorPrincipalId: principalId
    acrName: acr.outputs.name
    aiServicesAccountName: foundry.outputs.accountName
    cosmosAccountName: cosmos.outputs.accountName
    storageAccountName: storage.outputs.accountName
    uploadsContainerName: storage.outputs.uploadsContainerName
  }
}

module aca './modules/aca.bicep' = {
  name: 'aca-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    acrLoginServer: acr.outputs.loginServer
    appInsightsConnectionString: observability.outputs.applicationInsightsConnectionString
    containerImage: 'mcr.microsoft.com/k8se/quickstart:latest'
    cosmosDatabaseName: cosmos.outputs.databaseName
    cosmosEndpoint: cosmos.outputs.endpoint
    reportsContainerName: cosmos.outputs.reportsContainerName
    runsContainerName: cosmos.outputs.runsContainerName
    foundryEndpoint: foundry.outputs.endpoint
    foundryProjectName: foundry.outputs.projectName
    judgeDeploymentName: foundry.outputs.judgeDeploymentName
    logAnalyticsWorkspaceName: observability.outputs.logAnalyticsWorkspaceName
    managedIdentityClientId: identity.outputs.clientId
    managedIdentityResourceId: identity.outputs.resourceId
    storageAccountName: storage.outputs.accountName
    uploadsContainerName: storage.outputs.uploadsContainerName
  }
}

output containerAppName string = aca.outputs.containerAppName
output containerAppUrl string = aca.outputs.containerAppUrl
output containerRegistryLoginServer string = acr.outputs.loginServer
output managedIdentityClientId string = identity.outputs.clientId
output managedIdentityPrincipalId string = identity.outputs.principalId
output cosmosEndpoint string = cosmos.outputs.endpoint
output cosmosDatabaseName string = cosmos.outputs.databaseName
output storageAccountName string = storage.outputs.accountName
output uploadsContainerName string = storage.outputs.uploadsContainerName
output foundryEndpoint string = foundry.outputs.endpoint
output foundryProjectName string = foundry.outputs.projectName
output judgeDeploymentName string = foundry.outputs.judgeDeploymentName
output applicationInsightsConnectionString string = observability.outputs.applicationInsightsConnectionString
