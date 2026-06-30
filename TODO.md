# TODO

## Launch Readiness

- [x] Add real admin authentication.
- [x] Protect admin-only API routes:
  - [x] review submissions
  - [x] update price
  - [x] update image
  - [x] update grading
  - [x] add price history
- [x] Add basic public submit rate limiting.
- [x] Add stricter server-side validation for:
  - [x] serial range
  - [x] URLs
  - [x] image URLs
  - [x] prices
  - [x] source type
  - [x] verification status
  - [x] max text lengths
- Add Vercel deployment notes for `mtgtrackers.com`.

## Submission Review Queue

- Show approved and rejected submission history in admin.
- Add duplicate detection for repeated reports on the same serial.
- Add report status options beyond approved/rejected:
  - needs more info
  - duplicate
  - cannot verify
- Allow admins to merge evidence from multiple pending reports.
- Add audit trail for who reviewed each report.

## Image Storage

- Choose image storage provider:
  - Vercel Blob
  - S3
  - Cloudinary
- Replace URL-only evidence with uploads.
- Store all submitted evidence images with the report.
- Let admins choose the canonical card image during approval.
- Keep image provenance attached to each discovery.

## Modular Tracker Backend

- Extract One Ring-specific Redis logic into generic tracker helpers.
- Move tracker-specific settings into config:
  - slug
  - title
  - set/release/card type
  - total
  - Redis card key
  - Redis submissions key
  - serial formatter
  - reference image
  - theme
  - affiliate links
- Convert API routes to use tracker config by slug.
- Add Golden Chocobo as a second tracker after the generic path is ready.

## Directory And UX

- Add discovered count and pending report count to tracker directory cards.
- [x] Add richer tracker metadata:
  - [x] set name
  - [x] release name
  - [x] card type
  - [ ] source/reference links
- [x] Add tracker-specific affiliate links with default fallback.
- [x] Add tracker-specific theme config placeholders.
- Improve mobile layout for tracker cards and admin review.
- Add empty states for no submissions, no prices, and no discoveries.

## Data Safety

- Add export/backup endpoint for cards and submissions.
- Add import/restore tooling for admin use.
- Add lightweight schema versioning for tracker data.
- Document Redis key conventions.

## Maintenance

- Review npm audit warnings.
- Decide whether to migrate arbitrary image rendering to `next/image`.
- Add basic tests for submission approval/rejection.
