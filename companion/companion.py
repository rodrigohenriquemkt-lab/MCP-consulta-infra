"""App companheiro do copiloto Gantech (Windows).

Detecta a reunião (Teams/Zoom/Meet), abre NA HORA a janela privada do agente e envia o texto das
LEGENDAS ao vivo do próprio aplicativo (captions.py). Sem áudio, sem motor de transcrição, sem bot.
Sem leitor calibrado (CAPTIONS_READER vazio) roda em modo texto: só inicia a sessão e o texto chega
por outra via (POST /ingest/:id).

NÃO TESTADO em máquina real: a detecção é heurística e os leitores de legenda dependem da calibração
com probe.py. As legendas precisam estar LIGADAS na reunião.
"""
import os, threading, time, webbrowser
import psutil, requests
from captions import CaptionStream, load_reader

AGENT = os.environ.get("COPILOT_URL", "http://localhost:3100").rstrip("/")
HDR = {"x-ingest-token": os.environ.get("INGEST_TOKEN", "")}
POLL = float(os.environ.get("CAPTIONS_POLL_SECONDS", "0.5"))

def meeting_title():
    """Retorna o título da janela de reunião ativa, ou None (heurística; ajuste ao seu ambiente)."""
    try:
        import pygetwindow as gw
        titles = [t for t in gw.getAllTitles() if t]
    except Exception:
        titles = []
    procs = {p.name().lower() for p in psutil.process_iter(["name"])}
    for t in titles:
        low = t.lower()
        if "meet -" in low or "meet.google.com" in low:
            return t
        if "zoom meeting" in low or "reunião do zoom" in low:
            return t
        if "| microsoft teams" in low and ("reunião" in low or "meeting" in low):
            return t
    return "Zoom Meeting" if "cpthost.exe" in procs else None  # Zoom: só existe durante reunião

def send_text(session, speaker, text):
    try:
        requests.post(f"{AGENT}/ingest/{session}", json={"speaker": speaker, "text": text}, headers=HDR, timeout=10)
    except requests.RequestException as e:
        print("falha ao enviar:", e)

def read_captions(snapshot, session, stop):
    stream = CaptionStream(lambda spk, txt: send_text(session, spk, txt))
    while not stop.is_set():
        try:
            stream.feed(snapshot())
        except Exception as e:  # a interface do app pode mudar; não derruba o companheiro
            print("leitura de legendas falhou:", e)
        time.sleep(POLL)
    stream.feed([])  # descarrega o que ficou pendente

def main():
    snapshot = load_reader(os.environ.get("CAPTIONS_READER", ""))
    modo = f"legendas ({os.environ['CAPTIONS_READER']})" if snapshot else "texto (via POST /ingest/:id)"
    print(f"Companheiro ativo. Agente: {AGENT}. Modo: {modo}. Aguardando reunião...")
    stop, session, last_seen = None, None, 0
    while True:
        title = meeting_title()
        if title:
            last_seen = time.time()
        if title and not session:
            # Sessão e janela privada abrem NA HORA; o contexto do cliente chega em segundo plano.
            r = requests.post(f"{AGENT}/meetings", json={"titulo": title}, headers=HDR, timeout=15).json()
            session, stop = r["sessionId"], threading.Event()
            tok = os.environ.get("CONSOLE_TOKEN")
            url = f"{AGENT}{r['console']}" + (f"?token={tok}" if tok else "")
            print("Reunião detectada:", title, "\nConsole:", url)
            webbrowser.open(url)
            if snapshot:
                threading.Thread(target=read_captions, args=(snapshot, session, stop), daemon=True).start()
        elif session and time.time() - last_seen > 60:
            stop.set()
            session = None
            print("Reunião encerrada.")
        time.sleep(5)

if __name__ == "__main__":
    main()
