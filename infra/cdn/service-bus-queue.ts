import * as servicebus from "@pulumi/azure-native/servicebus";
import { spec } from "../stack";
import { serviceBusQueueConfig } from "./configs";
import { ragResourceGroupName, serviceBusNamespaceName } from "./rag-stack";

const resourceGroupName = ragResourceGroupName;
const namespaceName = serviceBusNamespaceName;

const queueConfig = serviceBusQueueConfig(spec);
export const serviceBusQueue = new servicebus.Queue("cdn-queue", {
  ...queueConfig,
  namespaceName,
  resourceGroupName,
});
