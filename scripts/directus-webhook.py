#!/usr/bin/env python3
"""
Create a Directus Flow that fires a webhook to our Next.js revalidation
endpoint whenever any CMS collection is updated.

Usage:
  python scripts/directus-webhook.py

Requires: requests  (pip install requests)
"""

import os
import sys
import requests
import uuid

DIRECTUS_URL = os.getenv("DIRECTUS_URL", "http://localhost:8055")
ADMIN_EMAIL = os.getenv("DIRECTUS_ADMIN_EMAIL", "admin@koyabank.com")
ADMIN_PASSWORD = os.getenv("DIRECTUS_ADMIN_PASSWORD", "nwRhdt66D1zq1tgnshWinHikNOJvgY_V")
STATIC_TOKEN = os.getenv("DIRECTUS_TOKEN", "koya_cms_static_token_2026")

# The public URL where Next.js is reachable (Directus calls this)
SITE_URL = os.getenv("SITE_URL", "https://koyabank.com")
REVALIDATION_SECRET = os.getenv("REVALIDATION_SECRET", "koya_revalidate_s3cr3t_2026")

HEADERS = {
    "Authorization": f"Bearer {STATIC_TOKEN}",
    "Content-Type": "application/json",
}

# Collections we want to trigger revalidation for
CMS_COLLECTIONS = [
    "global_settings",
    "seo_defaults",
    "navigation",
    "footer_columns",
    "footer_links",
    "pages",
    "page_sections",
    "faq_items",
    "legal_pages",
]

FLOW_NAME = "Revalidate Next.js on CMS change"


def check_existing():
    """Check if the flow already exists."""
    r = requests.get(
        f"{DIRECTUS_URL}/flows",
        headers=HEADERS,
        params={"filter[name][_eq]": FLOW_NAME},
    )
    r.raise_for_status()
    data = r.json().get("data", [])
    return data[0] if data else None


def create_flow():
    """Create the Flow + Operation in Directus."""

    existing = check_existing()
    if existing:
        print(f"Flow already exists (id={existing['id']}). Skipping creation.")
        return existing["id"]

    flow_id = str(uuid.uuid4())
    operation_id = str(uuid.uuid4())

    # Step 1: Create the flow (without operation)
    flow_payload = {
        "id": flow_id,
        "name": FLOW_NAME,
        "status": "active",
        "trigger": "event",
        "options": {
            "type": "action",
            "scope": ["items.create", "items.update", "items.delete"],
            "collections": CMS_COLLECTIONS,
        },
    }

    r = requests.post(
        f"{DIRECTUS_URL}/flows",
        headers=HEADERS,
        json=flow_payload,
    )

    if r.status_code not in (200, 201, 204):
        print(f"Failed to create flow: {r.status_code}")
        print(r.text)
        sys.exit(1)

    print(f"Flow created: {FLOW_NAME} (id={flow_id})")

    # Step 2: Create the operation linked to the flow
    operation_payload = {
        "id": operation_id,
        "name": "POST to /api/revalidate",
        "key": "revalidate_webhook",
        "type": "request",
        "position_x": 19,
        "position_y": 1,
        "flow": flow_id,
        "options": {
            "method": "POST",
            "url": f"{SITE_URL}/api/revalidate",
            "headers": [
                {"header": "Content-Type", "value": "application/json"}
            ],
            "body": f'{{"secret": "{REVALIDATION_SECRET}"}}',
        },
    }

    r = requests.post(
        f"{DIRECTUS_URL}/operations",
        headers=HEADERS,
        json=operation_payload,
    )

    if r.status_code not in (200, 201, 204):
        print(f"Failed to create operation: {r.status_code}")
        print(r.text)
        sys.exit(1)

    print(f"  Operation created: POST {SITE_URL}/api/revalidate")

    # Step 3: Set the operation as the flow's first operation
    r = requests.patch(
        f"{DIRECTUS_URL}/flows/{flow_id}",
        headers=HEADERS,
        json={"operation": operation_id},
    )

    if r.status_code not in (200, 201, 204):
        print(f"Warning: Could not link operation to flow: {r.status_code}")
        print(r.text)
    else:
        print(f"  Linked operation to flow")

    print(f"  Triggers on: {', '.join(CMS_COLLECTIONS)}")
    return flow_id


if __name__ == "__main__":
    print(f"Directus: {DIRECTUS_URL}")
    print(f"Site URL: {SITE_URL}")
    print()
    create_flow()
    print("\nDone! CMS changes will now trigger instant revalidation.")
