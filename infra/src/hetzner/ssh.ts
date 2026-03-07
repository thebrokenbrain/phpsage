import * as pulumi from "@pulumi/pulumi";
import * as hcloud from "@pulumi/hcloud";

export interface SshKeyArgs {
  name: string;
  publicKey: string;
}

export function createSshKey(args: SshKeyArgs, opts?: pulumi.CustomResourceOptions): hcloud.SshKey {
  return new hcloud.SshKey("server-ssh-key", {
    name: args.name,
    publicKey: args.publicKey,
  }, opts);
}
