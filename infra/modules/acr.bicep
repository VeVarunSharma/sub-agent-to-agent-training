targetScope = 'resourceGroup'

@description('Name of the azd environment. Used in resource names and tags.')
param environmentName string

@description('Azure region for the container registry.')
param location string

@description('Tags applied to resources that support tagging.')
param tags object

var suffix = uniqueString(resourceGroup().id)
var safeEnvironmentName = take(toLower(replace(replace(environmentName, '-', ''), '_', '')), 24)
var registryName = take('acrsrs${safeEnvironmentName}${suffix}', 50)

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
      retentionPolicy: {
        days: 7
        status: 'disabled'
      }
      trustPolicy: {
        type: 'Notary'
        status: 'disabled'
      }
    }
  }
}

output id string = registry.id
output name string = registry.name
output loginServer string = registry.properties.loginServer
