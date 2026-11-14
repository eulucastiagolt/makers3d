# Makers 3D

Aplicativo desktop para precificação de impressão 3D e vendas no Shopee, TikTok Shop e Mercado Livre. A interface do Calc3D roda dentro do WebKitGTK. O aplicativo Rust gerencia os arquivos locais e atende a interface pelo protocolo interno `makers3d://`.

- Calculadoras com detalhamento de custos, comissões, margens e frete.
- Históricos com pesquisa, edição, exclusão e exportação individual.
- Envio do custo de produção ou do preço de venda a uma calculadora de marketplace.
- Backup e importação de orçamentos em JSON pela tela **Backup e dados**.

## Dados locais

Os dados ficam em `$XDG_DATA_HOME/makers3d/orcamentos.json` ou em `~/.local/share/makers3d/orcamentos.json`. A importação valida o arquivo e mescla os registros pelo identificador. Backups da primeira versão também podem ser importados. Se o histórico do Fatia 3D existir e o arquivo novo estiver ausente, o aplicativo copia os registros ao iniciar.

As calculadoras, os cadastros e os backups funcionam offline. O chat usa a conexão escolhida por você.

## Build no Linux

Instale Rust 1.92 ou mais recente, Node.js 22, GTK4 e WebKitGTK 6.0 com os pacotes de desenvolvimento. No Ubuntu 24.04, use `libgtk-4-dev` e `libwebkitgtk-6.0-dev`.

```sh
npm --prefix web ci
make check
make dev
```

`make build` compila o binário release. Para gerar o AppImage em `dist/`, instale também `appimagetool` e `rsvg-convert` e execute `make dist`. O AppImage usa GTK4 e WebKitGTK 6.0 da distribuição. A compatibilidade de glibc depende da distribuição do build.

Para importar um backup pelo terminal com o aplicativo fechado, rode `./dist/Makers3D-x86_64.AppImage --import-backup /caminho/backup.json`.

## Release

A cada entrega que altere o aplicativo, atualize a versão em `Cargo.toml` e `Cargo.lock`, as notas em `RELEASE_NOTES.md` e os metadados do aplicativo. Na série 0.x, use o MINOR para funcionalidades novas ou incompatibilidades e o PATCH para correções e ajustes compatíveis. Depois de integrar o commit à `main`, crie uma tag anotada `vMAJOR.MINOR.PATCH` correspondente à versão do Cargo. `make release` envia a `main` e suas tags anotadas. O GitHub Actions usa Ubuntu 24.04 para validar, compilar e anexar o AppImage, o arquivo de atualização zsync e o checksum ao GitHub Release.

## Impressoras e chat com IA

Em **Impressoras**, cadastre o nome ou modelo, o preço de compra, a potência média, a vida útil estimada e o percentual de manutenção. Selecione a impressora na calculadora para carregar esses valores. Os backups também incluem os perfis cadastrados.

Em **Chat com IA → Conexão**, escolha um provedor, informe o identificador do modelo e preencha a chave da API quando exigida. OpenAI, Anthropic, Gemini, Ollama e LM Studio têm endereços predefinidos. Para um servidor próprio, informe a URL completa de um endpoint compatível com OpenAI Chat Completions. O chat usa HTTPS para serviços remotos e também aceita HTTP no próprio computador. Para Ollama ou LM Studio, inicie o servidor e carregue o modelo antes de enviar a primeira mensagem.

O chat aceita APIs de provedores e agentes instalados. O aplicativo transmite as mensagens e o contexto recente somente ao endpoint configurado. A chave e a conversa ficam em memória durante a sessão. Com **Usar dados do Makers 3D** marcado, cada mensagem inclui os orçamentos de impressão e marketplace, os perfis e as configurações atuais. O chat pode propor cadastros, alterações e exclusões de orçamentos e perfis, além de alterações nas configurações. Revise a prévia e clique em **Confirmar alteração** para gravar. As credenciais ficam fora desse contexto.

### Entrar com uma conta

- **ChatGPT (login)**. Em **Chat com IA → Conexão**, clique em **Continuar com ChatGPT**, autorize o uso do plano no navegador e selecione um modelo disponível. O acesso depende da elegibilidade da conta e das permissões do workspace. [Documentação da OpenAI](https://developers.openai.com/siwc/token-sharing-open-source)
- **Gemini (login do Google)**. Habilite a API Generative Language no projeto do Google Cloud, configure o consentimento OAuth, autorize sua conta e baixe o JSON de um cliente OAuth do tipo **App para computador**. Selecione esse JSON na tela de conexão e clique em **Entrar com Google**. O uso do Gemini segue as permissões e cotas do projeto. [Documentação do Google](https://ai.google.dev/gemini-api/docs/oauth)

As sessões OAuth ficam em arquivos privados na pasta de configuração local e ficam fora dos backups. Use **Desconectar** para apagar a sessão do aplicativo. As opções de chave de API e servidor local continuam disponíveis.

### Filamentos

Em **Filamentos**, cadastre o nome do rolo, o material, a cor opcional, o preço e o peso líquido em gramas. Na calculadora de impressão 3D, selecione a impressora e o filamento para calcular um novo orçamento. Ao editar um orçamento salvo, você pode manter os dados originais ou selecionar outros perfis. Os backups JSON incluem os filamentos cadastrados.

### Tarifa de energia

Em **Configurações → Energia elétrica**, informe a tarifa padrão em R$/kWh da sua conta de luz. A calculadora usa esse valor nos novos orçamentos. Ao editar um orçamento salvo, o cálculo usa a tarifa registrada nele. O backup inclui a tarifa configurada e a importação só a aplica quando ainda não existe uma tarifa personalizada neste computador.

### Agentes instalados

Em **Chat com IA → Conexão → Agente instalado**, o Makers 3D procura CLIs conhecidas no PATH e em diretórios comuns de instalação do usuário. **Codex CLI**, **Claude Code**, **Antigravity CLI** e **OpenCode v2** podem responder pelo chat com a autenticação já configurada na CLI. Se a sessão estiver ausente ou expirada, autentique a CLI no terminal. O chat envia o contexto recente ao agente escolhido, que pode usar seu provedor online.

O Antigravity CLI usa a sessão iniciada com `agy` no terminal. O OpenCode usa o provedor e o modelo definidos na CLI. Gemini CLI e GitHub Copilot CLI aparecem na lista quando detectados.

Em **Chat com IA → Histórico**, abra uma conversa para ler as mensagens ou continuar com a conexão que você escolher. As conversas concluídas são gravadas localmente na pasta `makers3d/conversas` do diretório de dados. Cada resposta usa o contexto recente da conversa aberta, limitado pelo tamanho da janela de contexto do chat. As conversas ficam fora do backup de orçamentos.

Marque **Pesquisar na web** antes de enviar a mensagem. O aplicativo pesquisa a mensagem no Bing e inclui títulos, trechos e links no contexto da IA selecionada. Alterações nos cadastros continuam passando pela prévia do Makers 3D.
