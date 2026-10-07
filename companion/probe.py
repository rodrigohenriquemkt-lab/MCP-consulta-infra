"""Calibração: descobre ONDE o texto das legendas aparece na interface do app de reunião.

Uso (Windows), numa reunião real COM AS LEGENDAS LIGADAS e alguém falando:
    pip install uiautomation
    python probe.py "Microsoft Teams"                      # mapa geral da janela
    python probe.py "Microsoft Teams" "Legendas ao Vivo"   # desce só dentro do painel de legendas
Gera probe-<nome>[-foco].txt. Envie o arquivo (revise antes: pode conter nomes e falas).
Aplicativos baseados em Chromium (Teams novo, Meet no navegador) às vezes só expõem a árvore de
acessibilidade depois da primeira consulta; se vier vazia, rode de novo após ~10s.
"""
import re, sys

def main():
    import uiautomation as auto
    hint = (sys.argv[1] if len(sys.argv) > 1 else "Teams").lower()
    focus = sys.argv[2] if len(sys.argv) > 2 else None
    wins = [w for w in auto.GetRootControl().GetChildren() if hint in (w.Name or "").lower()]
    if not wins:
        raise SystemExit(f"Nenhuma janela com '{hint}' no título.")
    slug = re.sub(r"[^a-z0-9]+", "-", hint) + (("-" + re.sub(r"[^a-z0-9]+", "-", focus.lower())) if focus else "")
    out, n = f"probe-{slug}.txt", 0
    maxdepth, namelen = (60, 600) if focus else (25, 160)

    def extra(c):  # em modo foco, tenta ler o texto por outros padrões de acessibilidade
        bits = []
        for label, getter in (("value", lambda: c.GetValuePattern().Value),
                              ("legacy_value", lambda: c.GetLegacyIAccessiblePattern().Value),
                              ("legacy_name", lambda: c.GetLegacyIAccessiblePattern().Name),
                              ("text", lambda: c.GetTextPattern().DocumentRange.GetText(500))):
            try:
                v = getter()
                if v:
                    bits.append(f"{label}={v[:namelen]!r}")
            except Exception:
                pass
        return (" | " + " | ".join(bits)) if bits else ""

    with open(out, "w", encoding="utf-8") as f:
        def walk(c, d=0):
            nonlocal n
            if d > maxdepth or n > 8000:
                return
            n += 1
            f.write(f"{'  ' * d}{c.ControlTypeName} | name={(c.Name or '')[:namelen]!r} | id={c.AutomationId!r} | class={(c.ClassName or '')[:60]!r}{extra(c) if focus else ''}\n")
            for ch in c.GetChildren():
                walk(ch, d + 1)
        for w in wins:
            f.write(f"=== JANELA: {w.Name!r}\n")
            if focus:
                root = w.GroupControl(searchDepth=60, SubName=focus)
                if root.Exists(3, 1):
                    walk(root)
                else:
                    f.write(f"(elemento '{focus}' não encontrado nesta janela)\n")
            else:
                walk(w)
    print(f"{n} elementos gravados em {out}")

if __name__ == "__main__":
    main()
