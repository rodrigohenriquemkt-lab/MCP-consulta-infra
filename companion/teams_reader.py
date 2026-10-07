"""Leitor das legendas ao vivo do Teams (novo Teams, Windows), via UI Automation.

Estrutura real (calibrada com probe.py em 07/10/2026): janela "... | Microsoft Teams" contém um
grupo chamado "Legendas ao Vivo"; dentro dele cada linha de legenda é um grupo de classe
"fui-ChatMessageCompact__body" com dois TextControl: [0] = "Nome | Empresa", [1] = fala.
A reunião em andamento tem o botão "Sair" (AutomationId "hangup-button").
Se a Microsoft mudar a interface, rode o probe de novo e ajuste as constantes abaixo.
"""
PANEL_NAME = "Legendas ao Vivo"
BODY_CLASS = "fui-ChatMessageCompact__body"
HANGUP_ID = "hangup-button"
LAST_N = 8  # só as últimas linhas mudam; as antigas já estão estáveis (e a leitura via UIA é lenta)

def _bodies(node, out, depth=0):
    if depth > 14:
        return
    for ch in node.GetChildren():
        if (ch.ClassName or "").startswith(BODY_CLASS):
            out.append(ch)
        else:
            _bodies(ch, out, depth + 1)

def parse_panel(panel, last_n=LAST_N):
    """Devolve [(falante, texto), ...] em ordem, das últimas `last_n` linhas visíveis."""
    bodies = []
    _bodies(panel, bodies)
    rows, last_speaker = [], ""
    for b in bodies[-last_n:]:
        texts = [c.Name for c in b.GetChildren() if c.ControlTypeName == "TextControl" and c.Name]
        if len(texts) >= 2:
            last_speaker = texts[0].split(" | ")[0].strip()
            rows.append((last_speaker, " ".join(texts[1:])))
        elif len(texts) == 1 and last_speaker:  # continuação sem cabeçalho
            rows.append((last_speaker, texts[0]))
    return rows

# --- parte que depende do Windows/uiautomation (não coberta por teste automatizado) -------------
_cache = {"panel": None}

def _teams_windows():
    import uiautomation as auto
    return [w for w in auto.GetRootControl().GetChildren() if "microsoft teams" in (w.Name or "").lower()]

def meeting_title():
    """Título da janela do Teams que tem uma reunião em andamento (botão Sair), ou None."""
    for w in _teams_windows():
        if w.ButtonControl(AutomationId=HANGUP_ID, searchDepth=40).Exists(0, 0):
            return w.Name
    return None

def snapshot():
    """Legendas visíveis agora; None se o painel de legendas não está aberto."""
    p = _cache["panel"]
    if p is not None:
        try:
            if not p.Exists(0, 0):
                p = None
        except Exception:
            p = None
    if p is None:
        for w in _teams_windows():
            c = w.GroupControl(searchDepth=60, Name=PANEL_NAME)
            if c.Exists(0, 0):
                p = c
                break
        _cache["panel"] = p
    return None if p is None else parse_panel(p)
