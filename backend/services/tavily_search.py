"""Tavily Search Service"""
import httpx
from typing import Optional


class TavilyClient:
    BASE_URL = "https://api.tavily.com"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def search(self, query: str, max_results: int = 10, search_depth: str = "advanced") -> list[dict]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.BASE_URL}/search",
                    json={
                        "api_key": self.api_key,
                        "query": query,
                        "search_depth": search_depth,
                        "max_results": max_results,
                        "include_answer": True,
                        "include_raw_content": False,
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                return {
                    "answer": data.get("answer", ""),
                    "results": [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("url", ""),
                            "content": r.get("content", ""),
                            "score": r.get("score", 0),
                        }
                        for r in data.get("results", [])
                    ]
                }
        except Exception as e:
            print(f"[!] Tavily search error: {e}")
            return {"answer": "", "results": []}
    
    async def search_for_context(self, topic: str, num_results: int = 10) -> str:
        data = await self.search(topic, max_results=num_results)
        
        if not data.get("results") and not data.get("answer"):
            return ""
        
        parts = ["## Web Search Results:\n"]
        
        if data.get("answer"):
            parts.append(f"### AI Summary:\n{data['answer']}\n")
        
        for i, result in enumerate(data.get("results", []), 1):
            parts.append(f"### Source {i}: {result['title']}")
            parts.append(f"URL: {result['url']}")
            parts.append(f"Content: {result['content']}\n")
        
        parts.append("\n## Use ONLY the information above. Do not invent data.")
        return "\n".join(parts)


_tavily_client: Optional[TavilyClient] = None


def get_tavily_client() -> TavilyClient:
    global _tavily_client
    if _tavily_client is None:
        from config import get_config
        _tavily_client = TavilyClient(get_config().search.tavily_api_key)
    return _tavily_client
