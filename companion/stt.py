"""Ponto de encaixe do motor de transcrição (STT). Whisper foi removido do projeto.

Contrato: o app entrega áudio PCM int16, 16 kHz, mono, em fluxo contínuo, separado por falante
("Rodrigo" = microfone, "Cliente" = áudio do sistema). O motor devolve texto FINAL por falante
via on_text(speaker, text). Motores de streaming cuidam do próprio VAD/segmentação.

Para adicionar um motor: crie uma classe com start/push/stop e registre-a em ENGINES.
"""
from typing import Callable

class Engine:
    def start(self, speakers: list, on_text: Callable[[str, str], None]) -> None: ...
    def push(self, speaker: str, pcm16: bytes) -> None: ...
    def stop(self) -> None: ...

ENGINES: dict = {}  # nome -> classe. Vazio de propósito até o motor ser escolhido.

def load_engine(name: str):
    if not name:
        return None  # modo texto: sem captura de áudio; o texto chega por POST /ingest/:id
    if name not in ENGINES:
        raise SystemExit(f"Motor de transcrição '{name}' não implementado. Disponíveis: {list(ENGINES) or 'nenhum'}")
    return ENGINES[name]()
