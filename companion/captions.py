"""Leitura das LEGENDAS ao vivo do próprio Teams/Zoom/Meet (sem áudio, sem motor de STT).

Duas peças:
  • CaptionStream: lógica genérica e TESTADA que transforma "o que está visível na tela de legendas"
    (linhas que crescem e são corrigidas no lugar) em falas FINAIS, sem duplicar nem perder trecho.
  • READERS: leitores por aplicativo que devolvem o snapshot das legendas visíveis
    [(falante, texto), ...]. Ficam VAZIOS até serem calibrados com a saída do probe.py numa
    reunião real: não adivinhamos seletores/elementos de interface.
"""
import re, time
from difflib import SequenceMatcher
from typing import Callable, Iterable, Tuple

def _n(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

class CaptionStream:
    def __init__(self, on_line: Callable[[str, str], None], settle: float = 2.0):
        self.on_line, self.settle, self.entries = on_line, settle, []

    def _match(self, speaker, text, taken):
        for e in reversed(self.entries):
            if e["speaker"] != speaker or id(e) in taken:
                continue
            a = e["text"]
            if text.startswith(a) or a.startswith(text) or SequenceMatcher(None, a, text).ratio() > 0.6:
                return e
        return None

    def _flush(self, e):
        if len(e["text"]) > e["emitted"]:
            out = e["text"][e["emitted"]:].strip()
            e["emitted"] = len(e["text"])
            if out:
                self.on_line(e["speaker"], out)

    def feed(self, snapshot: Iterable[Tuple[str, str]], now: float = None):
        now = time.time() if now is None else now
        taken = set()
        for speaker, raw in snapshot:
            text = _n(raw)
            if not text:
                continue
            e = self._match(speaker, text, taken)
            if e is None:
                e = {"speaker": speaker, "text": text, "emitted": 0, "changed": now}
                self.entries.append(e)
            elif text != e["text"]:
                e["emitted"] = min(e["emitted"], len(os_common_prefix(e["text"], text)))
                e["text"], e["changed"] = text, now
            taken.add(id(e))
        keep = []
        for e in self.entries:
            gone = id(e) not in taken
            if gone or now - e["changed"] >= self.settle:
                self._flush(e)
            if not gone:
                keep.append(e)
        self.entries = keep

def os_common_prefix(a: str, b: str) -> str:
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    return a[:i]

# nome -> função snapshot() -> [(falante, texto)]. Preencher após calibrar com probe.py.
READERS: dict = {}

def load_reader(name: str):
    if not name:
        return None  # modo texto: o texto chega por outra via (POST /ingest/:id)
    if name not in READERS:
        raise SystemExit(f"Leitor de legendas '{name}' não calibrado. Disponíveis: {list(READERS) or 'nenhum'}. Rode probe.py.")
    return READERS[name]
