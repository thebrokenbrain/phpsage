import * as cloudflare from "@pulumi/cloudflare";
import * as hcloud from "@pulumi/hcloud";
import * as pulumi from "@pulumi/pulumi";
import { createARecord } from "./cloudflare/dns";
import { createZeroTrustAccessApplication } from "./cloudflare/zerotrust";
import { loadInfraConfig } from "./config";
import { createFirewall } from "./hetzner/firewall";
import { createServer, attachFirewall } from "./hetzner/server";
import { createSshKey } from "./hetzner/ssh";
import { buildCloudInitUserData } from "./provision/cloudinit";

const cfg = loadInfraConfig();

const hcloudProvider = new hcloud.Provider("hcloud", {
  token: cfg.hetzner.token,
});

const sshKey = createSshKey({
  name: cfg.hetzner.sshPublicKeyName,
  publicKey: cfg.hetzner.sshPublicKey,
}, { provider: hcloudProvider });

const firewall = createFirewall({
  name: cfg.hetzner.serverName,
}, { provider: hcloudProvider });

const server = createServer({
  name: cfg.hetzner.serverName,
  serverType: cfg.hetzner.serverType,
  location: cfg.hetzner.location,
  image: cfg.hetzner.image,
  sshKeyId: sshKey.id,
  userData: buildCloudInitUserData(),
}, { provider: hcloudProvider });

attachFirewall(server, firewall, { provider: hcloudProvider });

if (cfg.cloudflare) {
  const cloudflareProvider = new cloudflare.Provider("cloudflare", {
    apiToken: cfg.cloudflare.token,
  });

  createARecord(
    {
      zoneId: cfg.cloudflare.zoneId,
      subdomain: cfg.cloudflare.subdomain,
      ipv4Address: server.ipv4Address,
      proxied: cfg.cloudflare.proxied,
    },
    { provider: cloudflareProvider },
  );

  if (cfg.cloudflare.zeroTrust?.enabled) {
    createZeroTrustAccessApplication(
      {
        accountId: cfg.cloudflare.zeroTrust.accountId,
        applicationName: `${cfg.hetzner.serverName}-access`,
        fqdn: cfg.cloudflare.fqdn,
        allowedEmails: cfg.cloudflare.zeroTrust.allowedEmails,
      },
      { provider: cloudflareProvider },
    );
  }

}

export const serverName = server.name;
export const publicIpv4 = server.ipv4Address;
export const publicIpv6 = server.ipv6Address;
export const serverDomainOutput = cfg.cloudflare?.fqdn ?? null;
export const zeroTrustEnabled = cfg.cloudflare?.zeroTrust?.enabled ?? false;
export const zeroTrustAllowedEmails = cfg.cloudflare?.zeroTrust?.allowedEmails ?? [];
export const sshHint = pulumi.interpolate`ssh root@${server.ipv4Address}`;
