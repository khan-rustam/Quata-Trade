---
name: quatatrade-uploads
description: File upload, storage and media-serving rules for QuataTrade. Use when handling ANY file upload, image, payment proof, dispute evidence, KYC document, avatar, presigned URL or MinIO bucket. Triggers on upload, file, image, multipart, MinIO, S3, presigned, sharp, EXIF, ClamAV, magic bytes, file-type, SVG, attachment.
---

# QuataTrade Upload Rules

Authority: `Documents/08-security-checklist.md` §F + `Documents/02-tech-stack.md`
(Uploads section). Buckets: `kyc/` (encrypted), `proofs/`, `disputes/` — all **private**.

Uploads are the highest-risk untrusted input in this product: users upload payment
proofs and identity documents, and admins open them. Treat every file as hostile.

## The pipeline — in this order, no steps skipped

1. **Size limit** enforced before reading the body.
2. **Magic-byte check** with `file-type` on the actual bytes. The declared
   `Content-Type` and the filename extension are both attacker-controlled and prove
   nothing.
3. **Allow-list only:** jpeg, png, webp — plus pdf for KYC. **SVG is banned** (it is a
   script execution vector, not an image).
4. **ClamAV scan before persist** (`clamscan`). A file that has not been scanned has not
   been accepted.
5. **`sharp` re-encode** to JPEG/WebP, which strips EXIF (GPS, device, timestamps) as a
   side effect of re-encoding. Discard the original — do not keep it "just in case".
6. **Store in a private bucket.** KYC additionally encrypted per-file at rest (sodium;
   per-file key wrapped by the master key from the secrets manager).
7. **Serve only via short-TTL presigned URLs.** Never public-read, never in the webroot,
   never a path a bare object key can be guessed into.

## Access control

- Every download is authorized against the requesting identity: a payment proof is
  visible to the two trade counterparties and admins, nobody else. This is an IDOR
  surface — test cross-user access returns 403/404 and leaks nothing in the body.
- KYC document access is **audit-logged on read**, with the admin identity, not just on
  approve/reject (`quatatrade-kyc-risk`).
- Presigned URL TTL is short and the URL is generated per request. Never cache one in a
  DB column, a client store, or a log line.

## Frontend side

Client-side type/size pre-check is a UX courtesy, never a control — the server repeats
every check. Show the user what will be accepted before they pick a file, and give a
specific error when it is not ("PNG, JPEG or WebP, up to 5 MB" — not "invalid file").
Render user-supplied images with explicit dimensions so a hostile file cannot reflow the
page, and never interpolate a filename into HTML.

## NEVER do

- NEVER trust `Content-Type`, the file extension, or a client-side check.
- NEVER accept SVG. Not for avatars, not for "just icons", not from admins.
- NEVER persist a file before the magic-byte check and the AV scan.
- NEVER keep the original upload after re-encode, or store EXIF.
- NEVER make a bucket public, or serve uploads from the app's static/webroot.
- NEVER put a KYC document, payment proof, or presigned URL into a log line, an error
  message, an email, or any Claude context.
- NEVER fetch a user-supplied URL server-side (SSRF) — uploads are bytes from the
  client, never a link the server retrieves.
- NEVER interpolate a user-supplied filename into a shell command, a path, or SQL.
  Generate your own object key.
