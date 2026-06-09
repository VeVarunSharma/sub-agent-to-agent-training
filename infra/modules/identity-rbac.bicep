targetScope = 'resourceGroup'

@description('Name of the azd environment. Used in resource names and tags.')
param environmentName string

@description('Azure region for the user-assigned managed identity.')
param location string

@description('Tags applied to resources that support tagging.')
param tags object

@description('Optional object id for the operator who should receive data-plane roles. Leave empty to skip human role assignments.')
param operatorPrincipalId string = ''

@description('Name of the Azure Container Registry that will store the web image.')
param acrName string

@description('Name of the AI Services account used as the Foundry stand-in.')
param aiServicesAccountName string

@description('Name of the Cosmos DB account.')
param cosmosAccountName string

@description('Name of the Storage account that contains uploads.')
param storageAccountName string

@description('Name of the Blob container that stores applicant uploads.')
param uploadsContainerName string

var suffix = uniqueString(resourceGroup().id)
var identityName = 'id-srs-${environmentName}-${suffix}'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var aiServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var cosmosDataContributorRoleDefinitionId = '00000000-0000-0000-0000-000000000002'
var assignOperator = !empty(operatorPrincipalId)

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource aiServicesAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: aiServicesAccountName
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: storageAccount
  name: 'default'
}

resource uploadsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' existing = {
  parent: blobService
  name: uploadsContainerName
}

resource acrPullForApp 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identity.properties.principalId, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource aiServicesUserForApp 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiServicesAccount.id, identity.properties.principalId, aiServicesUserRoleId)
  scope: aiServicesAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', aiServicesUserRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageBlobContributorForApp 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(uploadsContainer.id, identity.properties.principalId, storageBlobDataContributorRoleId)
  scope: uploadsContainer
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource cosmosDataContributorForApp 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, identity.properties.principalId, cosmosDataContributorRoleDefinitionId)
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosDataContributorRoleDefinitionId}'
    principalId: identity.properties.principalId
    scope: cosmosAccount.id
  }
}

resource aiServicesUserForOperator 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (assignOperator) {
  name: guid(aiServicesAccount.id, operatorPrincipalId, aiServicesUserRoleId)
  scope: aiServicesAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', aiServicesUserRoleId)
    principalId: operatorPrincipalId
    principalType: 'User'
  }
}

resource storageBlobContributorForOperator 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (assignOperator) {
  name: guid(uploadsContainer.id, operatorPrincipalId, storageBlobDataContributorRoleId)
  scope: uploadsContainer
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: operatorPrincipalId
    principalType: 'User'
  }
}

resource cosmosDataContributorForOperator 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = if (assignOperator) {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, operatorPrincipalId, cosmosDataContributorRoleDefinitionId)
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosDataContributorRoleDefinitionId}'
    principalId: operatorPrincipalId
    scope: cosmosAccount.id
  }
}

output id string = identity.id
output name string = identity.name
output resourceId string = identity.id
output clientId string = identity.properties.clientId
output principalId string = identity.properties.principalId
