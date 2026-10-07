"""Calibração: descobre ONDE o texto das legendas aparece na interface do app de reunião.

Uso (Windows), numa reunião real COM AS LEGENDAS LIGADAS e alguém falando:
    pip install uiautomation
    python probe.py "Microsoft Teams"      # ou "Zoom" / "Meet"
Gera probe-<nome>.txt com a árvore de elementos da janela. Envie esse arquivo (apague dados sensíveis
antes, se houver) para escrevermos o leitor do app com os elementos reais.
Obs.: aplicativos baseados em Chromium (Teams novo, Meet no navegador) às vezes só expõem a árvore
de acessibilidade depois da primeira consulta; se vier vazia, rode de novo após ~10s.
"""
import re, sys

def main():
    import uiautomation as auto
    hint = (sys.argv[1] if len(sys.argv) > 1 else "Teams").lower()
    wins = [w for w in auto.GetRootControl().GetChildren() if hint in (w.Name or "").lower()]
    if not wins:
        raise SystemExit(f"Nenhuma janela com '{hint}' no título.")
    out = f"probe-{re.sub(r'[^a-z0-9]+', '-', hint)}.txt"
    n = 0
    with open(out, "w", encoding="utf-8") as f:
        def walk(c, d=0):
            nonlocal n
            if d > 25 or n > 6000:
                return
            n += 1
            f.write(f"{'  ' * d}{c.ControlTypeName} | name={(c.Name or '')[:160]!r} | id={c.AutomationId!r} | class={c.ClassName!r}\n")
            for ch in c.GetChildren():
                walk(ch, d + 1)
        for w in wins:
            f.write(f"=== JANELA: {w.Name!r}\n")
            walk(w)
    print(f"{n} elementos gravados em {out}")

if __name__ == "__main__":
    main()
