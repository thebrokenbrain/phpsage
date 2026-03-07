import * as pulumi from "@pulumi/pulumi";
import * as hcloud from "@pulumi/hcloud";

export interface FirewallArgs {
  name: string;
}

export function createFirewall(args: FirewallArgs, opts?: pulumi.CustomResourceOptions): hcloud.Firewall {
  return new hcloud.Firewall("server-firewall", {
    name: `${args.name}-fw`,
    rules: [
      {
        direction: "in",
        protocol: "tcp",
        port: "22",
        sourceIps: ["0.0.0.0/0", "::/0"],
      },
      {
        direction: "in",
        protocol: "tcp",
        port: "80",
        sourceIps: ["0.0.0.0/0", "::/0"],
      },
      {
        direction: "in",
        protocol: "tcp",
        port: "443",
        sourceIps: ["0.0.0.0/0", "::/0"],
      },
    ],
  }, opts);
}
