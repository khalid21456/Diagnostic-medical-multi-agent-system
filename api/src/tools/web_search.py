from ddgs import DDGS
from langchain.tools import tool


@tool
def web_search(query: str, num_results:int=5) -> str:
    """
        Search the web usin DuckDuckGo
        Args:
        query : Search query string
            num_results : Number of results to return (Default=5)
        Returns:
        Formatted search results with titles, descptions and Urls
    """
    try:
        print(f'Search tool is called for {query}')
        ddgs_search = DDGS()
        results=ddgs_search.text(query=query, max_results=num_results, backend="google")
        if not results:
            return f"No results found for {query} "
        formatted_results = [f"Search for {query} : \n"]
        for i, result in enumerate(results,1):
            title = result.get("title","No Title")
            body = result.get("body","No description available")
            href = result.get("href","")
        formatted_results.append( f"{i}. **{title}**. {body}. {href}")
        return formatted_results
    except Exception as e:
        print(str(e))