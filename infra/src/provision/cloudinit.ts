const REQUIRED_PACKAGES = [
  "docker.io",
  "docker-compose-plugin",
  "git",
  "curl",
  "wget",
  "unzip",
  "jq",
  "ca-certificates",
  "vim",
  "htop",
];

export function buildCloudInitUserData(): string {
  return `#cloud-config
package_update: true
package_upgrade: false
packages:
  - ${REQUIRED_PACKAGES.join("\n  - ")}
runcmd:
  - mkdir -p /opt/phpsage
  - mkdir -p /opt/phpsage/certificates
  - systemctl enable docker
  - systemctl start docker
`;
}
