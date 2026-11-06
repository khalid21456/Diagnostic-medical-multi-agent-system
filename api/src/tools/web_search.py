from ddgs import DDGS
from langchain.tools import tool


@tool
def web_search(query: str, num_results: int = 5) -> str:
    """
    Search the web using DuckDuckGo.

    Args:
        query: Search query string
        num_results: Number of results to return (default 5)
    Returns:
        Formatted search results with titles, descriptions and URLs
    """
    try:
        print(f"Search tool is called for {query}")
        results = DDGS().text(query=query, max_results=num_results, backend="google")
        if not results:
            return f"No results found for {query}"
        formatted_results = [f"Search for {query}:"]
        for i, result in enumerate(results, 1):
            title = result.get("title", "No Title")
            body = result.get("body", "No description available")
            href = result.get("href", "")
            formatted_results.append(f"{i}. **{title}**. {body}. {href}")
        return "\n".join(formatted_results)
    except Exception as e:
        print(str(e))
        return f"Web search failed: {e}"
