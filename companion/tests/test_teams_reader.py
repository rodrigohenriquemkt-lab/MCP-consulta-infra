import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from teams_reader import parse_panel

class N:  # nó falso que imita a árvore UIA vista no probe real
    def __init__(self, cls="", typ="GroupControl", name="", kids=()):
        self.ClassName, self.ControlTypeName, self.Name, self._k = cls, typ, name, list(kids)
    def GetChildren(self): return self._k

def body(spk, *falas):
    t = [N(typ="TextControl", name=spk)] + [N(typ="TextControl", name=f) for f in falas]
    return [N(cls="___87nhvx0 lpcCommonWeb-hoverTarget"), N(cls="fui-ChatMessageCompact__body ___10lx575", kids=t)]

def panel(*blocos):
    itens = [x for b in blocos for x in b] + [N(cls="fui-Primitive"), N(cls="fui-Primitive")]
    return N(name="Legendas ao Vivo", kids=[N(kids=[N(kids=[N(kids=itens)])])])

class T(unittest.TestCase):
    def test_le_falante_sem_empresa_e_texto(self):
        p = panel(body("Alice Silva | Gantech", "Vamos fechar?"), body("Rodrigo Henrique | Gantech", "Vamos."))
        self.assertEqual(parse_panel(p), [("Alice Silva", "Vamos fechar?"), ("Rodrigo Henrique", "Vamos.")])

    def test_so_as_ultimas_linhas(self):
        p = panel(*[body("Ana | X", f"fala {i}") for i in range(20)])
        r = parse_panel(p, last_n=3)
        self.assertEqual([t for _, t in r], ["fala 17", "fala 18", "fala 19"])

    def test_texto_sem_cabecalho_herda_falante(self):
        b = N(cls="fui-ChatMessageCompact__body", kids=[N(typ="TextControl", name="continuação")])
        p = panel(body("Ana | X", "início"), [b])
        self.assertEqual(parse_panel(p), [("Ana", "início"), ("Ana", "continuação")])

    def test_painel_vazio(self):
        self.assertEqual(parse_panel(panel()), [])

if __name__ == "__main__":
    unittest.main()
