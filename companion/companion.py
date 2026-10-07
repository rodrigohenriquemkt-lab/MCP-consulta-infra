"""App companheiro do copiloto Gantech (Windows).

Detecta reunião (Teams/Zoom/Meet), abre a janela privada do agente e captura MICROFONE (= você) e
ÁUDIO DO SISTEMA (= cliente), entregando o áudio ao motor de transcrição (stt.py) e enviando o TEXTO
ao agente. Sem motor configurado (STT_ENGINE vazio) roda em modo texto: só inicia a sessão e o
texto chega por outra via (POST /ingest/:id). Nenhum bot entra na reunião.

NÃO TESTADO em máquina real (o ambiente de desenvolvimento não tem áudio nem Windows; o motor de STT ainda não existe):
espere ajustes na detecção e nos dispositivos de áudio no primeiro uso. Use fone de ouvido,
senão o microfone capta a voz do cliente vinda do alto-falante e duplica a transcrição.
"""
import os, queue, threading, time, webbrowser
import numpy as np, psutil, requests
from stt import load_engine

AGENT = os.environ.get("COPILOT_URL", "http://localhost:3100").rstrip("/")
TOKEN = os.environ.get("INGEST_TOKEN", "")
ME = os.environ.get("USER_LABEL", "Rodrigo")
OTHER = os.environ.get("OTHER_LABEL", "Cliente")
SR = 16000
HDR = {"x-ingest-token": TOKEN}

# --- detecção de reunião (heurística; ajuste ao seu ambiente) ---------------------------------
def meeting_title():
    """Retorna o título da janela de reunião ativa, ou None."""
    try:
        import pygetwindow as gw
        titles = [t for t in gw.getAllTitles() if t]
    except Exception:
        titles = []
    procs = {p.name().lower() for p in psutil.process_iter(["name"])}
    for t in titles:
        low = t.lower()
        if "meet -" in low or "meet.google.com" in low:               # Google Meet (no navegador)
            return t
        if "zoom meeting" in low or "reunião do zoom" in low:         # Zoom
            return t
        if ("| microsoft teams" in low and ("reunião" in low or "meeting" in low)):  # Teams
            return t
    if "cpthost.exe" in procs:                                        # Zoom: só existe em reunião
        return "Zoom Meeting"
    return None

# --- captura ----------------------------------------------------------------------------------
def to_mono16k(data, rate, channels):
    x = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1: x = x.reshape(-1, channels).mean(axis=1)
    if rate != SR: x = np.interp(np.linspace(0, len(x), int(len(x) * SR / rate), endpoint=False), np.arange(len(x)), x)
    return x

def start_capture(engine, stop):
    """Captura contínua: mic -> "Rodrigo"; áudio do sistema -> "Cliente". Sem VAD aqui (o motor decide)."""
    import sounddevice as sd, pyaudiowpatch as pa
    def mic():
        with sd.InputStream(samplerate=SR, channels=1, dtype="int16", blocksize=1600,
                            callback=lambda d, *_: engine.push(ME, d[:, 0].tobytes())):
            while not stop.is_set(): time.sleep(0.2)
    def loopback():
        p = pa.PyAudio()
        w = p.get_host_api_info_by_type(pa.paWASAPI)
        dev = p.get_device_info_by_index(w["defaultOutputDevice"])
        if not dev.get("isLoopbackDevice"):
            dev = next(d for d in p.get_loopback_device_info_generator() if dev["name"] in d["name"])
        ch, rate = dev["maxInputChannels"], int(dev["defaultSampleRate"])
        def cb(data, *_):
            engine.push(OTHER, (to_mono16k(data, rate, ch) * 32767).astype(np.int16).tobytes())
            return (None, pa.paContinue)
        st = p.open(format=pa.paInt16, channels=ch, rate=rate, input=True, input_device_index=dev["index"],
                    frames_per_buffer=rate // 10, stream_callback=cb)
        while not stop.is_set(): time.sleep(0.2)
        st.close(); p.terminate()
    for f in (mic, loopback): threading.Thread(target=f, daemon=True).start()

def send_text(session, speaker, text):
    try: requests.post(f"{AGENT}/ingest/{session}", json={"speaker": speaker, "text": text}, headers=HDR, timeout=10)
    except requests.RequestException as e: print("falha ao enviar:", e)

# --- laço principal ---------------------------------------------------------------------------
def main():
    engine = load_engine(os.environ.get("STT_ENGINE", ""))
    modo = f"áudio ({os.environ['STT_ENGINE']})" if engine else "texto (sem captura de áudio; texto via POST /ingest/:id)"
    print(f"Companheiro ativo. Agente: {AGENT}. Modo: {modo}. Aguardando reunião...")
    stop, session, last_seen = None, None, 0
    while True:
        title = meeting_title()
        if title: last_seen = time.time()
        if title and not session:
            # A sessão e a janela privada abrem NA HORA; o contexto do cliente chega em segundo plano.
            r = requests.post(f"{AGENT}/meetings", json={"titulo": title}, headers=HDR, timeout=15).json()
            session, stop = r["sessionId"], threading.Event()
            url = f"{AGENT}{r['console']}" + (f"?token={os.environ['CONSOLE_TOKEN']}" if os.environ.get("CONSOLE_TOKEN") else "")
            print("Reunião detectada:", title, "\nConsole:", url); webbrowser.open(url)
            if engine:
                engine.start([ME, OTHER], lambda spk, txt, s=session: send_text(s, spk, txt))
                start_capture(engine, stop)
        elif session and time.time() - last_seen > 60:   # reunião acabou
            stop.set()
            if engine: engine.stop()
            session = None; print("Reunião encerrada.")
        time.sleep(5)

if __name__ == "__main__":
    main()
