# Instalador Windows

O nome público do produto, do executável instalado e dos atalhos é **CentralHub**. A versão fica nos metadados; o pacote de distribuição gerado pelo comando abaixo mantém o nome **CentralHub-Setup.exe**.

```powershell
npm run installer
```

Arquivos gerados:

- `src-tauri/target/release/CentralHub.exe`
- `src-tauri/target/release/bundle/nsis/CentralHub-Setup.exe`

O Tauri também mantém o instalador original com versão e arquitetura no nome. Ambos os arquivos de instalação têm o mesmo conteúdo.

## Identidade visual

O instalador e o desinstalador usam `src-tauri/icons/icon.ico`. As telas de abertura e conclusão utilizam `src-tauri/installer/sidebar.bmp` (164 × 314 px), e o cabeçalho utiliza `header.bmp` (150 × 57 px). São imagens BMP RGB de 24 bits, com a marca do projeto e a paleta preto/grafite.

Para regenerar as imagens a partir de `src-tauri/icons/icon.png`:

```powershell
./scripts/generate-installer-artwork.ps1
```

## Instalações anteriores

O hook NSIS reconhece instalações por usuário com o nome antigo **Central Hub** somente quando nome, publicador, executável e arquivos locais correspondem ao projeto. Ele sugere a pasta existente, respeita uma escolha diferente de destino e verifica se o executável antigo está aberto antes da substituição.

Na mesma pasta, a limpeza da entrada antiga e dos atalhos pertencentes a ela ocorre após a cópia do novo aplicativo e a geração do desinstalador. A identidade Tauri `com.centralhub.desktop` permanece estável. Não há remoção de preferências ou dados de periféricos.

Alterar o instalador local não substitui arquivos de uma release já publicada no GitHub.

## Verificação local

O build TypeScript/Vite e o empacotamento Tauri/NSIS concluíram sem erros. Os metadados do instalador e do executável apresentam `ProductName` e `FileDescription` como `CentralHub`. A tela de boas-vindas foi inspecionada na janela nativa, com a logo e o nome correto.

Após a execução local do assistente, a instalação anterior 0.0.3 foi observada como `CentralHub` 0.0.4, na mesma pasta, com o atalho novo e sem o executável, o atalho e a entrada de desinstalação com o nome antigo. A comparação binária confirmou que o aplicativo instalado difere do executável independente somente no marcador de empacotamento do Tauri (`NSS` em vez de `UNK`), em três bytes. Não foram aplicadas configurações de periféricos durante essa verificação.
