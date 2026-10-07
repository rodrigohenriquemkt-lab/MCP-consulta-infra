import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from captions import CaptionStream

class T(unittest.TestCase):
    def setUp(self):
        self.out = []
        self.cs = CaptionStream(lambda s, t: self.out.append((s, t)), settle=2.0)

    def test_linha_que_cresce_emite_uma_vez_apos_estabilizar(self):
        self.cs.feed([("Ana", "Tivemos um")], now=0)
        self.cs.feed([("Ana", "Tivemos um incidente")], now=1)
        self.cs.feed([("Ana", "Tivemos um incidente de ransomware")], now=2)
        self.assertEqual(self.out, [])
        self.cs.feed([("Ana", "Tivemos um incidente de ransomware")], now=4.5)
        self.assertEqual(self.out, [("Ana", "Tivemos um incidente de ransomware")])
        self.cs.feed([("Ana", "Tivemos um incidente de ransomware")], now=9)
        self.assertEqual(len(self.out), 1)

    def test_troca_de_falante_e_sumico_emitem_sem_esperar(self):
        self.cs.feed([("Ana", "Bom dia a todos")], now=0)
        self.cs.feed([("Rodrigo", "Bom dia, Ana")], now=0.5)  # Ana sumiu da tela
        self.assertEqual(self.out, [("Ana", "Bom dia a todos")])

    def test_extensao_apos_emitir_envia_so_o_resto(self):
        self.cs.feed([("Ana", "Estamos migrando")], now=0)
        self.cs.feed([("Ana", "Estamos migrando")], now=3)  # estabilizou: emite
        self.cs.feed([("Ana", "Estamos migrando para a nuvem")], now=4)
        self.cs.feed([("Ana", "Estamos migrando para a nuvem")], now=7)
        self.assertEqual(self.out, [("Ana", "Estamos migrando"), ("Ana", "para a nuvem")])

    def test_correcao_no_meio_nao_duplica(self):
        self.cs.feed([("Ana", "usamos o firewal da empresa")], now=0)
        self.cs.feed([("Ana", "usamos o firewall da empresa")], now=1)
        self.cs.feed([], now=2)
        textos = " ".join(t for _, t in self.out)
        self.assertIn("firewall", textos)
        self.assertEqual(textos.count("empresa"), 1)

    def test_historico_inicial_nao_e_reenviado(self):
        cs = CaptionStream(lambda s, t: self.out.append((s, t)), skip_initial=True)
        cs.feed([("Ana", "fala antiga")], now=0)
        cs.feed([("Ana", "fala antiga"), ("Rodrigo", "fala nova")], now=1)
        cs.feed([("Ana", "fala antiga"), ("Rodrigo", "fala nova")], now=4)
        self.assertEqual(self.out, [("Rodrigo", "fala nova")])

if __name__ == "__main__":
    unittest.main()
