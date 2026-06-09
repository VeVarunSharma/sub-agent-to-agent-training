targetScope = 'resourceGroup'

@description('Name of the azd environment. Used in resource names and tags.')
param environmentName string

@description('Azure region for the Container Apps environment and web app.')
param location string

@description('Tags applied to resources that support tagging.')
param tags object

@description('Container image used for the first provisioning pass. azd deploy replaces it after build and push.')
param containerImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Login server for the Azure Container Registry that stores the web image.')
param acrLoginServer string

@description('Resource id of the user-assigned managed identity for the web app.')
param managedIdentityResourceId string

@description('Client id of the user-assigned managed identity for Azure SDK authentication.')
param managedIdentityClientId string

@description('Name of the Log Analytics workspace used by the Container Apps environment.')
param logAnalyticsWorkspaceName string

@description('Application Insights connection string for web telemetry.')
param appInsightsConnectionString string

@description('Cosmos DB endpoint for run and report persistence.')
param cosmosEndpoint string

@description('Cosmos DB SQL database name.')
param cosmosDatabaseName string

@description('Cosmos DB container name for run state.')
param runsContainerName string

@description('Cosmos DB container name for reports.')
param reportsContainerName string

@description('Storage account name for applicant upload packets.')
param storageAccountName string

@description('Blob container name for applicant upload packets.')
param uploadsContainerName string

@description('Foundry or AI Services endpoint used by the review pipeline.')
param foundryEndpoint string

@description('Foundry project name. Uses a stand-in value until the public Foundry project module lands.')
param foundryProjectName string

@description('Azure OpenAI deployment name for the judge model.')
param judgeDeploymentName string

var suffix = take(uniqueString(resourceGroup().id), 6)
var safeEnvironmentName = take(toLower(replace(environmentName, '_', '-')), 10)
var environmentNameToken = 'cae-srs-${safeEnvironmentName}-${suffix}'
var containerAppName = 'ca-srs-web-${safeEnvironmentName}-${suffix}'
var serviceTags = union(tags, {
  'azd-service-name': 'web'
})

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentNameToken
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: serviceTags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityResourceId}': {}
    }
  }
  properties: {
    environmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: acrLoginServer
          identity: managedIdentityResourceId
        }
      ]
    }
    template: {
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
      containers: [
        {
          name: 'web'
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'liveness'
              httpGet: {
                path: '/'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 30
              failureThreshold: 3
            }
          ]
          env: [
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: managedIdentityClientId
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsightsConnectionString
            }
            {
              name: 'SRS_COSMOS_ENDPOINT'
              value: cosmosEndpoint
            }
            {
              name: 'SRS_COSMOS_DATABASE_NAME'
              value: cosmosDatabaseName
            }
            {
              name: 'SRS_COSMOS_RUNS_CONTAINER_NAME'
              value: runsContainerName
            }
            {
              name: 'SRS_COSMOS_REPORTS_CONTAINER_NAME'
              value: reportsContainerName
            }
            {
              name: 'SRS_STORAGE_ACCOUNT_NAME'
              value: storageAccountName
            }
            {
              name: 'SRS_STORAGE_UPLOADS_CONTAINER_NAME'
              value: uploadsContainerName
            }
            {
              name: 'SRS_FOUNDRY_ENDPOINT'
              value: foundryEndpoint
            }
            {
              name: 'SRS_FOUNDRY_RESOURCE_GROUP'
              value: resourceGroup().name
            }
            {
              name: 'SRS_FOUNDRY_PROJECT_NAME'
              value: foundryProjectName
            }
            {
              name: 'SRS_JUDGE_DEPLOYMENT_NAME'
              value: judgeDeploymentName
            }
          ]
        }
      ]
    }
  }
}

output containerAppsEnvironmentName string = containerAppsEnvironment.name
output containerAppName string = containerApp.name
output containerAppId string = containerApp.id
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
