// Configuration spec for Serper (Self-Hosted)
// These options display in the Start9 UI Config section

import { compat, types as T } from "../deps.ts";

export const getConfig: T.ExpectedExports.getConfig = compat.getConfig({
  "tor-address": {
    name: "Tor Address",
    description: "The Tor address of the network interface",
    type: "pointer",
    subtype: "package",
    "package-id": "serper",
    target: "tor-address",
    interface: "main",
  },
  "lan-address": {
    name: "LAN Address",
    description: "The LAN address of the network interface",
    type: "pointer",
    subtype: "package",
    "package-id": "serper",
    target: "lan-address",
    interface: "main",
  },
  "api-key": {
    type: "string",
    name: "API Key",
    description:
      "Your Serper API key. Use this in your applications just like you would use a Serper.dev API key. Set in the X-API-KEY header or SERPER_API_KEY environment variable.",
    nullable: false,
    default: {
      charset: "a-z,A-Z,0-9",
      len: 32,
    },
    pattern: "^[a-zA-Z0-9]{16,64}$",
    "pattern-description": "Must be 16-64 alphanumeric characters",
    masked: true,
    copyable: true,
  },
  "instance-name": {
    type: "string",
    name: "Instance Name",
    description: "A friendly name for your Serper instance",
    nullable: false,
    default: "Serper",
    placeholder: "My Serper Instance",
  },
  "log-level": {
    type: "enum",
    name: "Log Level",
    description: "Logging verbosity for the Serper bridge",
    values: ["error", "warn", "info", "debug"],
    "value-names": {
      "error": "Error - Only errors",
      "warn": "Warning - Errors and warnings",
      "info": "Info - Standard logging",
      "debug": "Debug - Verbose logging",
    },
    default: "info",
  },
  "default-results": {
    type: "number",
    name: "Default Results",
    description: "Default number of search results to return when not specified in the request",
    nullable: false,
    default: 10,
    range: "[1,100]",
    integral: true,
  },
});
