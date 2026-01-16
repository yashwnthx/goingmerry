"""Groq AI Client"""
import json
from typing import Any
from groq import Groq
from config import get_config


SYSTEM_PROMPT = """You are a document generator that creates accurate, factual documents.

CRITICAL RULES FOR ACCURACY:
1. For Excel/data requests: ONLY include information found in the web search results below
2. DO NOT make up, guess, or hallucinate any data - especially dates, names, numbers
3. If information is not in the search results, mark it as "Not Found" or omit it
4. Always prefer verified information from the search results
5. Include a "source" column in Excel to indicate where data came from

For Word documents, return JSON:
{
  "document_type": "word",
  "topic": "main subject",
  "tone": "formal/casual/technical/academic",
  "sections": [{"heading": "Title", "content": "2-3 paragraphs using search data"}]
}

For Excel documents, return JSON:
{
  "document_type": "excel",
  "topic": "main subject",
  "tone": "formal",
  "columns": ["column1", "column2", "source"],
  "sample_data": [{"column1": "value from search", "column2": "value", "source": "source name"}]
}

Additional Rules:
- Word: Write clean content based on search results, cite sources at the end
- Word: Include 4-6 sections with substantial, accurate content
- Excel: Create relevant columns, always include a source column
- Excel: Include ONLY data you found in the search results
- Excel: Mark unknown/unverified data as "Not Verified" or "Not Found"
- If search results are empty or irrelevant, inform the user the data could not be verified"""

DATA_KEYWORDS = ['excel', 'spreadsheet', 'list', 'table', 'data']


class AIClient:
    def __init__(self):
        config = get_config()
        self.api_key = config.ai.api_key
        self.client = Groq(api_key=self.api_key)
        self.model_name = config.ai.model
        self._search_client = None
    
    @property
    def search_client(self):
        if self._search_client is None:
            from services.brave_search import get_search_client
            self._search_client = get_search_client()
        return self._search_client
    
    def _generate(self, prompt: str, json_mode: bool = False) -> str:
        kwargs = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "timeout": 120.0
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        
        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or "{}"

    async def parse_intent_async(self, prompt: str) -> dict:
        is_data_request = any(kw in prompt.lower() for kw in DATA_KEYWORDS)
        num_results = 10 if is_data_request else 5
        
        search_context = await self.search_client.search_for_context(prompt, num_results=num_results)
        
        if search_context:
            full_prompt = f"""{SYSTEM_PROMPT}

{search_context}

User Request: {prompt}

IMPORTANT: Base your response ONLY on the search results above. Do not invent data.
Respond with valid JSON only."""
        else:
            full_prompt = f"""{SYSTEM_PROMPT}

[No search results available - inform user that real-time data could not be fetched]

User Request: {prompt}

Respond with valid JSON only. If data cannot be verified, say so clearly."""
        
        return self._parse_json(self._generate(full_prompt, json_mode=True))
    
    def parse_intent(self, prompt: str) -> dict:
        system = "Create a document structure. Return JSON with document_type, topic, tone, and either sections (for word) or columns/sample_data (for excel)."
        return self._parse_json(self._generate(f"{system}\n\nPrompt: {prompt}", json_mode=True))
    
    def rewrite_section(self, content: str, instructions: str, preserve_heading: bool = True) -> str:
        prompt = f"Rewrite this content: {instructions}\n\nContent:\n{content}\n\nReturn only the rewritten text."
        return self._generate(prompt).strip()
    
    async def rewrite_with_search(self, content: str, instructions: str, search_query: str = None) -> str:
        context = ""
        if search_query:
            context = await self.search_client.search_for_context(search_query, num_results=3)
        prompt = f"Rewrite this content: {instructions}\n\n{context}\n\nContent:\n{content}\n\nReturn only the rewritten text."
        return self._generate(prompt).strip()
    
    def suggest_columns(self, topic: str) -> list[dict]:
        prompt = f"Suggest columns for a spreadsheet about: {topic}. Return JSON array with name and type for each column."
        parsed = self._parse_json(self._generate(prompt, json_mode=True))
        columns = parsed.get('columns', parsed) if isinstance(parsed, dict) else parsed
        return columns if isinstance(columns, list) else []

    def _parse_json(self, response: str) -> Any:
        try:
            text = response.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text.strip())
        except Exception:
            return {}


_ai_client: AIClient | None = None


def get_ai_client() -> AIClient:
    global _ai_client
    if _ai_client is None:
        _ai_client = AIClient()
    return _ai_client
