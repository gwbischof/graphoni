#!/usr/bin/env python3
"""
CLI for the Graphoni graph wiki.

Usage:
    graphoni search "epstein"
    graphoni node jeffrey_epstein --hops 2
    graphoni path jeffrey_epstein ghislaine_maxwell
    graphoni stats
    graphoni add-node --label "New Person" --type Person --reason "..."
    graphoni proposals --status pending
    graphoni approve <id> --comment "looks good"
"""

import argparse
import json
import sys
from client import GraphoniClient, GraphoniError


def _client(args) -> GraphoniClient:
    return GraphoniClient(
        base_url=args.url,
        api_key=args.api_key,
    )


def _output(args, data):
    """Print data as JSON or human-readable."""
    if args.json:
        print(json.dumps(data, indent=2, default=str))
    else:
        if isinstance(data, list):
            for item in data:
                _print_item(item)
        elif isinstance(data, dict):
            _print_item(data)
        else:
            print(data)


def _print_item(item: dict, indent: int = 0):
    """Pretty-print a dict."""
    prefix = "  " * indent
    for k, v in item.items():
        if isinstance(v, dict):
            print(f"{prefix}{k}:")
            _print_item(v, indent + 1)
        elif isinstance(v, list) and v and isinstance(v[0], dict):
            print(f"{prefix}{k}: ({len(v)} items)")
            for sub in v[:5]:
                _print_item(sub, indent + 1)
                print()
            if len(v) > 5:
                print(f"{prefix}  ... and {len(v) - 5} more")
        else:
            print(f"{prefix}{k}: {v}")


def cmd_search(args):
    client = _client(args)
    types = args.types.split(",") if args.types else None
    results = client.search(args.query, limit=args.n, types=types)
    if args.json:
        print(json.dumps(results, indent=2, default=str))
    else:
        for r in results:
            data = r.get("data", r)
            label = data.get("label", data.get("id", "?"))
            ntype = data.get("node_type", "")
            nid = data.get("id", "")
            print(f"  {label}  ({ntype})  [{nid}]")


def cmd_node(args):
    client = _client(args)
    data = client.get_node(args.id, hops=args.hops)
    _output(args, data)


def cmd_path(args):
    client = _client(args)
    data = client.find_path(args.from_node, args.to_node, max_length=args.max_length)
    if args.json:
        print(json.dumps(data, indent=2, default=str))
    else:
        if data.get("path") is None and "elements" not in data:
            print(data.get("message", "No path found"))
        else:
            length = data.get("pathLength", "?")
            count = data.get("count", {})
            print(f"Path length: {length} ({count.get('nodes', '?')} nodes, {count.get('edges', '?')} edges)")
            for el in data.get("elements", []):
                d = el.get("data", {})
                if el.get("group") == "nodes":
                    print(f"  [{d.get('node_type', '')}] {d.get('label', d.get('id', ''))}")
                else:
                    print(f"  --{d.get('edge_type', '')}-->")


def cmd_stats(args):
    client = _client(args)
    data = client.stats()
    if args.json:
        print(json.dumps(data, indent=2, default=str))
    else:
        print(f"Nodes: {data.get('nodeCount', '?')}")
        print(f"Edges: {data.get('edgeCount', '?')}")
        nt = data.get("nodeTypes", {})
        if nt:
            print("\nNode types:")
            for t, c in sorted(nt.items(), key=lambda x: -x[1]):
                print(f"  {t}: {c}")
        et = data.get("edgeTypes", {})
        if et:
            print("\nEdge types:")
            for t, c in sorted(et.items(), key=lambda x: -x[1]):
                print(f"  {t}: {c}")


def cmd_add_node(args):
    client = _client(args)
    props = json.loads(args.properties) if args.properties else None
    data = client.add_node(args.label, args.type, args.reason, properties=props)
    _output(args, data)


def cmd_edit_node(args):
    client = _client(args)
    props = json.loads(args.properties)
    data = client.edit_node(args.id, args.reason, props)
    _output(args, data)


def cmd_delete_node(args):
    client = _client(args)
    data = client.delete_node(args.id, args.reason)
    _output(args, data)


def cmd_add_edge(args):
    client = _client(args)
    props = json.loads(args.properties) if args.properties else None
    data = client.add_edge(args.source, args.target, args.edge_type, args.reason, properties=props)
    _output(args, data)


def cmd_edit_edge(args):
    client = _client(args)
    props = json.loads(args.properties)
    data = client.edit_edge(args.id, args.reason, props)
    _output(args, data)


def cmd_delete_edge(args):
    client = _client(args)
    data = client.delete_edge(args.id, args.reason)
    _output(args, data)


def cmd_proposals(args):
    client = _client(args)
    data = client.list_proposals(status=args.status, limit=args.n)
    if args.json:
        print(json.dumps(data, indent=2, default=str))
    else:
        for p in data:
            status = p.get("status", "?")
            ptype = p.get("type", "?")
            pid = p.get("id", "?")[:8]
            reason = p.get("reason", "")
            author = p.get("authorName", "?")
            print(f"  [{status}] {ptype} by {author} — {reason}  ({pid}...)")


def cmd_approve(args):
    client = _client(args)
    data = client.approve_proposal(args.id, comment=args.comment or "")
    _output(args, data)


def cmd_reject(args):
    client = _client(args)
    data = client.reject_proposal(args.id, comment=args.comment or "")
    _output(args, data)


def cmd_audit(args):
    client = _client(args)
    data = client.audit_log(limit=args.n, target_node_id=args.node)
    if args.json:
        print(json.dumps(data, indent=2, default=str))
    else:
        for e in data:
            action = e.get("action", "?")
            user = e.get("userName", "?")
            node = e.get("targetNodeId", "")
            ts = e.get("createdAt", "")
            print(f"  {ts}  {action}  by {user}  node={node}")


def main():
    parser = argparse.ArgumentParser(
        prog="graphoni",
        description="CLI for the Graphoni graph wiki",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--url", default=None, help="Server URL (default: $GRAPHONI_URL or http://localhost:3001)")
    parser.add_argument("--api-key", default=None, help="API key (default: $GRAPHONI_API_KEY)")
    parser.add_argument("--json", "-j", action="store_true", help="Output raw JSON")

    sub = parser.add_subparsers(dest="command")

    # search
    p = sub.add_parser("search", help="Search nodes")
    p.add_argument("query", help="Search query")
    p.add_argument("-n", type=int, default=20, help="Max results (default: 20)")
    p.add_argument("--types", help="Comma-separated node types to filter")
    p.set_defaults(func=cmd_search)

    # node
    p = sub.add_parser("node", help="Get node and neighborhood")
    p.add_argument("id", help="Node ID")
    p.add_argument("--hops", type=int, default=1, help="Hops to expand (default: 1)")
    p.set_defaults(func=cmd_node)

    # path
    p = sub.add_parser("path", help="Find shortest path")
    p.add_argument("from_node", help="Source node ID")
    p.add_argument("to_node", help="Target node ID")
    p.add_argument("--max-length", type=int, default=6, help="Max path length (default: 6)")
    p.set_defaults(func=cmd_path)

    # stats
    p = sub.add_parser("stats", help="Graph statistics")
    p.set_defaults(func=cmd_stats)

    # add-node
    p = sub.add_parser("add-node", help="Submit add-node proposal")
    p.add_argument("--label", required=True, help="Node label")
    p.add_argument("--type", required=True, help="Node type")
    p.add_argument("--reason", required=True, help="Reason for the change")
    p.add_argument("--properties", help="Additional properties as JSON string")
    p.set_defaults(func=cmd_add_node)

    # edit-node
    p = sub.add_parser("edit-node", help="Submit edit-node proposal")
    p.add_argument("id", help="Node ID")
    p.add_argument("--reason", required=True, help="Reason for the change")
    p.add_argument("--properties", required=True, help="Properties as JSON string")
    p.set_defaults(func=cmd_edit_node)

    # delete-node
    p = sub.add_parser("delete-node", help="Submit delete-node proposal")
    p.add_argument("id", help="Node ID")
    p.add_argument("--reason", required=True, help="Reason for the change")
    p.set_defaults(func=cmd_delete_node)

    # add-edge
    p = sub.add_parser("add-edge", help="Submit add-edge proposal")
    p.add_argument("--source", required=True, help="Source node ID")
    p.add_argument("--target", required=True, help="Target node ID")
    p.add_argument("--edge-type", required=True, help="Edge type")
    p.add_argument("--reason", required=True, help="Reason for the change")
    p.add_argument("--properties", help="Additional properties as JSON string")
    p.set_defaults(func=cmd_add_edge)

    # edit-edge
    p = sub.add_parser("edit-edge", help="Submit edit-edge proposal")
    p.add_argument("id", help="Edge ID")
    p.add_argument("--reason", required=True, help="Reason for the change")
    p.add_argument("--properties", required=True, help="Properties as JSON string")
    p.set_defaults(func=cmd_edit_edge)

    # delete-edge
    p = sub.add_parser("delete-edge", help="Submit delete-edge proposal")
    p.add_argument("id", help="Edge ID")
    p.add_argument("--reason", required=True, help="Reason for the change")
    p.set_defaults(func=cmd_delete_edge)

    # proposals
    p = sub.add_parser("proposals", help="List proposals")
    p.add_argument("--status", help="Filter by status (pending, approved, rejected, applied, failed)")
    p.add_argument("-n", type=int, default=50, help="Max results (default: 50)")
    p.set_defaults(func=cmd_proposals)

    # approve
    p = sub.add_parser("approve", help="Approve a proposal")
    p.add_argument("id", help="Proposal ID")
    p.add_argument("--comment", help="Review comment")
    p.set_defaults(func=cmd_approve)

    # reject
    p = sub.add_parser("reject", help="Reject a proposal")
    p.add_argument("id", help="Proposal ID")
    p.add_argument("--comment", help="Review comment")
    p.set_defaults(func=cmd_reject)

    # audit
    p = sub.add_parser("audit", help="View audit log")
    p.add_argument("--node", help="Filter by target node ID")
    p.add_argument("-n", type=int, default=50, help="Max results (default: 50)")
    p.set_defaults(func=cmd_audit)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    try:
        args.func(args)
    except GraphoniError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
