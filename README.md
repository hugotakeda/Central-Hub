<p align="center">
  <img src="public/icon.svg" alt="Logo do Central Hub" width="96" height="96">
</p>

<h1 align="center">Central Hub</h1>

<p align="center">
  Seus periféricos em um só lugar.<br>
  Um aplicativo leve para Windows, com interface minimalista em preto e grafite.
</p>

<p align="center">
  <a href="https://github.com/hugotakeda/Central-Hub/releases/latest"><img src="https://img.shields.io/badge/vers%C3%A3o-0.0.2-dedede?style=flat-square" alt="Versão 0.0.2"></a>
  <img src="https://img.shields.io/badge/plataforma-Windows%20x64-303030?style=flat-square" alt="Plataforma Windows x64">
  <img src="https://img.shields.io/badge/tecnologia-Tauri%20%2B%20Rust-303030?style=flat-square&amp;logo=tauri&amp;logoColor=white" alt="Desenvolvido com Tauri e Rust">
  <img src="https://img.shields.io/badge/testes%20automatizados-80%20aprovados-303030?style=flat-square" alt="80 testes automatizados aprovados na versão 0.0.2">
</p>

<p align="center">
  <a href="https://github.com/hugotakeda/Central-Hub/releases/latest"><strong>Baixar o Central Hub</strong></a>
  · <a href="#compatibilidade">Compatibilidade</a>
  · <a href="#desenvolvimento">Desenvolvimento</a>
  · <a href="https://github.com/hugotakeda/Central-Hub/issues">Relatar um problema</a>
</p>

---

O **Central Hub** reúne detecção, configuração e diagnóstico de mouses, teclados e headsets. Exibe os dados que o dispositivo realmente informa, com fotografias dos produtos e controles organizados por recurso.

## Download e instalação

| Arquivo | Indicação |
|---|---|
| [**Instalador para Windows x64**](https://github.com/hugotakeda/Central-Hub/releases/download/v0.0.2/Central-Hub-0.0.2-Setup.exe) | Recomendado para instalar o aplicativo. |
| [**Executável independente**](https://github.com/hugotakeda/Central-Hub/releases/download/v0.0.2/CentralHub.exe) | Para abrir sem passar pelo instalador. Requer o Microsoft Edge WebView2 Runtime. |
| [**Código-fonte**](https://github.com/hugotakeda/Central-Hub/releases/download/v0.0.2/Central-Hub-0.0.2-fonte.zip) | Projeto completo para estudar, desenvolver e compilar. |
| [**Checksums SHA-256**](https://github.com/hugotakeda/Central-Hub/releases/download/v0.0.2/SHA256SUMS.txt) | Para conferir a integridade dos arquivos baixados. |

1. Baixe o instalador ou o executável independente.
2. Feche qualquer versão anterior do Central Hub.
3. Abra o aplicativo e selecione **Configurar** no cartão do periférico.

A interface está em português do Brasil. Apenas uma instância do aplicativo pode ficar aberta por vez.

## Recursos

- **Detecção de periféricos:** agrupa as coleções HID, os dispositivos Plug and Play e os endpoints de áudio expostos pelo Windows.
- **Configuração real:** apresenta os valores lidos e confirma as alterações por releitura, nos modelos com integração disponível.
- **Fotos dos produtos:** prioriza imagens locais e oferece busca online com fonte, prévia, correção manual e cache limitado a 32 MB.
- **Diagnóstico de hardware:** verifica presença, descritores, driver e leitura dos protocolos integrados, com relatório exportável.
- **Teste manual de entrada:** permite conferir teclas, cliques e rolagem em uma área com foco.
- **Perfis locais:** salva os ajustes lidos e aplica somente valores compatíveis com o dispositivo e o transporte atuais.
- **Interface discreta:** tema preto e grafite, janela sem barra nativa e controles de janela revelados por foco ou passagem do mouse.

Receptores genéricos, áudio da placa-mãe, interfaces virtuais e controladores internos ficam em **Interfaces**, separados dos cartões de periféricos.

## Compatibilidade

| Dispositivo | Recursos integrados |
|---|---|
| **Logitech G Pro X Superlight original** | DPI e taxa de atualização anunciados pelo mouse, modo software/memória e leitura de bateria. |
| **Aula F75 por USB** | Identificação do modelo CD, efeitos internos, brilho e velocidade globais. |
| **Aula F75 por receptor 2,4 GHz** | Identificação do modelo CD, efeitos internos, brilho e velocidade, com confirmação por releitura. |
| **HyperX Cloud Flight** | Detecção e controles de volume/mudo de entrada e saída pelo áudio do Windows. |
| **Logitech G Pro TKL com fio** | Detecção, fotografia e diagnóstico; configuração de RGB e remapeamento ainda não integrada. |
| **Outros mouses e teclados** | Detecção e diagnóstico conforme os dados expostos pelo Windows; configuração depende do protocolo disponível. |

**Detectar um dispositivo não significa oferecer configuração universal.** Atualização de firmware, macros, remapeamento, gravação de perfis na memória interna e bateria/DSP do headset ainda não fazem parte das integrações disponíveis.

No F75, a configuração por **Bluetooth não está integrada**. Em 2,4 GHz, acorde o teclado com uma tecla e use **Atualizar** caso ele esteja em repouso. A presença do receptor, sozinha, não comprova uma conexão ativa.

## Dados reais e desempenho

O aplicativo não preenche leituras ausentes com valores simulados. Níveis diferentes de iluminação são apresentados como mistos; uma falha de leitura permanece identificada como falha.

A detecção ocorre ao abrir, retornar à janela, atualizar manualmente ou receber uma alteração de dispositivos do Windows. Não há consulta periódica de hardware, serviço de fundo ou telemetria. O acesso HID é serializado, as operações nativas rodam fora da interface e as páginas secundárias são carregadas sob demanda.

A busca de fotos pode ser desativada em **Ajustes**. Suas consultas usam marca e nome público do modelo; caminhos HID, números de série e configurações não fazem parte do pedido de imagem. Histórico de bateria, fotos escolhidas e perfis ficam locais.

O teste manual de entrada recebe eventos somente enquanto sua área está em foco. Ele não identifica qual periférico físico gerou o evento e não mede a taxa USB nem a latência do sensor. O diagnóstico de leitura não altera configurações.

## Desenvolvimento

### Requisitos

- Windows x64.
- Node.js **22.12 ou superior**, com npm.
- Rust e Cargo.
- Ferramentas C++ do Visual Studio.
- Microsoft Edge WebView2 Runtime.

### Executar localmente

```powershell
git clone https://github.com/hugotakeda/Central-Hub.git
cd Central-Hub
npm ci
npm run tauri dev
```

A porta **1420** precisa estar livre. A prévia no navegador serve para a interface; o acesso ao hardware exige o aplicativo Windows.

### Verificar e compilar

```powershell
npm test
npm run check
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run tauri build
```

O executável é gerado em `src-tauri/target/release/central-hub.exe`. O instalador fica em `src-tauri/target/release/bundle/nsis/`.

A versão **0.0.2** passou em **45 testes de frontend e 35 testes unitários nativos**. Dois testes físicos sem fio também foram executados explicitamente, com alterações, releitura e restauração dos ajustes originais. Os quatro testes de escrita física são ignorados na execução comum; só devem ser acionados com intenção de modificar temporariamente o hardware e restaurá-lo.

## Documentação técnica

| Documento | Conteúdo |
|---|---|
| [Arquitetura](docs/ARQUITETURA.md) | Organização do aplicativo e comunicação com o hardware. |
| [Protocolos](docs/PROTOCOLOS.md) | Referências técnicas de identificação e configuração. |
| [Aula F75 sem fio](docs/F75-SEM-FIO.md) | Transporte 2,4 GHz, validação e limites da integração. |
| [Fotos online](docs/FOTOS-ONLINE.md) | Busca, cache, privacidade e correção das sugestões. |
| [Validação](docs/VALIDACAO.md) | Testes executados, evidências e limitações conhecidas. |

## Relatar problemas

Abra uma [issue](https://github.com/hugotakeda/Central-Hub/issues) informando a versão do Central Hub, o modelo do periférico, o modo de conexão e os passos para reproduzir o problema. Se anexar um diagnóstico exportado, revise seu conteúdo antes de publicá-lo.

## Créditos

As fotografias e marcas pertencem aos respectivos titulares. As origens estão documentadas em [Fontes das imagens](public/products/SOURCES.md); esses créditos não atribuem às imagens uma licença do código.

As referências de protocolo estão nos documentos técnicos. O aplicativo usa implementações próprias em Rust e não incorpora os drivers completos dos projetos citados.
