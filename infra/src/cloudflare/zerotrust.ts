import * as cloudflare from "@pulumi/cloudflare";
import * as pulumi from "@pulumi/pulumi";

export interface ZeroTrustAccessArgs {
  accountId: string;
  applicationName: string;
  fqdn: string;
  allowedEmails: string[];
}

export function createZeroTrustAccessApplication(
  args: ZeroTrustAccessArgs,
  opts?: pulumi.CustomResourceOptions,
): cloudflare.ZeroTrustAccessApplication {
  return new cloudflare.ZeroTrustAccessApplication(
    "zero-trust-access-app",
    {
      accountId: args.accountId,
      name: args.applicationName,
      domain: args.fqdn,
      type: "self_hosted",
      sessionDuration: "24h",
      autoRedirectToIdentity: false,
      policies: [
        {
          name: "allow-selected-emails",
          decision: "allow",
          precedence: 1,
          includes: args.allowedEmails.map((email) => ({
            email: { email },
          })),
        },
      ],
    },
    opts,
  );
}
