-- The Android apps read versions.json from the app-downloads bucket to offer
-- in-place updates (src/lib/nativeUpdate.ts, MOBILE_RELEASE.md §10), but the
-- bucket only accepted APKs, so the manifest could never be uploaded.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/vnd.android.package-archive', 'application/json']
WHERE id = 'app-downloads';
