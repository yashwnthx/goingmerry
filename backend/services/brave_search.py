"""Brave Search Service"""
import httpx
from datetime import datetime
from typing import Optional


class BraveSearchClient:
    BASE_URL = "https://api.search.brave.com/res/v1"
    
    FRESH_KEYWORDS = ["latest", "recent", "new", "upcoming", "released", "2025", "2026", "this year", "this month"]
    MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", 
              "september", "october", "november", "december", "jan", "feb", "mar", "apr", 
              "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": api_key
        }
    
    def _detect_freshness(self, query: str) -> Optional[str]:
        query_lower = query.lower()
        current_year = datetime.now().year
        
        if str(current_year) in query or str(current_year - 1) in query:
            return "pw"
        
        if any(month in query_lower for month in self.MONTHS):
            return "pm"
        
        if any(kw in query_lower for kw in self.FRESH_KEYWORDS):
            return "pm"
        
        return None
    
    async def search(self, query: str, count: int = 10, freshness: Optional[str] = None) -> list[dict]:
        if freshness is None:
            freshness = self._detect_freshness(query)
        
        params = {"q": query, "count": min(count, 20)}
        if freshness:
            params["freshness"] = freshness
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/web/search",
                    headers=self.headers,
                    params=params,
                    timeout=15.0
                )
                response.raise_for_status()
                data = response.json()
                
                return [
                    {
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "description": r.get("description", ""),
                        "age": r.get("age", ""),
                    }
                    for r in data.get("web", {}).get("results", [])[:count]
                ]
        except Exception:
            return []
    
    async def search_for_context(self, topic: str, num_results: int = 10) -> str:
        results = await self.search(topic, count=num_results)
        if not results:
            return ""
        
        parts = ["## Web Search Results (USE ONLY THIS DATA):\n"]
        for i, result in enumerate(results, 1):
            age_info = f" ({result['age']})" if result.get('age') else ""
            parts.append(f"### Source {i}: {result['title']}{age_info}")
            parts.append(f"URL: {result['url']}")
            parts.append(f"Content: {result['description']}\n")
        
        parts.append("\n## IMPORTANT: Only use information from the sources above. Do not make up data.")
        return "\n".join(parts)


_search_client: Optional[BraveSearchClient] = None


def get_search_client() -> BraveSearchClient:
    global _search_client
    if _search_client is None:
        from config import get_config
        _search_client = BraveSearchClient(get_config().search.api_key)
    return _search_client
