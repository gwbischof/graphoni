"""
MCP server for the Graphoni graph wiki.

Provides tools to search, query, and edit a Graphoni knowledge graph
through the REST API. Configure via environment variables:

    GRAPHONI_URL      Server URL (default: http://localhost:3001)
    GRAPHONI_API_KEY  API key for authenticated operations
"""

from mcp.server.fastmcp import FastMCP
from client import GraphoniClient

mcp = FastMCP("graphoni")


# ── Read tools (guest, no auth needed) ──


@mcp.tool()
def search(query: str, limit: int = 20, types: str | None = None) -> list[dict]:
    """
    Text search for nodes by label, ID, name, or notes.

    Args:
        query: Search text (substring match).
        limit: Maximum results to return (default: 20).
        types: Comma-separated node types to filter (e.g. "Person,Organization").

    Returns:
        List of matching nodes with their properties.
    """
    client = GraphoniClient()
    type_list = types.split(",") if types else None
    return client.search(query, limit=limit, types=type_list)


@mcp.tool()
def get_node(node_id: str, hops: int = 1, limit: int = 100) -> dict:
    """
    Get a node and its neighborhood (connected nodes and edges).

    Args:
        node_id: The node ID to look up.
        hops: How many hops to expand (default: 1, max: 3).
        limit: Maximum elements to return (default: 100).

    Returns:
        Dict with elements (nodes and edges) in Cytoscape format.
    """
    client = GraphoniClient()
    return client.get_node(node_id, hops=hops, limit=limit)


@mcp.tool()
def find_path(from_node: str, to_node: str, max_length: int = 6) -> dict:
    """
    Find the shortest path between two nodes.

    Args:
        from_node: Source node ID.
        to_node: Target node ID.
        max_length: Maximum path length in hops (default: 6).

    Returns:
        Dict with path elements, pathLength, and node/edge counts.
    """
    client = GraphoniClient()
    return client.find_path(from_node, to_node, max_length=max_length)


@mcp.tool()
def stats() -> dict:
    """
    Get graph statistics: total node/edge counts and counts by type.

    Returns:
        Dict with nodeCount, edgeCount, nodeTypes, edgeTypes.
    """
    client = GraphoniClient()
    return client.stats()


# ── Complex query (mod+) ──


@mcp.tool()
def query(
    type: str,
    node_types: list[str] | None = None,
    filters: dict | None = None,
    center_node: str | None = None,
    hops: int | None = None,
    cypher: str | None = None,
    q: str | None = None,
    community_id: str | None = None,
    level: int | None = None,
    limit: int = 5000,
) -> dict:
    """
    Execute a complex graph query. Supports four query types:

    - structured: Find nodes matching filters, optionally around a center node.
      Use type="structured" with node_types, filters, center_node, hops.
    - cypher: Run a raw Cypher query. Use type="cypher" with cypher="MATCH ...".
    - search: Text search via the query endpoint. Use type="search" with q="text".
    - community: Get community members. Use type="community" with community_id.

    Args:
        type: Query type — "structured", "cypher", "search", or "community".
        node_types: Node types to filter (structured queries).
        filters: Property filters (structured queries).
        center_node: Center node ID for neighborhood queries (structured).
        hops: Hops from center node (structured).
        cypher: Cypher query string (cypher queries).
        q: Search text (search queries).
        community_id: Community ID (community queries).
        level: Community level (community queries).
        limit: Maximum results (default: 5000).

    Returns:
        Dict with elements and counts.
    """
    query_dict: dict = {"type": type}
    if node_types is not None:
        query_dict["nodeTypes"] = node_types
    if filters is not None:
        query_dict["filters"] = filters
    if center_node is not None:
        query_dict["centerNode"] = center_node
    if hops is not None:
        query_dict["hops"] = hops
    if cypher is not None:
        query_dict["cypher"] = cypher
    if q is not None:
        query_dict["q"] = q
    if community_id is not None:
        query_dict["communityId"] = community_id
    if level is not None:
        query_dict["level"] = level

    client = GraphoniClient()
    return client.query(query_dict, limit=limit)


# ── Proposal tools (user+) ──


@mcp.tool()
def add_node(
    label: str,
    node_type: str,
    reason: str,
    properties: dict | None = None,
) -> dict:
    """
    Submit a proposal to add a new node to the graph.

    Args:
        label: Display label for the node.
        node_type: Type of node (e.g. "Person", "Organization", "Location").
        reason: Reason for adding this node.
        properties: Optional additional properties.

    Returns:
        The created proposal.
    """
    client = GraphoniClient()
    return client.add_node(label, node_type, reason, properties=properties)


@mcp.tool()
def edit_node(node_id: str, reason: str, properties: dict) -> dict:
    """
    Submit a proposal to edit an existing node.

    Args:
        node_id: ID of the node to edit.
        reason: Reason for the edit.
        properties: Properties to update (merged with existing).

    Returns:
        The created proposal.
    """
    client = GraphoniClient()
    return client.edit_node(node_id, reason, properties)


@mcp.tool()
def delete_node(node_id: str, reason: str) -> dict:
    """
    Submit a proposal to delete a node.

    Args:
        node_id: ID of the node to delete.
        reason: Reason for deletion.

    Returns:
        The created proposal.
    """
    client = GraphoniClient()
    return client.delete_node(node_id, reason)


@mcp.tool()
def add_edge(
    source: str,
    target: str,
    edge_type: str,
    reason: str,
    properties: dict | None = None,
) -> dict:
    """
    Submit a proposal to add a new edge between two nodes.

    Args:
        source: Source node ID.
        target: Target node ID.
        edge_type: Type of edge (e.g. "KNOWS", "EMPLOYED_BY", "MONEY").
        reason: Reason for adding this edge.
        properties: Optional additional properties.

    Returns:
        The created proposal.
    """
    client = GraphoniClient()
    return client.add_edge(source, target, edge_type, reason, properties=properties)


@mcp.tool()
def edit_edge(edge_id: str, reason: str, properties: dict) -> dict:
    """
    Submit a proposal to edit an existing edge.

    Args:
        edge_id: ID of the edge to edit.
        reason: Reason for the edit.
        properties: Properties to update.

    Returns:
        The created proposal.
    """
    client = GraphoniClient()
    return client.edit_edge(edge_id, reason, properties)


@mcp.tool()
def delete_edge(edge_id: str, reason: str) -> dict:
    """
    Submit a proposal to delete an edge.

    Args:
        edge_id: ID of the edge to delete.
        reason: Reason for deletion.

    Returns:
        The created proposal.
    """
    client = GraphoniClient()
    return client.delete_edge(edge_id, reason)


# ── Review tools (mod+) ──


@mcp.tool()
def list_proposals(
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """
    List edit proposals, optionally filtered by status.

    Args:
        status: Filter by status (pending, approved, rejected, applied, failed).
        limit: Maximum results (default: 50).
        offset: Results to skip (default: 0).

    Returns:
        List of proposals.
    """
    client = GraphoniClient()
    return client.list_proposals(status=status, limit=limit, offset=offset)


@mcp.tool()
def approve_proposal(proposal_id: str, comment: str = "") -> dict:
    """
    Approve a pending proposal. The proposed change will be auto-applied
    to the graph via Cypher.

    Args:
        proposal_id: UUID of the proposal to approve.
        comment: Optional review comment.

    Returns:
        The updated proposal with apply result.
    """
    client = GraphoniClient()
    return client.approve_proposal(proposal_id, comment=comment)


@mcp.tool()
def reject_proposal(proposal_id: str, comment: str = "") -> dict:
    """
    Reject a pending proposal.

    Args:
        proposal_id: UUID of the proposal to reject.
        comment: Optional review comment.

    Returns:
        The updated proposal.
    """
    client = GraphoniClient()
    return client.reject_proposal(proposal_id, comment=comment)


def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
