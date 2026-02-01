import * as documentdb from "@pulumi/azure-native/documentdb";
import * as pulumi from "@pulumi/pulumi";
import { spec } from "../stack";
import { cosmosAccountConfig, cosmosContainerConfig, cosmosDatabaseConfig } from "./configs";

const ragStack = new pulumi.StackReference(spec.ragInfraStack);
const resourceGroupName = ragStack.getOutput("resourceGroupName") as pulumi.Output<string>;

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
