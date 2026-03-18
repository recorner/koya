#!/usr/bin/env python3
"""
Directus CMS Schema Setup for Koya Bank Marketing Site.

Creates collections, fields, and seed data for the public marketing site.
Run once against a fresh Directus instance.

Usage:
  python3 scripts/directus-setup.py
"""

import json
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8055"
TOKEN = "koya_cms_static_token_2026"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}


def api(method: str, path: str, data=None):
    """Make a Directus API call."""
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ERROR {e.code} {method} {path}: {err[:200]}")
        return None


def create_collection(collection: str, meta: dict, schema: dict = None):
    """Create a Directus collection."""
    payload = {"collection": collection, "meta": meta}
    if schema is not None:
        payload["schema"] = schema
    else:
        payload["schema"] = {}
    result = api("POST", "/collections", payload)
    if result:
        print(f"  ✓ Collection: {collection}")
    return result


def create_field(collection: str, field: str, ftype: str, meta: dict = None, schema: dict = None):
    """Create a field on a Directus collection."""
    payload = {"field": field, "type": ftype}
    if meta:
        payload["meta"] = meta
    if schema:
        payload["schema"] = schema
    result = api("POST", f"/fields/{collection}", payload)
    if result:
        print(f"    + {collection}.{field} ({ftype})")
    return result


def create_relation(payload: dict):
    """Create a relation between collections."""
    result = api("POST", "/relations", payload)
    if result:
        print(f"    ~ Relation: {payload['collection']}.{payload['field']} -> {payload['related_collection']}")
    return result


def create_item(collection: str, data: dict):
    """Create an item in a collection."""
    result = api("POST", f"/items/{collection}", data)
    if result:
        print(f"    → {collection} item created")
    return result


# ─── 1. GLOBAL SETTINGS (singleton) ─────────────────────────────────────────

print("\n═══ Creating Collections ═══\n")

print("1/8 global_settings")
create_collection("global_settings", {
    "singleton": True,
    "icon": "settings",
    "note": "Global site settings (brand name, tagline, SEO defaults)",
    "sort": 1,
})
for f in [
    ("site_name", "string", {"interface": "input", "width": "half"}, {"max_length": 120}),
    ("site_tagline", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
    ("site_description", "text", {"interface": "input-multiline"}, None),
    ("og_image", "uuid", {"interface": "file-image", "special": ["file"]}, None),
    ("default_meta_title", "string", {"interface": "input"}, {"max_length": 120}),
    ("default_meta_description", "text", {"interface": "input-multiline"}, None),
    ("social_x_url", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
    ("social_discord_url", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
    ("social_github_url", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
    ("contact_email", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
]:
    fname, ftype, meta, schema = f
    create_field("global_settings", fname, ftype, meta, schema)


# ─── 2. NAVIGATION ──────────────────────────────────────────────────────────

print("\n2/8 navigation")
create_collection("navigation", {
    "icon": "menu",
    "note": "Header navigation links",
    "sort": 2,
})
for f in [
    ("label", "string", {"interface": "input", "width": "half", "required": True}, {"max_length": 80}),
    ("href", "string", {"interface": "input", "width": "half", "required": True}, {"max_length": 255}),
    ("sort", "integer", {"interface": "input", "width": "half", "hidden": True}, None),
    ("is_cta", "boolean", {"interface": "boolean", "width": "half"}, {"default_value": False}),
]:
    create_field("navigation", *f)


# ─── 3. FOOTER ──────────────────────────────────────────────────────────────

print("\n3/8 footer_columns + footer_links")
create_collection("footer_columns", {
    "icon": "view_column",
    "note": "Footer column groups",
    "sort": 3,
})
for f in [
    ("title", "string", {"interface": "input", "required": True}, {"max_length": 80}),
    ("sort", "integer", {"interface": "input", "hidden": True}, None),
]:
    create_field("footer_columns", *f)

create_collection("footer_links", {
    "icon": "link",
    "note": "Individual footer links within columns",
    "sort": 4,
    "hidden": True,
})
for f in [
    ("label", "string", {"interface": "input", "width": "half", "required": True}, {"max_length": 120}),
    ("href", "string", {"interface": "input", "width": "half", "required": True}, {"max_length": 255}),
    ("sort", "integer", {"interface": "input", "hidden": True}, None),
    ("column_id", "integer", {"interface": "select-dropdown-m2o", "special": ["m2o"]}, {"is_nullable": True}),
]:
    create_field("footer_links", *f)

create_relation({
    "collection": "footer_links",
    "field": "column_id",
    "related_collection": "footer_columns",
    "meta": {"one_field": "links", "sort_field": "sort"},
    "schema": {"on_delete": "CASCADE"},
})


# ─── 4. PAGES ───────────────────────────────────────────────────────────────

print("\n4/8 pages")
create_collection("pages", {
    "icon": "description",
    "note": "Marketing pages (homepage, about, etc.)",
    "sort": 5,
})
for f in [
    ("title", "string", {"interface": "input", "required": True}, {"max_length": 200}),
    ("slug", "string", {"interface": "input", "required": True, "note": "URL slug. Use '/' for homepage."}, {"max_length": 200, "is_unique": True}),
    ("status", "string", {"interface": "select-dropdown", "width": "half", "options": {"choices": [{"text": "Published", "value": "published"}, {"text": "Draft", "value": "draft"}, {"text": "Archived", "value": "archived"}]}}, {"default_value": "draft", "max_length": 20}),
    ("meta_title", "string", {"interface": "input", "width": "half"}, {"max_length": 200}),
    ("meta_description", "text", {"interface": "input-multiline"}, None),
]:
    create_field("pages", *f)


# ─── 5. PAGE SECTIONS ───────────────────────────────────────────────────────

print("\n5/8 page_sections")
create_collection("page_sections", {
    "icon": "view_stream",
    "note": "Content sections within pages",
    "sort": 6,
})

section_types = [
    {"text": "Hero", "value": "hero"},
    {"text": "Feature Grid", "value": "feature_grid"},
    {"text": "Stats / Trust Strip", "value": "stats"},
    {"text": "How It Works", "value": "how_it_works"},
    {"text": "Security", "value": "security"},
    {"text": "Cards Showcase", "value": "cards"},
    {"text": "Global Finance", "value": "global_finance"},
    {"text": "FAQ", "value": "faq"},
    {"text": "CTA", "value": "cta"},
    {"text": "Rich Text", "value": "rich_text"},
    {"text": "Final CTA", "value": "final_cta"},
    {"text": "Guest Swap Widget", "value": "swap_widget"},
    {"text": "Market Ribbon", "value": "market_ribbon"},
]

for f in [
    ("page_id", "integer", {"interface": "select-dropdown-m2o", "special": ["m2o"], "required": True}, {"is_nullable": True}),
    ("sort", "integer", {"interface": "input", "hidden": True}, None),
    ("section_type", "string", {"interface": "select-dropdown", "required": True, "options": {"choices": section_types}}, {"max_length": 40}),
    ("heading", "string", {"interface": "input"}, {"max_length": 300}),
    ("subheading", "string", {"interface": "input"}, {"max_length": 300}),
    ("body", "text", {"interface": "input-rich-text-md"}, None),
    ("badge_text", "string", {"interface": "input", "width": "half", "note": "Small label above heading"}, {"max_length": 80}),
    ("cta_label", "string", {"interface": "input", "width": "half"}, {"max_length": 80}),
    ("cta_href", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
    ("cta_secondary_label", "string", {"interface": "input", "width": "half"}, {"max_length": 80}),
    ("cta_secondary_href", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
    ("items", "json", {"interface": "input-code", "note": "JSON array for cards/features/steps", "options": {"language": "json"}}, None),
    ("config", "json", {"interface": "input-code", "note": "Extra section config (bg variant, etc.)", "options": {"language": "json"}}, None),
    ("background_image", "uuid", {"interface": "file-image", "special": ["file"]}, None),
]:
    create_field("page_sections", *f)

create_relation({
    "collection": "page_sections",
    "field": "page_id",
    "related_collection": "pages",
    "meta": {"one_field": "sections", "sort_field": "sort"},
    "schema": {"on_delete": "CASCADE"},
})


# ─── 6. FAQ ITEMS ───────────────────────────────────────────────────────────

print("\n6/8 faq_items")
create_collection("faq_items", {
    "icon": "help_outline",
    "note": "FAQ entries",
    "sort": 7,
})
for f in [
    ("question", "string", {"interface": "input", "required": True}, {"max_length": 300}),
    ("answer", "text", {"interface": "input-rich-text-md", "required": True}, None),
    ("sort", "integer", {"interface": "input", "hidden": True}, None),
    ("category", "string", {"interface": "input", "width": "half"}, {"max_length": 80}),
]:
    create_field("faq_items", *f)


# ─── 7. LEGAL PAGES ─────────────────────────────────────────────────────────

print("\n7/8 legal_pages")
create_collection("legal_pages", {
    "icon": "gavel",
    "note": "Legal / static content pages (Terms, Privacy, etc.)",
    "sort": 8,
})
for f in [
    ("title", "string", {"interface": "input", "required": True}, {"max_length": 200}),
    ("slug", "string", {"interface": "input", "required": True}, {"max_length": 200, "is_unique": True}),
    ("content", "text", {"interface": "input-rich-text-md", "required": True}, None),
    ("status", "string", {"interface": "select-dropdown", "width": "half", "options": {"choices": [{"text": "Published", "value": "published"}, {"text": "Draft", "value": "draft"}]}}, {"default_value": "draft", "max_length": 20}),
    ("meta_title", "string", {"interface": "input", "width": "half"}, {"max_length": 200}),
    ("meta_description", "text", {"interface": "input-multiline"}, None),
    ("updated_at", "timestamp", {"interface": "datetime", "readonly": True, "special": ["date-updated"]}, None),
]:
    create_field("legal_pages", *f)


# ─── 8. SEO DEFAULTS (singleton) ────────────────────────────────────────────

print("\n8/8 seo_defaults")
create_collection("seo_defaults", {
    "singleton": True,
    "icon": "search",
    "note": "Default SEO settings",
    "sort": 9,
})
for f in [
    ("title_suffix", "string", {"interface": "input", "note": "Appended to every page title"}, {"max_length": 80}),
    ("fallback_title", "string", {"interface": "input"}, {"max_length": 200}),
    ("fallback_description", "text", {"interface": "input-multiline"}, None),
    ("fallback_og_image", "uuid", {"interface": "file-image", "special": ["file"]}, None),
    ("robots_txt", "text", {"interface": "input-code", "options": {"language": "plaintext"}}, None),
]:
    create_field("seo_defaults", *f)


# ─── 9. WHATSAPP MESSAGE TEMPLATES ──────────────────────────────────────────

print("\n9/9 whatsapp_message_templates")
create_collection("whatsapp_message_templates", {
    "icon": "chat",
    "note": "CMS-managed WhatsApp reply copy for guest conversion flows",
    "sort": 10,
})
for f in [
    ("key", "string", {"interface": "input", "required": True, "width": "half", "note": "Stable template identifier used by the API"}, {"max_length": 120, "is_unique": True}),
    ("label", "string", {"interface": "input", "required": True, "width": "half"}, {"max_length": 150}),
    ("description", "text", {"interface": "input-multiline", "note": "Editor guidance for when this message is sent"}, None),
    ("body", "text", {"interface": "input-rich-text-md", "required": True, "note": "Supports placeholders like {{amount_kes}} or {{reference_code}}"}, None),
    ("buttons_json", "json", {"interface": "input-code", "options": {"language": "json"}, "note": "Optional quick reply buttons as JSON array, e.g. [{\"id\":\"1\",\"title\":\"Convert\"}]"}, None),
    ("is_active", "boolean", {"interface": "boolean", "width": "half"}, {"default_value": True}),
    ("twilio_content_sid", "string", {"interface": "input", "readonly": True, "note": "Cached Twilio Content SID for quick reply templates"}, {"max_length": 64}),
    ("twilio_content_hash", "string", {"interface": "input", "readonly": True, "note": "Signature of the current body/buttons config used to refresh Twilio content"}, {"max_length": 128}),
    ("sort", "integer", {"interface": "input", "hidden": True}, None),
]:
    create_field("whatsapp_message_templates", *f)


# ─── SEED DATA ──────────────────────────────────────────────────────────────

print("\n\n═══ Seeding Data ═══\n")

# Global settings (singleton — use PATCH)
print("→ Global settings")
api("PATCH", "/items/global_settings", {
    "site_name": "Koya",
    "site_tagline": "Your Money, Every Currency, One Platform",
    "site_description": "Deposit via M-Pesa. Hold KES, USD, BTC, and stablecoins. Convert instantly. Spend with a premium card. Invest in U.S. stocks. All from one Koya account.",
    "default_meta_title": "Koya — Your Money, Every Currency, One Platform",
    "default_meta_description": "Deposit via M-Pesa. Hold KES, USD, BTC, and stablecoins. Convert instantly. Spend with a premium card. Invest in U.S. stocks. All from one Koya account.",
    "social_x_url": "https://x.com/koyabank",
    "social_discord_url": "https://discord.gg/koyabank",
    "social_github_url": "https://github.com/koyabank",
    "contact_email": "hello@koya.finance",
})

print("→ WhatsApp message templates")
for i, template in enumerate([
    {
        "key": "welcome_menu",
        "label": "Welcome menu",
        "description": "First branded menu shown when a user greets the bot or restarts the flow.",
        "body": "*Koya | WhatsApp Desk*\nConvert Kenyan shillings to Bitcoin in a few guided replies.\n\n*Menu*\n1. Convert KES to BTC\n\nReply *1* to begin.\nReply *HELP* to see commands.\nReply *CANCEL* anytime to stop.",
        "buttons_json": [{"id": "1", "title": "Convert KES to BTC"}, {"id": "HELP", "title": "Help"}],
    },
    {
        "key": "ask_amount",
        "label": "Ask amount",
        "description": "Prompt asking for the KES amount.",
        "body": "*Koya | Quote Request*\nSend the amount you want to convert in Kenyan shillings.\n\nAllowed range: *KES 100* to *KES 100,000*\nExample: `2500`",
    },
    {
        "key": "show_quote",
        "label": "Show quote",
        "description": "Quote summary after the user enters a valid amount.",
        "body": "*Koya | Your Quote*\nSend: *KES {{source_amount}}*\nReceive: *BTC {{target_amount}}*\nRate: *1 KES = {{rate}} BTC*\nFee: *KES {{fee}}*\n\nThis quote expires in about *30 seconds*.\nReply *YES* to continue.",
        "buttons_json": [{"id": "YES", "title": "Continue"}, {"id": "CANCEL", "title": "Cancel"}],
    },
    {
        "key": "quote_expired",
        "label": "Quote expired",
        "description": "Shown when the quote is no longer valid.",
        "body": "*Koya | Quote Expired*\nThat quote is no longer valid.\n\nNext: send a new amount between *KES 100* and *KES 100,000* to get a fresh quote.",
    },
    {
        "key": "ask_full_name",
        "label": "Ask full name",
        "description": "Prompt for the user's legal name.",
        "body": "*Koya | Identity Check*\nEnter your *full legal name* exactly as it appears on your ID.\nExample: `John Doe`",
    },
    {
        "key": "ask_document_number",
        "label": "Ask document number",
        "description": "Prompt for Kenyan National ID number.",
        "body": "*Koya | Identity Check*\nEnter your *Kenyan National ID number*.\nExample: `12345678`",
    },
    {
        "key": "ask_email",
        "label": "Ask email",
        "description": "Prompt for optional email address.",
        "body": "*Koya | Contact Details*\nEnter your email address for updates, or reply *SKIP* to continue without one.\nExample: `name@example.com`",
        "buttons_json": [{"id": "SKIP", "title": "Skip Email"}],
    },
    {
        "key": "ask_mpesa_phone",
        "label": "Ask Kenyan phone",
        "description": "Prompt shown when the WhatsApp number is not a valid Kenyan M-Pesa number.",
        "body": "*Koya | Kenyan Number Needed*\nYour WhatsApp number *{{current_phone}}* cannot be used for this KES to BTC flow because M-Pesa requires a valid Kenyan mobile number.\n\nSend a Kenyan number in one of these formats:\n`0712345678`\n`0112345678`\n`254712345678`\n`+254712345678`",
    },
    {
        "key": "invalid_kenya_phone",
        "label": "Invalid Kenyan phone",
        "description": "Shown when the replacement Kenyan phone number is still invalid.",
        "body": "*Koya | Number Not Accepted*\nThe number *{{attempted_phone}}* is not a valid Kenyan mobile line for M-Pesa.\n\nNext: send a Kenyan number like `0712345678` or `+254712345678`.",
    },
    {
        "key": "ask_btc_address",
        "label": "Ask BTC address",
        "description": "Prompt for the payout Bitcoin address.",
        "body": "*Koya | BTC Payout*\nSend the Bitcoin address where you want to receive your BTC.\n\nAccepted formats: `1...`, `3...`, `bc1q...`, `bc1p...`",
    },
    {
        "key": "confirm_payment",
        "label": "Confirm payment",
        "description": "Payment summary before sending the STK push.",
        "body": "*Koya | Payment Check*\nAmount: *KES {{amount_kes}}*\nM-Pesa number: *{{phone}}*\n\nReply *PAY* to receive the M-Pesa STK push on that number.",
        "buttons_json": [{"id": "PAY", "title": "Send STK Push"}, {"id": "CANCEL", "title": "Cancel"}],
    },
    {
        "key": "payment_initiated",
        "label": "Payment initiated",
        "description": "Shown once the STK push has been initiated.",
        "body": "*Koya | STK Push Sent*\nWe sent an M-Pesa prompt to *{{phone}}*.\nCheck your phone, enter your PIN, and complete the payment.\n\nIf the prompt does not arrive, send the code as `REF XXXXXXXXXX`.",
        "buttons_json": [{"id": "STATUS", "title": "Check Status"}],
    },
    {
        "key": "payment_success",
        "label": "Payment success",
        "description": "Completion message after conversion succeeds.",
        "body": "*Koya | Conversion Complete*\nReference: *{{reference_code}}*\nGuest ID: *{{guest_ref}}*\n{{btc_line}}\n{{tx_line}}\n\nYour BTC transfer has been queued successfully.\nReply *1* when you want to start another conversion.",
        "buttons_json": [{"id": "1", "title": "New Conversion"}],
    },
    {
        "key": "conversion_status",
        "label": "Conversion status",
        "description": "Status summary for active conversion sessions.",
        "body": "*Koya | Conversion Status*\nReference: *{{reference_code}}*\nCurrent status: *{{current_state}}*\nSending: *{{source_asset}} {{source_amount}}*\n{{target_line}}",
    },
    {
        "key": "help_message",
        "label": "Help message",
        "description": "List of WhatsApp commands.",
        "body": "*Koya | Available Commands*\n*1* Start a new KES to BTC conversion\n*STATUS* Check the progress of your active conversion\n*CANCEL* Stop the current conversion\n*START OVER* Reset the chat and begin again\n*HELP* Show this command list",
    },
    {
        "key": "cancel_confirmation",
        "label": "Cancel confirmation",
        "description": "Shown when the user cancels the current flow.",
        "body": "*Koya | Conversion Cancelled*\nWe stopped the current flow.\nReply *1* whenever you want to start a new KES to BTC conversion.",
        "buttons_json": [{"id": "1", "title": "Start Again"}],
    },
    {
        "key": "error_message",
        "label": "Generic error",
        "description": "Shared error wrapper with a clear next step.",
        "body": "*Koya | We Need One More Step*\n{{message}}\n\nNext: {{next_step}}",
    },
    {
        "key": "invalid_input",
        "label": "Invalid input",
        "description": "Shared invalid input wrapper with clear next action.",
        "body": "*Koya | Input Not Accepted*\n{{message}}\n\nNext: {{next_step}}\nReply *HELP* for commands or *CANCEL* to stop.",
    },
    {
        "key": "rate_limited",
        "label": "Rate limited",
        "description": "Shown when a user sends too many messages too quickly.",
        "body": "*Koya | Slow Down A Little*\nWe received too many messages in a short time.\nPlease wait a moment, then send your next reply.",
    },
    {
        "key": "session_expired",
        "label": "Session expired",
        "description": "Shown when the conversation times out.",
        "body": "*Koya | Session Timed Out*\nThis chat expired because there was no activity for a while.\nReply *1* to start a fresh conversion.",
        "buttons_json": [{"id": "1", "title": "Start Again"}],
    },
    {
        "key": "identity_success",
        "label": "Identity success",
        "description": "Shown when identity checks pass.",
        "body": "*Koya | Identity Verified*\nYour details have been accepted and we can move to BTC payout.",
    },
    {
        "key": "identity_failed",
        "label": "Identity failed",
        "description": "Shown when identity checks fail.",
        "body": "*Koya | Identity Not Approved*\n{{reason}}\n\nNext: reply *START OVER* to try again, or contact support if you need help.",
        "buttons_json": [{"id": "START OVER", "title": "Start Over"}],
    },
    {
        "key": "reference_accepted",
        "label": "Reference accepted",
        "description": "Shown when a manual M-Pesa reference is accepted.",
        "body": "*Koya | Reference Received*\nWe have your M-Pesa reference and we are processing the payment now.\nReply *STATUS* if you want an update.",
        "buttons_json": [{"id": "STATUS", "title": "Check Status"}],
    },
    {
        "key": "reference_rejected",
        "label": "Reference rejected",
        "description": "Shown when a manual M-Pesa reference cannot be matched yet.",
        "body": "*Koya | Reference Not Accepted*\n{{reason}}\n\nNext: send the code as `REF XXXXXXXXXX` or reply *STATUS* to check progress.",
    },
], 1):
    create_item("whatsapp_message_templates", {**template, "is_active": True, "sort": i})

# Navigation
print("→ Navigation")
for i, (label, href) in enumerate([
    ("Products", "#products"),
    ("Security", "#security"),
    ("Cards", "#cards"),
    ("Investing", "#investing"),
], 1):
    create_item("navigation", {"label": label, "href": href, "sort": i, "is_cta": False})

# Footer columns + links
print("→ Footer columns")
cols = [
    ("Product", [
        ("Wallets", "#products"),
        ("Convert", "#products"),
        ("Cards", "#cards"),
        ("Investing", "#investing"),
    ]),
    ("Company", [
        ("About", "/about"),
        ("Blog", "/blog"),
        ("Careers", "/careers"),
        ("Press", "/press"),
    ]),
    ("Legal", [
        ("Terms of Service", "/legal/terms"),
        ("Privacy Policy", "/legal/privacy"),
        ("Compliance", "/legal/compliance"),
        ("AML Policy", "/legal/aml"),
    ]),
]
for sort_i, (title, links) in enumerate(cols, 1):
    col = create_item("footer_columns", {"title": title, "sort": sort_i})
    if col:
        col_id = col["data"]["id"]
        for link_sort, (label, href) in enumerate(links, 1):
            create_item("footer_links", {
                "label": label,
                "href": href,
                "sort": link_sort,
                "column_id": col_id,
            })

# SEO defaults (singleton — use PATCH)
print("→ SEO defaults")
api("PATCH", "/items/seo_defaults", {
    "title_suffix": " | Koya",
    "fallback_title": "Koya — Your Money, Every Currency, One Platform",
    "fallback_description": "Deposit via M-Pesa. Hold KES, USD, BTC, and stablecoins. Convert instantly. Spend with a premium card. Invest in U.S. stocks.",
})

# Homepage + sections
print("→ Homepage")
page = create_item("pages", {
    "title": "Home",
    "slug": "/",
    "status": "published",
    "meta_title": "Koya — Your Money, Every Currency, One Platform",
    "meta_description": "Deposit via M-Pesa. Hold KES, USD, BTC, and stablecoins. Convert instantly. Spend with a premium card. Invest in U.S. stocks. All from one Koya account.",
})

if page:
    page_id = page["data"]["id"]
    print("→ Homepage sections")

    sections = [
        {
            "section_type": "market_ribbon",
            "sort": 1,
            "heading": None,
            "config": json.dumps({"variant": "scroll"}),
        },
        {
            "section_type": "hero",
            "sort": 2,
            "badge_text": "Now in Early Access",
            "heading": "Your money.\nEvery currency.\nOne platform.",
            "subheading": "Deposit via M-Pesa. Hold KES, USD, BTC, and stablecoins. Convert instantly. Spend globally with a premium card. Invest in U.S. stocks — all from one Koya account.",
            "cta_label": "Join Waitlist",
            "cta_href": "#waitlist",
            "cta_secondary_label": "See How It Works",
            "cta_secondary_href": "#how-it-works",
        },
        {
            "section_type": "swap_widget",
            "sort": 3,
            "badge_text": "Try It",
            "heading": "Preview your conversion",
            "subheading": "See live indicative rates between KES, USD, BTC, and stablecoins — no account needed.",
        },
        {
            "section_type": "stats",
            "sort": 4,
            "heading": None,
            "items": json.dumps([
                {"icon": "Layers", "label": "5 currencies in one wallet"},
                {"icon": "Zap", "label": "Instant asset conversion"},
                {"icon": "CreditCard", "label": "Premium debit card"},
                {"icon": "TrendingUp", "label": "U.S. stock investing"},
                {"icon": "Shield", "label": "Bank-grade security"},
            ]),
        },
        {
            "section_type": "feature_grid",
            "sort": 5,
            "badge_text": "Products",
            "heading": "Everything your money needs",
            "subheading": "Four powerful capabilities — one unified platform.",
            "items": json.dumps([
                {
                    "icon": "ArrowLeftRight",
                    "title": "Convert",
                    "description": "Swap between KES, USD, BTC, USDC, and USDT at live rates. No hidden fees — just transparent spreads.",
                    "badge": "Live Rates",
                },
                {
                    "icon": "Wallet",
                    "title": "Hold",
                    "description": "Multi-currency wallets with real-time balances. Your KES, dollars, bitcoin, and stablecoins — all in one view.",
                    "badge": "5 Currencies",
                },
                {
                    "icon": "CreditCard",
                    "title": "Spend",
                    "description": "A premium card powered by your Koya wallets. Pay in any currency, anywhere — with 1% BTC cashback.",
                    "badge": "Global",
                },
                {
                    "icon": "TrendingUp",
                    "title": "Invest",
                    "description": "Buy fractional U.S. stocks and ETFs directly from your Koya account. Start with as little as $1.",
                    "badge": "Stocks & ETFs",
                },
            ]),
        },
        {
            "section_type": "how_it_works",
            "sort": 6,
            "badge_text": "How It Works",
            "heading": "From M-Pesa to the world",
            "subheading": "Five steps. One platform. Total financial freedom.",
            "items": json.dumps([
                {"step": 1, "icon": "Smartphone", "title": "Fund", "description": "Deposit KES instantly via M-Pesa STK push. Your money hits your Koya wallet in seconds.", "badge": "Instant"},
                {"step": 2, "icon": "ArrowLeftRight", "title": "Convert", "description": "Swap between KES, USD, BTC, USDC, and USDT at live market rates with transparent fees.", "badge": "Live Rates"},
                {"step": 3, "icon": "CreditCard", "title": "Spend", "description": "Use your premium Koya card online or in-store. Pay in any currency — we auto-convert from your wallets.", "badge": "Global"},
                {"step": 4, "icon": "TrendingUp", "title": "Invest", "description": "Buy fractional shares of Apple, Tesla, S&P 500 ETFs and more — directly from your USD balance.", "badge": "Stocks"},
                {"step": 5, "icon": "Banknote", "title": "Withdraw", "description": "Cash out to M-Pesa, bank transfer, or crypto wallet. Your money moves when you need it.", "badge": "Flexible"},
            ]),
        },
        {
            "section_type": "security",
            "sort": 7,
            "badge_text": "Security",
            "heading": "Bank-grade infrastructure",
            "subheading": "Your assets are protected by the same security standards used by the world's leading financial institutions.",
            "items": json.dumps([
                {"icon": "Lock", "title": "End-to-End Encryption", "description": "AES-256 encryption at rest. TLS 1.3 in transit. Zero plaintext secrets."},
                {"icon": "ShieldCheck", "title": "Institutional Custody", "description": "Digital assets secured via Fireblocks MPC. No single point of compromise."},
                {"icon": "Eye", "title": "Real-Time Monitoring", "description": "24/7 automated surveillance. Anomaly detection on every transaction."},
                {"icon": "FileCheck", "title": "Regulatory Compliance", "description": "KYC/AML screening on every user. Built for CBK and global regulatory standards."},
                {"icon": "BookOpen", "title": "Double-Entry Ledger", "description": "Every transaction creates balanced debit/credit entries. Auditable from day one."},
                {"icon": "AlertTriangle", "title": "Fraud Prevention", "description": "Device fingerprinting, velocity checks, and risk scoring on every operation."},
            ]),
        },
        {
            "section_type": "cards",
            "sort": 8,
            "badge_text": "Cards",
            "heading": "A card that works\nas hard as you do",
            "subheading": "Spend from any wallet, anywhere in the world — with 1% BTC cashback on every transaction.",
            "items": json.dumps([
                {"icon": "Wallet", "text": "Pay from KES, USD, or BTC wallets — auto-converted at the point of sale"},
                {"icon": "Percent", "text": "1% BTC cashback on every purchase — automatically deposited"},
                {"icon": "Globe", "text": "Accepted at 80M+ merchants worldwide via Visa network"},
                {"icon": "Smartphone", "text": "Instant freeze, unfreeze, and spending controls from the app"},
            ]),
        },
        {
            "section_type": "global_finance",
            "sort": 9,
            "badge_text": "Investing",
            "heading": "Global markets,\nlocal access",
            "subheading": "Buy fractional shares of U.S. stocks and ETFs — directly from your Koya account.",
        },
        {
            "section_type": "final_cta",
            "sort": 10,
            "heading": "Ready to upgrade your money?",
            "subheading": "Join the waitlist for early access to Koya — the borderless financial operating system built for Africa.",
            "cta_label": "Join Waitlist",
            "cta_href": "#waitlist",
        },
    ]

    for section in sections:
        section["page_id"] = page_id
        create_item("page_sections", section)


# ─── PUBLIC ACCESS POLICY ───────────────────────────────────────────────────

print("\n\n═══ Setting Public Read Access ═══\n")

# Get the public role's policy
policies_resp = api("GET", "/policies")
public_policy_id = None
if policies_resp and policies_resp.get("data"):
    for policy in policies_resp["data"]:
        if policy.get("name") == "Public":
            public_policy_id = policy["id"]
            break

if not public_policy_id:
    # Create a public policy
    result = api("POST", "/policies", {
        "name": "Public",
        "icon": "public",
        "description": "Public read access for CMS content",
        "admin_access": False,
        "app_access": False,
    })
    if result:
        public_policy_id = result["data"]["id"]
        # Attach to public access (no role, no user)
        api("POST", "/access", {
            "policy": public_policy_id,
            "role": None,
            "user": None,
        })

if public_policy_id:
    public_collections = [
        "global_settings", "navigation", "footer_columns", "footer_links",
        "pages", "page_sections", "faq_items", "legal_pages", "seo_defaults",
    ]
    for coll in public_collections:
        result = api("POST", "/permissions", {
            "policy": public_policy_id,
            "collection": coll,
            "action": "read",
            "fields": ["*"],
        })
        if result:
            print(f"  ✓ Public read: {coll}")

    # Also allow reading directus_files for images
    api("POST", "/permissions", {
        "policy": public_policy_id,
        "collection": "directus_files",
        "action": "read",
        "fields": ["*"],
    })
    print("  ✓ Public read: directus_files")


print("\n\n═══ Setup Complete ═══")
print(f"\nDirectus admin: http://localhost:8055")
print(f"Admin email:   admin@koyabank.com")
print(f"Static token:  koya_cms_static_token_2026")
print(f"Public URL:    https://cms.koyabank.com\n")
