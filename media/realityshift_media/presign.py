"""Presigned GET URLs for a PRIVATE Backblaze B2 bucket.

A private bucket returns 403 to an unauthenticated browser request, so the
front-page wall can't read `https://bucket/key` directly. Instead the batch job
presigns each asset (and the index) and writes the time-limited signed URL into
the media index. No public bucket, and no Worker proxy required.

Caveat: B2 download authorizations cap at 7 days (604800 s), so the index is
re-presigned whenever it's regenerated. For a persistent public site a public
bucket is simpler; this is the private-bucket path.

Uses B2's S3-compatible endpoint via boto3 (a genblaze-s3 dependency), so it
does not depend on Genblaze internals.
"""
from __future__ import annotations

import os
from urllib.parse import urlparse

MAX_EXPIRES = 7 * 24 * 3600  # B2 presign ceiling


def _endpoint(region: str) -> str:
    return f"https://s3.{region}.backblazeb2.com"


def _client():
    import boto3

    region = os.environ["B2_REGION"]
    return boto3.client(
        "s3",
        endpoint_url=_endpoint(region),
        aws_access_key_id=os.environ["B2_KEY_ID"],
        aws_secret_access_key=os.environ["B2_APP_KEY"],
        region_name=region,
    )


def object_key_from_url(url: str) -> str:
    """Recover the B2 object key from an asset URL the sink returned.

    Works for both virtual-hosted (`https://bucket.s3…/key`) and path-style
    (`https://s3…/bucket/key`) URLs.
    """
    path = urlparse(url).path.lstrip("/")
    bucket = os.environ.get("B2_BUCKET", "")
    if bucket and path.startswith(bucket + "/"):
        return path[len(bucket) + 1:]
    return path


def presign_get(key: str, expires: int = MAX_EXPIRES) -> str:
    """A time-limited signed GET URL for one object in the private bucket."""
    expires = min(expires, MAX_EXPIRES)
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": os.environ["B2_BUCKET"], "Key": key},
        ExpiresIn=expires,
    )


def presign_url(asset_url: str, expires: int = MAX_EXPIRES) -> str:
    """Presign an asset URL the sink produced (convenience over presign_get)."""
    return presign_get(object_key_from_url(asset_url), expires)


def configure_cors(origins: list[str] | None = None) -> None:
    """Allow browser GET of the bucket's objects.

    A private bucket returns 403 to an unauthenticated request AND blocks
    cross-origin browser reads without a CORS rule — even a presigned URL fails
    with "Failed to fetch" from the app's origin until this is set. GET/HEAD only;
    the URLs themselves are still presigned and time-limited.
    """
    _client().put_bucket_cors(
        Bucket=os.environ["B2_BUCKET"],
        CORSConfiguration={"CORSRules": [{
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedOrigins": origins or ["*"],
            "AllowedHeaders": ["*"],
            "ExposeHeaders": ["Content-Length", "Content-Type"],
            "MaxAgeSeconds": 3600,
        }]},
    )


def put_file(key: str, path: str, content_type: str) -> str:
    """Upload a local file to B2 and return a presigned GET URL for it."""
    with open(path, "rb") as fh:
        _client().put_object(
            Bucket=os.environ["B2_BUCKET"], Key=key, Body=fh, ContentType=content_type,
        )
    return presign_get(key)


def put_index(key: str, body: bytes) -> str:
    """Upload the media index JSON to B2 and return a presigned GET URL for it.

    The frontend reads the index the same way it reads images — a presigned URL —
    so a private bucket needs no public read at all.
    """
    _client().put_object(
        Bucket=os.environ["B2_BUCKET"], Key=key, Body=body,
        ContentType="application/json",
    )
    return presign_get(key)


def get_index(key: str) -> bytes | None:
    """Fetch the current media index JSON from B2, or None if it doesn't exist.

    Any other error (auth, network) propagates: the batch must not overwrite an
    index it couldn't read, or earlier media would drop off the wall.
    """
    from botocore.exceptions import ClientError

    try:
        obj = _client().get_object(Bucket=os.environ["B2_BUCKET"], Key=key)
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        if code in ("NoSuchKey", "404", "NotFound"):
            return None
        raise
    return obj["Body"].read()
