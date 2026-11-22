# Reel publish diagnosis (2026-11-22) - NOT RESOLVED

Account @zoomed.out.365, Graph API v23.0. Reel never went live; only the Voyager carousel is on the feed.

## Symptom
`POST /{IG_USER_ID}/media_publish` -> `code -1, subcode 2207085, "Fatal"/generic internal error`, `is_transient:false`, for every REELS container, although each container reaches `status_code=FINISHED`.

## Checked
- content_publishing_limit: quota_usage 1 / 100 (not a quota issue).
- Account OK: media_count 1, username zoomed.out.365. Carousel publishing works.
- Source mp4 was already within spec: H.264 High L4.0, yuv420p, 1080x1920, 30fps, ~5.2 Mbps video, AAC LC 48k stereo, moov before mdat (faststart), 34.5s, 23 MB. So encoding is NOT the cause.

## Attempts (this run, all failed with 2207085)
1. Old container 18131686267750849 (original file), retried: fail.
2. Re-encoded to strict spec (`test-reel-voiced-v2.mp4`, 6M/8M/12M, level 4.1, faststart), video_url, caption, share_to_feed=true: fail.
3. Resumable upload (upload_type=resumable, POST to rupload.facebook.com/ig-api-upload/v23.0/{id}, "Upload Successful", FINISHED): fail.
4. v2 via video_url, caption only (no share_to_feed): fail.
Feed checked before each attempt; nothing duplicated.

## Conclusion
Not a file/encoding issue, not quota, not upload method, not share_to_feed. Subcode 2207085 is undocumented (search found nothing); the failure is on Meta's publish step for REELS on this account. Likely suspects: account/app-level Reels publishing restriction (new account, app lacking `instagram_content_publish` for REELS, or token type), or a Meta-side outage. Carousels work, so token permission is fine in general.

## Suggested next steps
- Retry later (hours) in case of Meta-side issue; check https://metastatus.com.
- Post one reel manually/natively in the IG app (account has only 1 post; new accounts are sometimes blocked from API reels until a first reel exists) and retry.
- Test with a Facebook Page-linked token (Facebook Login flow) if current token is Instagram Login.
- If persisting, file a Meta bug with fbtrace_ids: AkqsVfJQ6-pSLaXeNb4WwMi, AeJR-A9kSlRrOaAl-ywXMcR, AHj756sHkYWXd_1xTzR0kmm, AKkzMcV_mADOZB4qXRK3vKl.
- Publisher fallback: post the daily content as carousel/image until reels work.

No working reel fix was found, so README was not changed.
