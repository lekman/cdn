import * as servicebus from "@pulumi/azure-native/servicebus";
import * as pulumi from "@pulumi/pulumi";
import { spec } from "../stack";
import { serviceBusQueueConfig } from "./configs";

const ragStack = new pulumi.StackReference(spec.ragInfraStack);
const resourceGroupName = ragStack.getOutput("resourceGroupName") as pulumi.Output<string>;
const namespaceName = ragStack.getOutput("serviceBusNamespaceName") as pulumi.Output<string>;

const queueConfig = serviceBusQueueConfig(spec);
export const serviceBusQueue = new servicebus.Queue("cdn-queue", {
  ...queueConfig,
  namespaceName,
  resourceGroupName,
});
