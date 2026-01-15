"""Brave Search Service"""
import httpx
from typing import Optional


class BraveSearchClient:
    BASE_URL = "https://api.search.brave.com/res/v1"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": api_key
        }
    
    async def search(self, query: str, count: int = 5, freshness: Optional[str] = None) -> list[dict]:
        params = {"q": query, "count": min(count, 20)}
        if freshness:
            params["freshness"] = freshness
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/web/search",
                    headers=self.headers,
                    params=params,
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                results = []
                for result in data.get("web", {}).get("results", [])[:count]:
                    results.append({
                        "title": result.get("title", ""),
                        "url": result.get("url", ""),
                        "description": result.get("description", ""),
                    })
                return results
        except Exception:
            return []
    
    async def search_for_context(self, topic: str, num_results: int = 5) -> str:
        results = await self.search(topic, count=num_results)
        if not results:
            return ""
        
        parts = ["## Web Search Results:\n"]
        for i, result in enumerate(results, 1):
            parts.append(f"### Source {i}: {result['title']}")
            parts.append(f"URL: {result['url']}")
            parts.append(f"{result['description']}\n")
        return "\n".join(parts)


_search_client: Optional[BraveSearchClient] = None


def get_search_client() -> BraveSearchClient:
    global _search_client
    if _search_client is None:
        from config import get_config
        _search_client = BraveSearchClient(get_config().search.api_key)
    return _search_client
