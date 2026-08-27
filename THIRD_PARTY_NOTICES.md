# Third-Party Notices

AI-X Personalized Learning Community is distributed under the MIT License. It
also uses third-party packages that remain subject to their respective license
terms and copyright notices.

The authoritative dependency set is defined by:

- `apps/backend/package-lock.json`
- `apps/frontend/pnpm-lock.yaml`
- the pinned container images in `docker-compose.yml`

Most JavaScript dependencies use permissive licenses, including MIT, ISC,
Apache-2.0, BSD-2-Clause, BSD-3-Clause and BlueOak-1.0.0. Packages with other
licenses in the validated dependency tree include:

| Package or component | License | Use in this project |
| --- | --- | --- |
| `@vercel/analytics` | MPL-2.0 | Frontend integration dependency; the local stack returns an empty response for the hosted analytics script endpoint. |
| Bundled `@vercel/og` component in Next.js | MPL-2.0 | Included in the installed Next.js package; the current application defines no Open Graph image-generation route. |
| `lightningcss` and platform packages | MPL-2.0 | Frontend build tooling. |
| `caniuse-lite` | CC-BY-4.0 | Browser-compatibility data used during frontend builds. |
| `argparse` | Python-2.0 | Transitive frontend tooling dependency. |
| Sharp platform packages / prebuilt libvips | Apache-2.0 and LGPL-3.0-or-later components | Optional Next.js image/build dependency. The current application uses unoptimized images and does not copy Sharp into the final runtime image. |

This file is a practical notice, not a replacement for the complete license
texts shipped by each package. When dependencies are installed, consult each
package's included `LICENSE`, `COPYING`, `NOTICE`, or package metadata for the
complete terms. Container base images and bundled operating-system packages
retain their own licenses as well.

Before redistributing a prebuilt image or a modified dependency bundle, generate
an up-to-date software bill of materials or license inventory from the exact
release artifact.
