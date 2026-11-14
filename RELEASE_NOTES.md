# Makers 3D v0.4.0

Esta versão reúne as mudanças desenvolvidas desde a v0.3.0 local e é o primeiro release publicado no GitHub. Ela inclui perfis de produção reutilizáveis, configurações locais e um chat com IA que acompanha os dados do aplicativo e pode propor alterações.

## Orçamentos e produção

- Cadastre, edite e exclua impressoras com preço, potência média, vida útil e percentual de manutenção. Cadastre filamentos com material, cor, preço e peso líquido do rolo.
- Selecione uma impressora e um filamento para preencher os custos de produção. Orçamentos existentes podem manter os valores originais ou receber os dados de outros perfis.
- Defina a tarifa de energia em **Configurações**. Novos orçamentos usam o valor configurado e os anteriores preservam a tarifa registrada.
- Informe o tempo de impressão em horas, minutos e segundos. Os orçamentos anteriores continuam abrindo normalmente.
- O backup JSON inclui os perfis e a tarifa configurada. A importação mantém os registros existentes e adiciona os ausentes.
- Corrigido o salvamento de orçamentos editados. O formulário agora envia o custo total e o preço de venda recalculados.

## Chat com IA

- Conecte OpenAI, Anthropic, Gemini, Ollama, LM Studio e endpoints compatíveis. Também é possível usar **Continuar com ChatGPT** com uma conta elegível ou entrar com Google mediante um cliente OAuth desktop configurado no Google Cloud.
- Use a sessão local de **Codex CLI**, **Claude Code**, **Antigravity CLI** ou **OpenCode v2** quando já houver uma configuração na respectiva CLI.
- Ative **Usar dados do Makers 3D** para consultar orçamentos, impressoras, filamentos e configurações. A IA pode propor cadastros, edições e exclusões de registros e mudanças de configuração. O Makers 3D mostra a proposta para revisão antes de gravar.
- Acompanhe o indicador de preparação e a resposta progressiva. O chat exibe Markdown formatado, incluindo listas, tabelas e trechos de código.
- Reabra conversas na barra lateral e continue com o contexto recente. O histórico fica no computador, fora do backup de orçamentos.
- O aplicativo lembra o provedor, o modelo e o endereço escolhidos. Chaves de API digitadas no chat ficam em memória durante a sessão.
- O retorno do login mostra o resultado em uma página com o visual do aplicativo. A validação do ChatGPT passou a aceitar identificadores de audiência no formato de lista, mantendo a verificação da assinatura.

## Interface e estabilidade

- Barra de título integrada à aparência do Makers 3D, com botões circulares e duplo clique para maximizar.
- Melhor contraste nos botões e itens de menu ao passar o mouse.
- O empacotamento passou a substituir o AppImage atomicamente, preservando o arquivo em uso por uma instância aberta durante a recompilação.

## Download e instalação

Baixe o **Makers3D-x86_64.AppImage** nos arquivos deste release. O pacote usa GTK4 e WebKitGTK 6.0 do sistema. O build de distribuição usa Ubuntu 24.04.

```sh
chmod +x Makers3D-x86_64.AppImage
./Makers3D-x86_64.AppImage
```

O arquivo `SHA256SUMS` permite conferir a integridade do download com `sha256sum -c SHA256SUMS`. O arquivo `.zsync` acompanha o AppImage para ferramentas de atualização compatíveis.

## Feedback

[Registre problemas e sugestões no GitHub](https://github.com/eulucastiagolt/makers3d/issues).
