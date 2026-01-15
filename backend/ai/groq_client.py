"""Groq AI Client"""
import json
from typing import Any
from groq import Groq
from config import get_config


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
        search_context = await self.search_client.search_for_context(prompt, num_results=5)
        
        system_prompt = """You are a document generator. Create a complete document structure.

For Word documents, return JSON:
{
  "document_type": "word",
  "topic": "main subject",
  "tone": "formal/casual/technical/academic",
  "sections": [{"heading": "Title", "content": "2-3 paragraphs"}]
}

For Excel documents, return JSON:
{
  "document_type": "excel",
  "topic": "main subject",
  "tone": "formal",
  "columns": ["column1", "column2"],
  "sample_data": [{"column1": "value", "column2": "value"}]
}

Rules:
- Word: Write clean content WITHOUT URLs or citations inline
- Word: Include 4-6 sections with substantial content
- Excel: Create relevant columns, no duplicate names
- Excel: Use specified date format if requested
- Excel: Include 5-10 rows of data"""
        
        if search_context:
            full_prompt = f"{system_prompt}\n\n{search_context}\n\nUser prompt: {prompt}\n\nRespond with valid JSON only."
        else:
            full_prompt = f"{system_prompt}\n\nUser prompt: {prompt}\n\nRespond with valid JSON only."
        
        return self._parse_json(self._generate(full_prompt, json_mode=True))
    
    def parse_intent(self, prompt: str) -> dict:
        system_prompt = """Create a document structure. Return JSON with document_type, topic, tone, and either sections (for word) or columns/sample_data (for excel)."""
        return self._parse_json(self._generate(f"{system_prompt}\n\nPrompt: {prompt}", json_mode=True))
    
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
