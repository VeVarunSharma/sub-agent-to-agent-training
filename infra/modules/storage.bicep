targetScope = 'resourceGroup'

@description('Name of the azd environment. Used in resource names and tags.')
param environmentName string

@description('Azure region for the storage account.')
param location string

@description('Tags applied to resources that support tagging.')
param tags object

@description('Blob container for applicant-uploaded permit packets.')
param uploadsContainerName string = 'uploads'

var suffix = uniqueString(resourceGroup().id)
var safeEnvironmentName = take(toLower(replace(replace(environmentName, '-', ''), '_', '')), 6)
var accountName = take('stsrs${safeEnvironmentName}${suffix}', 24)

resource account 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: accountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: account
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource uploadsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: uploadsContainerName
  properties: {
    publicAccess: 'None'
  }
}

output id string = account.id
output name string = account.name
output accountName string = account.name
output blobEndpoint string = account.properties.primaryEndpoints.blob
output uploadsContainerName string = uploadsContainer.name
output uploadsContainerResourceId string = uploadsContainer.id
