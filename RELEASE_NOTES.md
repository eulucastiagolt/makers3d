# Makers 3D v0.7.0

- O chat pode consultar resultados da web com qualquer provedor ou agente integrado.
- Enter envia a mensagem no chat e Shift + Enter insere uma quebra de linha.
- O chat com IA gera um título curto a partir da primeira troca de mensagens. O título aparece na barra lateral e é preservado ao continuar a conversa.
- Conversas anteriores recebem um título ao serem retomadas. Se o modelo não devolver um título válido, o histórico mantém o texto da primeira mensagem até uma próxima tentativa.

## Download e instalação

O AppImage Linux x86_64 usa GTK4 e WebKitGTK 6.0 do sistema.

```sh
chmod +x Makers3D-x86_64.AppImage
./Makers3D-x86_64.AppImage
```

Use `sha256sum -c SHA256SUMS` para verificar o arquivo. O `.zsync` acompanha o AppImage para ferramentas de atualização compatíveis.
