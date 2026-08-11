#!/usr/bin/env python3
"""Inject cross-repo HTTP edges into a merged graphify graph.

Graphify cannot infer runtime HTTP calls (static analysis of imports only),
so frontend ↔ backend edges are always missing after merge-graphs. This
script reads api-contract.yaml + countries.json and links the real code
nodes by exact source_file, then rewrites graphify-out/graph.json.

Usage (after merge-graphs):
    python scripts/inject_contract_edges.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
GRAPH = ROOT / "graphify-out" / "graph.json"
CONTRACT = ROOT / "api-contract.yaml"
COUNTRIES = ROOT / "countries.json"


def find_by_file(nodes: list[dict], fragment: str, repo: str) -> dict | None:
    """Find a real-code node by source_file fragment + repo (not by label).

    Graphify stores source_file relative to each repo (e.g.
    "services/price_query.py"), so strip a leading "backend/"/"frontend/"
    prefix if present in the contract.
    """
    parts = fragment.split("/", 1)
    if len(parts) == 2 and parts[0] in ("backend", "frontend"):
        fragment = parts[1]
    for n in nodes:
        sf = n.get("source_file", "")
        if fragment in sf and n.get("repo") == repo:
            return n
    return None


def inject(nodes: list[dict], links: list[dict], src: dict, tgt: dict, endpoint: str) -> bool:
    if not src or not tgt:
        return False
    if src["id"] == tgt["id"]:
        return False
    # dedupe
    if any(l["source"] == src["id"] and l["target"] == tgt["id"] for l in links):
        return False
    links.append(
        {
            "source": src["id"],
            "target": tgt["id"],
            "relation": "calls_via_http",
            "_origin": "CONTRACT",
            "source_file": str(CONTRACT.name),
            "confidence": 1.0,
            "endpoint": endpoint,
        }
    )
    return True


def main() -> int:
    if not GRAPH.exists():
        print(f"ERROR: {GRAPH} not found — run merge-graphs first", file=sys.stderr)
        return 1
    if not CONTRACT.exists():
        print(f"ERROR: {CONTRACT} not found", file=sys.stderr)
        return 1

    contract = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    graph = json.loads(GRAPH.read_text(encoding="utf-8"))
    nodes, links = graph["nodes"], graph["links"]

    added = 0
    for edge in contract.get("cross_repo_edges", []):
        # Intra-backend edges (reads_from / writes_to) already exist in the
        # graph — only inject frontend → backend HTTP edges.
        if "frontend_file" not in edge or "backend_service_file" not in edge:
            continue
        fe = find_by_file(nodes, edge["frontend_file"], "frontend")
        be = find_by_file(nodes, edge["backend_service_file"], "backend")
        if inject(nodes, links, fe, be, edge.get("endpoint", "?")):
            added += 1
            print(
                f"✓ [{fe['repo']}] {fe['label']} → [{be['repo']}] {be['label']} "
                f"({edge.get('endpoint', '?')})"
            )

    cross = sum(
        1
        for l in links
        if {n.get("repo") for n in nodes if n["id"] in (l["source"], l["target"])}
        and len({n.get("repo") for n in nodes if n["id"] in (l["source"], l["target"])}) == 2
    )
    print(f"\n{added} edges inyectados | cross-repo total: {cross}")

    GRAPH.write_text(json.dumps(graph, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
