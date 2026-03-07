import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as pulumi from "@pulumi/pulumi";

export interface HetznerConfig {
  token: string;
  serverName: string;
  serverType: string;
  location: string;
  image: string;
  sshPublicKeyName: string;
  sshPublicKey: string;
}

export interface CloudflareConfig {
  token: string;
  zoneId: string;
  domain: string;
  subdomain: string;
  proxied: boolean;
  fqdn: string;
  zeroTrust: ZeroTrustConfig | null;
}

export interface ZeroTrustConfig {
  enabled: boolean;
  accountId: string;
  allowedEmails: string[];
}

export interface InfraConfig {
  stackName: string;
  hetzner: HetznerConfig;
  cloudflare: CloudflareConfig | null;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseCommaSeparatedList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function expandHomePath(inputPath: string): string {
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function readSshPublicKey(sshPath: string): string {
  const absolutePath = expandHomePath(sshPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`SSH public key file not found: ${absolutePath}`);
  }

  const publicKey = fs.readFileSync(absolutePath, "utf8").trim();
  if (!publicKey.startsWith("ssh-")) {
    throw new Error(`Invalid SSH public key format at: ${absolutePath}`);
  }

  return publicKey;
}

function buildCloudflareConfig(): CloudflareConfig | null {
  const token = getOptionalEnv("CLOUDFLARE_API_TOKEN");
  const zoneId = getOptionalEnv("CLOUDFLARE_ZONE_ID");
  const domain = getOptionalEnv("CLOUDFLARE_DOMAIN");
  const subdomain = getOptionalEnv("CLOUDFLARE_SUBDOMAIN");
  const accountId = getOptionalEnv("CLOUDFLARE_ACCOUNT_ID");
  const enableZeroTrust = parseBoolean(getOptionalEnv("ENABLE_ZERO_TRUST"), false);
  const allowedEmails = parseCommaSeparatedList(getOptionalEnv("ZERO_TRUST_ALLOWED_EMAILS"));

  // Cloudflare is optional in this phase. Enable it only when credentials are provided.
  if (!token && !zoneId) {
    if (enableZeroTrust) {
      throw new Error(
        "Zero Trust requires Cloudflare credentials. Provide CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID.",
      );
    }
    return null;
  }

  if (!token || !zoneId || !domain || !subdomain) {
    throw new Error(
      "Incomplete Cloudflare configuration. Provide CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_DOMAIN and CLOUDFLARE_SUBDOMAIN.",
    );
  }

  if (enableZeroTrust && allowedEmails.length === 0) {
    throw new Error("ENABLE_ZERO_TRUST=true requires ZERO_TRUST_ALLOWED_EMAILS with at least one email.");
  }

  if (enableZeroTrust && !accountId) {
    throw new Error("ENABLE_ZERO_TRUST=true requires CLOUDFLARE_ACCOUNT_ID.");
  }

  const fqdn = `${subdomain}.${domain}`;
  return {
    token,
    zoneId,
    domain,
    subdomain,
    proxied: parseBoolean(getOptionalEnv("ENABLE_CLOUDFLARE_PROXY"), true),
    fqdn,
    zeroTrust: enableZeroTrust
      ? {
          enabled: true,
          accountId: accountId!,
          allowedEmails,
        }
      : null,
  };
}

export function loadInfraConfig(): InfraConfig {
  const stackName = pulumi.getStack();
  const expectedStack = getOptionalEnv("PULUMI_STACK");

  if (expectedStack && expectedStack !== stackName) {
    throw new Error(`Stack mismatch: selected stack is '${stackName}', but PULUMI_STACK is '${expectedStack}'.`);
  }

  if (stackName !== "dev") {
    throw new Error(`Only 'dev' stack is supported in this phase. Current stack: '${stackName}'.`);
  }

  const serverName = getOptionalEnv("HCLOUD_SERVER_NAME") ?? "phpsage-dev";
  const sshPath = getRequiredEnv("HCLOUD_SSH_PUBLIC_KEY_PATH");

  return {
    stackName,
    hetzner: {
      token: getRequiredEnv("HCLOUD_TOKEN"),
      serverName,
      serverType: getOptionalEnv("HCLOUD_SERVER_TYPE") ?? "cpx21",
      location: getOptionalEnv("HCLOUD_LOCATION") ?? "fsn1",
      image: getOptionalEnv("HCLOUD_IMAGE") ?? "ubuntu-22.04",
      sshPublicKeyName: `${serverName}-ssh-key`,
      sshPublicKey: readSshPublicKey(sshPath),
    },
    cloudflare: buildCloudflareConfig(),
  };
}
