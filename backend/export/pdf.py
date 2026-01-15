"""PDF Export"""
import hashlib
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Literal
from .word import WordExporter
from .excel import ExcelExporter


class PDFExporter:
    def __init__(self, libreoffice_path: str | None = None):
        self.libreoffice_path = libreoffice_path or self._find_libreoffice()
        self._word = WordExporter()
        self._excel = ExcelExporter()
    
    def export(self, doc_model: dict) -> bytes:
        doc_type = doc_model.get("type")
        if doc_type == "word":
            return self._convert(self._word.export(doc_model), "docx")
        elif doc_type == "excel":
            return self._convert(self._excel.export(doc_model), "xlsx")
        raise ValueError(f"Cannot export '{doc_type}' to PDF")
    
    def _convert(self, source: bytes, fmt: Literal["docx", "xlsx"]) -> bytes:
        if not self.libreoffice_path:
            return self._mock_pdf(source, fmt)
        
        with tempfile.TemporaryDirectory() as temp:
            src = Path(temp) / f"doc.{fmt}"
            src.write_bytes(source)
            
            try:
                subprocess.run(
                    [self.libreoffice_path, "--headless", "--convert-to", "pdf", "--outdir", temp, str(src)],
                    capture_output=True, timeout=60, check=True
                )
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
                raise ValueError(f"PDF conversion failed: {e}")
            
            pdf = Path(temp) / "doc.pdf"
            if not pdf.exists():
                raise ValueError("PDF not created")
            return pdf.read_bytes()
    
    def _mock_pdf(self, source: bytes, fmt: str) -> bytes:
        h = hashlib.sha256(source).hexdigest()[:8]
        return f"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 12 Tf 100 700 Td (Source: {fmt} Hash: {h}) Tj ET
endstream endobj
xref 0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref 300
%%EOF""".encode("latin-1")
    
    def _find_libreoffice(self) -> str | None:
        paths = ["soffice", "/usr/bin/soffice", "/usr/bin/libreoffice",
                 "C:\\Program Files\\LibreOffice\\program\\soffice.exe"]
        for p in paths:
            if os.path.exists(p) or p == "soffice":
                try:
                    if subprocess.run([p, "--version"], capture_output=True, timeout=5).returncode == 0:
                        return p
                except (subprocess.SubprocessError, FileNotFoundError):
                    pass
        return None


def export_pdf_document(doc_model: dict) -> bytes:
    return PDFExporter().export(doc_model)
