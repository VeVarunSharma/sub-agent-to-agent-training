targetScope = 'resourceGroup'

@description('Name of the azd environment. Used in resource names and tags.')
param environmentName string

@description('Azure region for Cosmos DB.')
param location string

@description('Tags applied to resources that support tagging.')
param tags object

@description('Name of the SQL database for permit pre-review runs and reports.')
param databaseName string = 'srs'

@description('Name of the container that stores run state.')
param runsContainerName string = 'runs'

@description('Name of the container that stores eval and review reports.')
param reportsContainerName string = 'reports'

var suffix = take(uniqueString(resourceGroup().id), 6)
var safeEnvironmentName = take(toLower(replace(environmentName, '_', '-')), 20)
var accountName = 'cosmos-srs-${safeEnvironmentName}-${suffix}'

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 8
      }
    }
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: account
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

resource runsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: runsContainerName
  properties: {
    resource: {
      id: runsContainerName
      partitionKey: {
        paths: [
          '/runId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

resource reportsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: reportsContainerName
  properties: {
    resource: {
      id: reportsContainerName
      partitionKey: {
        paths: [
          '/runId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

output id string = account.id
output name string = account.name
output accountName string = account.name
output endpoint string = account.properties.documentEndpoint
output databaseName string = database.name
output runsContainerName string = runsContainer.name
output reportsContainerName string = reportsContainer.name
