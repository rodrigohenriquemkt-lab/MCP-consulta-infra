# wp-security-scanner

Serviço HTTP que roda um scan de segurança em um site WordPress: versão do
core/plugins/temas via WPScan, headers de segurança HTTP e versões de TLS
suportadas. Pensado para rodar no Railway (ou qualquer host com egress
liberado), já que muitos ambientes de agente têm o tráfego de saída
restrito.

Ao subir, o serviço já roda um scan automático de cada domínio listado em
`ALLOWED_DOMAINS` e imprime o resultado em JSON no log (`===SCAN_RESULT_START===`
... `===SCAN_RESULT_END===`) — dá para ler pelos logs do Railway sem precisar
acessar o serviço publicamente.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ALLOWED_DOMAINS` | sim | Lista de domínios autorizados, separados por vírgula. É a única coisa que pode ser escaneada — protege contra o serviço virar um scanner aberto para qualquer alvo. |
| `SCANNER_API_KEY` | sim (para usar `/scan` e `/results`) | Chave secreta exigida via header `x-scan-key` ou `?key=`. |
| `WPSCAN_API_TOKEN` | não | Token gratuito de https://wpscan.com/api/ — sem ele o WPScan ainda enumera plugins/temas/usuários, mas não cruza com o banco de vulnerabilidades conhecidas. |
| `PORT` | não | Porta HTTP (default 3000, o Railway injeta a dele). |

## Endpoints

- `GET /health` — healthcheck.
- `GET /scan?domain=exemplo.com&key=SUA_CHAVE` — dispara um novo scan sob demanda (só para domínios em `ALLOWED_DOMAINS`).
- `GET /results?key=SUA_CHAVE` — devolve o último resultado de cada domínio já escaneado.

## Importante

Isto executa testes ativos (o WPScan faz requisições reais ao site,
inclusive tentando enumerar usuários). Só aponte para domínios que você tem
autorização explícita para testar.
