import json
import time
import urllib.request
import urllib.error

base = "http://localhost:3333/api/v1"

def post(path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(
        f"{base}{path}", body, {"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  HTTP {e.code}: {err}")
        raise

def get(path):
    try:
        with urllib.request.urlopen(f"{base}{path}") as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  HTTP {e.code}: {err}")
        raise

def pp(obj):
    print(json.dumps(obj, indent=2))

print("=== 1. Quote ===")
q = post("/guest-conversion/quote", {
    "sourceAsset": "KES",
    "targetAsset": "BTC",
    "sourceAmount": "500000",
    "channel": "WEB",
})
pp(q)

print("\n=== 2. Session ===")
s = post("/guest-conversion/session", {
    "quoteId": q["quoteId"],
    "channel": "WEB",
})
pp(s)
sid = s["sessionId"]

print(f"\n=== 3. Identity (session: {sid}) ===")
ident = post(f"/guest-conversion/{sid}/identity", {
    "fullName": "John Kamau",
    "countryCode": "KE",
    "documentType": "NATIONAL_ID",
    "documentNumber": "12345678",
    "phone": "0712345678",
})
pp(ident)

print("\n=== 4. Payout ===")
p = post(f"/guest-conversion/{sid}/payout-details", {
    "btcAddress": "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
})
pp(p)

print("\n=== 5. Initiate Payment ===")
pay = post(f"/guest-conversion/{sid}/initiate-payment", {})
pp(pay)
crid = pay["checkoutRequestId"]

print("\n=== 6. Mock M-Pesa Callback ===")
cb = post("/payments/mpesa/callback", {
    "Body": {
        "stkCallback": {
            "MerchantRequestID": "MOCK-MR-TEST",
            "CheckoutRequestID": crid,
            "ResultCode": 0,
            "ResultDesc": "Success",
            "CallbackMetadata": {
                "Item": [
                    {"Name": "Amount", "Value": 5000},
                    {"Name": "MpesaReceiptNumber", "Value": "RK31TESTOK"},
                    {"Name": "TransactionDate", "Value": 20260313164100},
                    {"Name": "PhoneNumber", "Value": 254712345678},
                ]
            },
        }
    }
})
pp(cb)

print("\n=== 7. Status (after callback) ===")
st = get(f"/guest-conversion/{sid}/status")
pp(st)

state = st["currentState"]
tx = st.get("txHash")
if state == "COMPLETED" and tx:
    print(f"\n✅ PASS — Conversion completed | txHash: {tx}")
else:
    print(f"\n❌ FAIL — Expected COMPLETED, got {state}")

print("\n=== DONE ===")
