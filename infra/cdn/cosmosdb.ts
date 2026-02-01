import * as documentdb from "@pulumi/azure-native/documentdb";
import { spec } from "../stack";
import { cosmosAccountConfig, cosmosContainerConfig, cosmosDatabaseConfig } from "./configs";
import { cdnResourceGroup } from "./resource-group";

const resourceGroupName = cdnResourceGroup.name;

export const cosmosAccount = new documentdb.DatabaseAccount("cosmos", {
  ...cosmosAccountConfig(spec),
  resourceGroupName,
});

const dbConfig = cosmosDatabaseConfig(spec);
export const cosmosDatabase = new documentdb.SqlResourceSqlDatabase("cosmos-db", {
  accountName: cosmosAccount.name,
  resourceGroupName,
  databaseName: dbConfig.databaseName,
  resource: {
    id: dbConfig.databaseName,
  },
});

const containerConfig = cosmosContainerConfig(spec);
export const cosmosContainer = new documentdb.SqlResourceSqlContainer("cosmos-container", {
  accountName: cosmosAccount.name,
  resourceGroupName,
  databaseName: cosmosDatabase.name,
  containerName: containerConfig.containerName,
  resource: {
    id: containerConfig.containerName,
    partitionKey: containerConfig.partitionKey,
    defaultTtl: containerConfig.defaultTtl,
  },
});
