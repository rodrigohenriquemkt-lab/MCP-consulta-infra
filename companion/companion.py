"""App companheiro do copiloto Gantech (Windows).

Detecta a reunião (Teams/Zoom/Meet), abre NA HORA a janela privada do agente e envia o texto das
LEGENDAS ao vivo do próprio aplicativo (captions.py). Sem áudio, sem motor de transcrição, sem bot.
Leitor padrão: "teams" (calibrado). Com CAPTIONS_READER vazio roda em modo texto: só inicia a sessão e o texto chega
por outra via (POST /ingest/:id).

Teams: leitor calibrado com a árvore real da interface (testado só contra uma réplica; falta rodar
ao vivo). Zoom/Meet: ainda sem leitor. As legendas precisam estar LIGADAS na reunião.
"""
import os, threading, time, webbrowser
import psutil, requests
from captions import CaptionStream, load_reader

AGENT = os.environ.get("COPILOT_URL", "http://localhost:3100").rstrip("/")
HDR = {"x-ingest-token": os.environ.get("INGEST_TOKEN", "")}
POLL = float(os.environ.get("CAPTIONS_POLL_SECONDS", "0.5"))

def meeting_title():
    """Título da janela da reunião ativa, ou None. Teams: botão "Sair" visível (confiável).
    Zoom/Meet: heurística por título/processo (sem leitor de legendas ainda)."""
    try:
        from teams_reader import meeting_title as teams_title
        t = teams_title()
        if t:
            return t
    except Exception:
        pass  # sem uiautomation / sem Teams aberto
    try:
        import pygetwindow as gw
        titles = [t for t in gw.getAllTitles() if t]
    except Exception:
        titles = []
    for t in titles:
        low = t.lower()
        if "meet -" in low or "meet.google.com" in low or "zoom meeting" in low or "reunião do zoom" in low:
            return t
    procs = {p.name().lower() for p in psutil.process_iter(["name"])}
    return "Zoom Meeting" if "cpthost.exe" in procs else None

def send_text(session, speaker, text):
    send(session, {"speaker": speaker, "text": text})

def send(session, body):
    try:
        requests.post(f"{AGENT}/ingest/{session}", json=body, headers=HDR, timeout=10)
    except requests.RequestException as e:
        print("falha ao enviar:", e)

def read_captions(snapshot, session, stop):
    stream = CaptionStream(lambda spk, txt: send_text(session, spk, txt), skip_initial=True)
    t0, avisou, viu_painel = time.time(), False, False
    while not stop.is_set():
        try:
            snap = snapshot()
            viu_painel = viu_painel or snap is not None
            if not viu_painel and not avisou and time.time() - t0 > 20:
                avisou = True
                send(session, {"status": "Não vejo as legendas ao vivo do Teams. Ative em Mais (...) > Idioma e fala > Ativar legendas ao vivo."})
            stream.feed(snap)
        except Exception as e:  # a interface do app pode mudar; não derruba o companheiro
            print("leitura de legendas falhou:", e)
        time.sleep(POLL)
    stream.feed([])  # descarrega o que ficou pendente

def main():
    snapshot = load_reader(os.environ.get("CAPTIONS_READER", "teams"))
    modo = f"legendas ({os.environ['CAPTIONS_READER']})" if snapshot else "texto (via POST /ingest/:id)"
    print(f"Companheiro ativo. Agente: {AGENT}. Modo: {modo}. Aguardando reunião...")
    stop, session, last_seen = None, None, 0
    while True:
        title = meeting_title()
        if title:
            last_seen = time.time()
        if title and not session:
            # Sessão e janela privada abrem NA HORA; o contexto do cliente chega em segundo plano.
            try:
                resp = requests.post(f"{AGENT}/meetings", json={"titulo": title}, headers=HDR, timeout=15)
                resp.raise_for_status()
                r = resp.json()
            except requests.RequestException as e:
                print(f"Servidor do agente indisponível ({type(e).__name__}). Confira se o 'npm start' está rodando em {AGENT}. Nova tentativa em 10s.")
                time.sleep(10)
                continue
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
