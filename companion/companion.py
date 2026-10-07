"""App companheiro do copiloto Gantech (Windows).

Detecta reunião (Teams/Zoom/Meet), captura MICROFONE (= você) e ÁUDIO DO SISTEMA (= cliente),
transcreve LOCALMENTE com faster-whisper e envia só o TEXTO ao agente. Nenhum áudio sai do PC
e nenhum bot entra na reunião.

NÃO TESTADO em máquina real (o ambiente de desenvolvimento não tem áudio nem Windows):
espere ajustes na detecção e nos dispositivos de áudio no primeiro uso. Use fone de ouvido,
senão o microfone capta a voz do cliente vinda do alto-falante e duplica a transcrição.
"""
import os, queue, threading, time, webbrowser
import numpy as np, psutil, requests

AGENT = os.environ.get("COPILOT_URL", "http://localhost:3100").rstrip("/")
TOKEN = os.environ.get("INGEST_TOKEN", "")
ME = os.environ.get("USER_LABEL", "Rodrigo")
OTHER = os.environ.get("OTHER_LABEL", "Cliente")
MODEL = os.environ.get("WHISPER_MODEL", "small")  # small/medium: equilíbrio latência x qualidade (CPU)
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

class Segmenter:
    """VAD por energia: fecha um segmento após ~0.8s de silêncio ou 25s de fala contínua."""
    def __init__(self, label, out): self.label, self.out, self.buf, self.sil, self.voiced = label, out, [], 0.0, 0.0
    def feed(self, x):
        dur, loud = len(x) / SR, float(np.sqrt((x ** 2).mean())) > 0.01
        if loud: self.buf.append(x); self.voiced += dur; self.sil = 0.0
        elif self.buf: self.buf.append(x); self.sil += dur
        if self.buf and (self.sil >= 0.8 or self.voiced >= 25):
            if self.voiced >= 0.6: self.out.put((self.label, np.concatenate(self.buf)))
            self.buf, self.sil, self.voiced = [], 0.0, 0.0

def start_capture(out, stop):
    import sounddevice as sd, pyaudiowpatch as pa
    mic_seg, sys_seg = Segmenter(ME, out), Segmenter(OTHER, out)
    def mic():
        with sd.InputStream(samplerate=SR, channels=1, dtype="float32", blocksize=1600,
                            callback=lambda d, *_: mic_seg.feed(d[:, 0].copy())):
            while not stop.is_set(): time.sleep(0.2)
    def loopback():
        p = pa.PyAudio()
        w = p.get_host_api_info_by_type(pa.paWASAPI)
        dev = p.get_device_info_by_index(w["defaultOutputDevice"])
        if not dev.get("isLoopbackDevice"):
            dev = next(d for d in p.get_loopback_device_info_generator() if dev["name"] in d["name"])
        ch, rate = dev["maxInputChannels"], int(dev["defaultSampleRate"])
        st = p.open(format=pa.paInt16, channels=ch, rate=rate, input=True, input_device_index=dev["index"],
                    frames_per_buffer=rate // 10, stream_callback=lambda d, *_: (sys_seg.feed(to_mono16k(d, rate, ch)), (None, pa.paContinue))[1])
        while not stop.is_set(): time.sleep(0.2)
        st.close(); p.terminate()
    for f in (mic, loopback): threading.Thread(target=f, daemon=True).start()

def transcriber(q, session, stop):
    from faster_whisper import WhisperModel
    model = WhisperModel(MODEL, compute_type="int8")
    while not stop.is_set() or not q.empty():
        try: label, audio = q.get(timeout=0.5)
        except queue.Empty: continue
        segs, _ = model.transcribe(audio, language="pt", vad_filter=True, beam_size=1)
        text = " ".join(s.text.strip() for s in segs).strip()
        if text:
            try: requests.post(f"{AGENT}/ingest/{session}", json={"speaker": label, "text": text}, headers=HDR, timeout=10)
            except requests.RequestException as e: print("falha ao enviar:", e)

# --- laço principal ---------------------------------------------------------------------------
def main():
    print(f"Companheiro ativo. Agente: {AGENT}. Aguardando reunião...")
    stop, session, last_seen = None, None, 0
    while True:
        title = meeting_title()
        if title: last_seen = time.time()
        if title and not session:
            r = requests.post(f"{AGENT}/meetings", json={"titulo": title}, headers=HDR, timeout=120).json()
            session, stop, q = r["sessionId"], threading.Event(), queue.Queue()
            url = f"{AGENT}{r['console']}" + (f"?token={os.environ['CONSOLE_TOKEN']}" if os.environ.get("CONSOLE_TOKEN") else "")
            print("Reunião detectada:", title, "\nConsole:", url); webbrowser.open(url)
            threading.Thread(target=transcriber, args=(q, session, stop), daemon=True).start()
            start_capture(q, stop)
        elif session and time.time() - last_seen > 60:   # reunião acabou
            stop.set(); session = None; print("Reunião encerrada.")
        time.sleep(5)

if __name__ == "__main__":
    main()
