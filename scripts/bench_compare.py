#!/usr/bin/env python3
"""
Compare PERSON vs FIN_TRANSACTION bulk create performance.

Usage:
    python3 bench_compare.py [--host HOST] [--count N] [--batch N]

Defaults: localhost, 500 documents, batch size 50
"""
import argparse
import requests
import time

parser = argparse.ArgumentParser(description="PERSON vs FIN_TRANSACTION benchmark")
parser.add_argument("--host", default="localhost", help="WIP host (default: localhost)")
parser.add_argument("--count", type=int, default=500, help="Documents per template (default: 500)")
parser.add_argument("--batch", type=int, default=50, help="Batch size (default: 50)")
parser.add_argument("--api-key", default="dev_master_key_for_testing", help="API key")
args = parser.parse_args()

s = requests.Session()
s.headers["X-API-Key"] = args.api_key
base = f"http://{args.host}"


def bench(template_value, count, batch_size, data_fn):
    tmpl = s.get(f"{base}:8003/api/template-store/templates/by-value/{template_value}").json()
    tid = tmpl["template_id"]
    print(f"  Template: {tid} v{tmpl['version']}")

    docs = [{"template_id": tid, "data": data_fn(i)} for i in range(count)]
    total_ok = 0
    total_err = 0
    batch_times = []

    start = time.perf_counter()
    for i in range(0, count, batch_size):
        batch = docs[i : i + batch_size]
        bn = i // batch_size + 1
        r = s.post(f"{base}:8004/api/document-store/documents", json=batch)
        result = r.json()
        ok = sum(1 for x in result["results"] if x.get("document_id"))
        err = len(batch) - ok
        total_ok += ok
        total_err += err
        srv = result.get("timing", {}).get("total")
        batch_times.append(srv)
        srv_str = f"{srv:.0f}ms" if srv else "?"
        print(f"    Batch {bn:3d}: {ok} ok, {err} err | server {srv_str}")
    elapsed = (time.perf_counter() - start) * 1000

    warm = [t for t in batch_times[1:] if t]
    avg_server = sum(warm) / len(warm) if warm else 0

    print(f"  Result: {total_ok} created, {total_err} errors")
    print(f"  Wall time:  {elapsed:.0f}ms")
    print(f"  Throughput: {count / elapsed * 1000:.0f} docs/sec")
    if warm:
        print(f"  Avg server (warm): {avg_server:.0f}ms per batch of {batch_size}")
    print()
    return count / elapsed * 1000


# --- Setup ---
print(f"Benchmark: PERSON vs FIN_TRANSACTION")
print(f"  Host:  {args.host}")
print(f"  Count: {args.count} docs each")
print(f"  Batch: {args.batch}")
print()

# Get account for FIN_TRANSACTION
accts = s.get(
    f"{base}:8004/api/document-store/documents",
    params={"template_value": "FIN_ACCOUNT", "page_size": 1, "latest_only": True},
).json()
if not accts["items"]:
    print("ERROR: No FIN_ACCOUNT document found. Create one first.")
    exit(1)
account_id = accts["items"][0]["document_id"]
print(f"  Account: {account_id}")
print()

# --- PERSON ---
print("=== PERSON ===")
person_rate = bench(
    "PERSON",
    args.count,
    args.batch,
    lambda i: {
        "first_name": f"Bench{i}",
        "last_name": f"Test{i}",
        "email": f"bench{i}@wip-benchmark.test",
        "birth_date": "1990-01-01",
        "active": True,
    },
)

# --- FIN_TRANSACTION ---
print("=== FIN_TRANSACTION ===")
txn_rate = bench(
    "FIN_TRANSACTION",
    args.count,
    args.batch,
    lambda i: {
        "account": account_id,
        "source_reference": f"BENCH-{int(time.time())}-{i}",
        "booking_date": "2025-06-15",
        "value_date": "2025-06-15",
        "currency": "CHF",
        "amount": -(i % 500 + 1),
        "transaction_type": "DEBIT_CARD",
        "description": f"Benchmark transaction #{i}",
    },
)

# --- Summary ---
print("=" * 50)
print(f"  PERSON:          {person_rate:6.0f} docs/sec")
print(f"  FIN_TRANSACTION: {txn_rate:6.0f} docs/sec")
print(f"  Ratio:           {person_rate / txn_rate:.1f}x")
print("=" * 50)
