# Makers 3D

- Não adicione comentários ao código a menos que o usuário peça.
- Toda alteração entregue que afete o aplicativo, seus dados, aparência, comportamento ou empacotamento deve atualizar a versão em `Cargo.toml` e a entrada `makers3d` em `Cargo.lock`. Atualize também `RELEASE_NOTES.md` e a entrada de lançamento em `data/io.github.eulucastiagolt.Makers3D.metainfo.xml`.
- Na série 0.x, aumente o MINOR para funcionalidades novas ou incompatibilidades e o PATCH para correções e ajustes compatíveis. Mudanças feitas para concluir a mesma entrega usam a mesma versão.
- Antes de publicar, valide com `make check` e `make test`. O GitHub Actions publica os artefatos quando uma tag anotada correspondente à versão do Cargo é enviada.
