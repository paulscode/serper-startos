import { types as T, healthUtil } from "../deps.ts";

export const health: T.ExpectedExports.health = {
  // Check the Serper bridge health endpoint
  "api": healthUtil.checkWebUrl("http://serper.embassy:3000/health")
}
