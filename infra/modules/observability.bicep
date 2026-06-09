targetScope = 'resourceGroup'

@description('Name of the azd environment. Used in resource names and tags.')
param environmentName string

@description('Azure region for observability resources.')
param location string

@description('Tags applied to resources that support tagging.')
param tags object

var suffix = take(uniqueString(resourceGroup().id), 6)
var safeEnvironmentName = take(toLower(replace(environmentName, '_', '-')), 32)
var workspaceName = 'log-srs-${safeEnvironmentName}-${suffix}'
var appInsightsName = 'appi-srs-${safeEnvironmentName}-${suffix}'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    Flow_Type: 'Redfield'
    Request_Source: 'rest'
  }
}

output logAnalyticsWorkspaceName string = logAnalytics.name
output logAnalyticsWorkspaceId string = logAnalytics.id
output applicationInsightsName string = appInsights.name
output applicationInsightsConnectionString string = appInsights.properties.ConnectionString
output applicationInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
