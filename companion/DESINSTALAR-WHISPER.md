# Desinstalar o Whisper (Windows)

O projeto não usa mais Whisper. Estes passos removem do **seu** computador o que possa ter sido instalado
(o que existir; o que não existir apenas mostrará aviso). Confira cada comando antes de rodar.

1. Ver o que está instalado:
   ```powershell
   pip list | findstr /i "whisper ctranslate2"
   ```
2. Desinstalar os pacotes Python:
   ```powershell
   pip uninstall -y faster-whisper openai-whisper ctranslate2 whisper-timestamped
   ```
   Se usou ambiente virtual do projeto, basta apagar a pasta `.venv`.
3. Apagar os modelos baixados (podem ocupar de centenas de MB a vários GB):
   ```powershell
   Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\whisper" -ErrorAction SilentlyContinue
   Get-ChildItem "$env:USERPROFILE\.cache\huggingface\hub" -Filter "models--*whisper*" | Remove-Item -Recurse -Force
   ```
4. Se instalou o **whisper.cpp** ou algum app com Whisper embutido (ex.: MacWhisper, Buzz, Whisper Desktop): desinstale em *Configurações > Aplicativos* e apague a pasta do projeto/os arquivos `ggml-*.bin`.
5. Dependências que o faster-whisper trouxe (`onnxruntime`, `av`, `tokenizers`, `huggingface-hub`) podem ser úteis a outros programas: só remova se tiver certeza de que não os usa (`pip show <pacote>` mostra quem depende).
6. Conferir: `pip list | findstr /i whisper` não deve listar nada, e `where whisper` não deve achar executáveis.
