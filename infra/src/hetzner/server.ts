import * as pulumi from "@pulumi/pulumi";
import * as hcloud from "@pulumi/hcloud";

export interface ServerArgs {
  name: string;
  serverType: string;
  location: string;
  image: string;
  sshKeyId: hcloud.SshKey["id"];
  userData: string;
}

export function createServer(args: ServerArgs, opts?: pulumi.CustomResourceOptions): hcloud.Server {
  return new hcloud.Server("server", {
    name: args.name,
    serverType: args.serverType,
    location: args.location,
    image: args.image,
    sshKeys: [args.sshKeyId],
    userData: args.userData,
  }, opts);
}

export function attachFirewall(
  server: hcloud.Server,
  firewall: hcloud.Firewall,
  opts?: pulumi.CustomResourceOptions,
): hcloud.FirewallAttachment {
  const firewallNumericId = firewall.id.apply((id) => Number.parseInt(id, 10));
  const serverNumericId = server.id.apply((id) => Number.parseInt(id, 10));

  return new hcloud.FirewallAttachment("server-firewall-attachment", {
    firewallId: firewallNumericId,
    serverIds: [serverNumericId],
  }, opts);
}
