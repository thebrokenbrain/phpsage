import * as cloudflare from "@pulumi/cloudflare";
import * as pulumi from "@pulumi/pulumi";

export interface DnsRecordArgs {
  zoneId: string;
  subdomain: string;
  ipv4Address: pulumi.Input<string>;
  proxied: boolean;
}

export function createARecord(args: DnsRecordArgs, opts?: pulumi.CustomResourceOptions): cloudflare.DnsRecord {
  return new cloudflare.DnsRecord("server-dns-a", {
    zoneId: args.zoneId,
    name: args.subdomain,
    type: "A",
    content: args.ipv4Address,
    proxied: args.proxied,
    ttl: 1,
  }, opts);
}
