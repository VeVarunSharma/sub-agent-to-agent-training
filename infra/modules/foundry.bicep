targetScope = 'resourceGroup'

@description('Name of the azd environment. Used in resource names and tags.')
param environmentName string

@description('Azure region for the AI Services account and model deployment. Keep eastus2 for the judge model snapshot.')
param location string = 'eastus2'

@description('Tags applied to resources that support tagging.')
param tags object

@description('Capacity for the Azure OpenAI judge model deployment.')
param judgeModelCapacity int = 10

@description('Name of the judge model deployment.')
param judgeDeploymentName string = 'srs-judge-gpt-4-1-20250414'

@description('Azure OpenAI model name for the judge deployment.')
param judgeModelName string = 'gpt-4.1'

@description('Azure OpenAI model snapshot for the judge deployment.')
param judgeModelVersion string = '2025-04-14'

var suffix = take(uniqueString(resourceGroup().id), 6)
var safeEnvironmentName = take(toLower(replace(environmentName, '_', '-')), 32)
var accountName = 'oai-srs-${safeEnvironmentName}-${suffix}'
var projectName = 'srs-${environmentName}'

// TODO: replace with foundry-project module when public.
resource aiServicesAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

resource judgeDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: aiServicesAccount
  name: judgeDeploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: judgeModelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: judgeModelName
      version: judgeModelVersion
    }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

output id string = aiServicesAccount.id
output name string = aiServicesAccount.name
output accountName string = aiServicesAccount.name
output endpoint string = aiServicesAccount.properties.endpoint
output projectName string = projectName
output judgeDeploymentName string = judgeDeployment.name
output judgeModelName string = judgeModelName
output judgeModelVersion string = judgeModelVersion
