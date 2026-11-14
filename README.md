# Makers 3D

Aplicativo desktop para precificação de impressão 3D e vendas no Shopee, TikTok Shop e Mercado Livre. A interface do Calc3D roda dentro do WebKitGTK. O aplicativo Rust gerencia os arquivos locais e atende a interface pelo protocolo interno `makers3d://`.

- Calculadoras com detalhamento de custos, comissões, margens e frete.
- Históricos com pesquisa, edição, exclusão e exportação individual.
- Envio do custo de produção ou do preço de venda a uma calculadora de marketplace.
- Backup e importação de orçamentos em JSON pela tela **Backup e dados**.

## Dados locais

Os dados ficam em `$XDG_DATA_HOME/makers3d/orcamentos.json` ou em `~/.local/share/makers3d/orcamentos.json`. A importação valida o arquivo e mescla os registros pelo identificador. Backups da primeira versão também podem ser importados. Se o histórico do Fatia 3D existir e o arquivo novo estiver ausente, o aplicativo copia os registros ao iniciar.

A versão desktop funciona offline. Login, redefinição de senha e planos pertencem ao Calc3D web.

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

Atualize a versão em `Cargo.toml` e `Cargo.lock` e prepare `RELEASE_NOTES.md`. Depois de integrar o commit à `main`, crie uma tag anotada `vMAJOR.MINOR.PATCH` correspondente à versão do Cargo. `make release` envia a `main` e suas tags anotadas. O GitHub Actions usa Ubuntu 24.04 para validar, compilar e anexar o AppImage, o arquivo de atualização zsync e o checksum ao GitHub Release.
