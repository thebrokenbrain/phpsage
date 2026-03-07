# Certificates

This directory stores local TLS files used by the server-side Traefik override.

Expected files:

- `cloudflare-origin.crt`: Cloudflare Origin Certificate in PEM format
- `cloudflare-origin.key`: private key for that certificate in PEM format

These files are intentionally ignored by git. The directory itself is tracked so this documentation stays with the project.

## Generate A Cloudflare Origin Certificate

1. Open your Cloudflare zone.
2. Go to `SSL/TLS`.
3. Open `Origin Server`.
4. Select `Create Certificate`.
5. Let Cloudflare generate the private key.
6. Enter the hostname you will serve from this project.
   Example: `phpsage.example.com`.
7. Create the certificate.
8. Copy the `Origin Certificate` block into `cloudflare-origin.crt`.
9. Copy the `Private Key` block into `cloudflare-origin.key`.

## Local Layout

The repository expects this structure:

```text
certificates/
  README.md
  cloudflare-origin.crt
  cloudflare-origin.key
```

## Permissions

Recommended local permissions:

```bash
chmod 644 certificates/cloudflare-origin.crt
chmod 600 certificates/cloudflare-origin.key
```

## Environment Variables

Set these paths in `.env`:

```bash
PHPSAGE_TLS_CERT_PATH=./certificates/cloudflare-origin.crt
PHPSAGE_TLS_KEY_PATH=./certificates/cloudflare-origin.key
```

Keep Cloudflare in `Full (strict)` when using this setup.