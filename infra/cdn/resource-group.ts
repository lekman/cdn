import * as resources from "@pulumi/azure-native/resources";
import { spec } from "../stack";
import { resourceGroupConfig } from "./configs";

const config = resourceGroupConfig(spec);

export const cdnResourceGroup = new resources.ResourceGroup("cdn-rg", {
  resourceGroupName: config.resourceGroupName,
  location: config.location,
  tags: config.tags,
});
