# Source image integrity

| Exam | Files | Decoded format | Resolution | Source type |
|---|---:|---|---|---|
| SP26-FE | 50 | JPEG | 1920 × 720 | Full attachment |
| FA25-FE | 50 | WebP | 1920 × 780 | Full attachment |
| SU25-FE | 50 | WebP | 1920 × 780 | Full attachment |
| FA24-RE | 50 | PNG | 1920 × 780 | Full attachment |

- Every image was downloaded from its authenticated attachment link, not from
  the 179 × 179 forum preview.
- Every exam folder contains `manifest.csv` with byte length, decoded
  dimensions, format, and SHA-256.
- `ADY201m-4-de-anh-goc.zip` was reopened after creation and contains exactly
  200 image entries plus four manifests (204 entries total).
- FA24 attachments were named `.webp` by the forum, but their decoded original
  payload is PNG; the bytes were preserved without recompression.
