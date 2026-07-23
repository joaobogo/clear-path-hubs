# TaaSFlow — Industry Image Duplicate Report

Automated pre-generation duplicate detection across the 57-image plan.

## Method
- Exact-string comparison of `visual_brief`, `subject`, `location_or_environment`, `composition`, `focal_point`, and `asset_filename` across all 57 entries.
- Slug uniqueness against `canonical-57-industries.json`.
- Post-generation perceptual-hash (`phash`) check MUST be run on rendered images before flipping `approval_status` to `approved`. Threshold: any pair with Hamming distance < 10 requires re-generation.

## Findings
- Identical `visual_brief` values: **0** (unique across 57).
- Identical `subject` strings: **0** (unique across 57).
- Identical `asset_filename` values: **0** (each slug produces a distinct filename).
- Shared source files: **0** (every image is commissioned per-industry).
- Reused photographs with alternate crops: **0**.
- Slug collisions: **0**.

## Post-generation checklist (must run before approval)
1. Compute `phash` for every rendered image (`pillow` + `imagehash`).
2. Build a 57×57 distance matrix; flag any off-diagonal Hamming distance < 10.
3. Visual sampling — spot-check 10 random pairs for perceived similarity.
4. Re-generate any flagged industry with a rewritten brief before approval.

## Current verdict
**PASS at planning stage.** No structural duplicates in the manifest. Perceptual verification pending image generation.
