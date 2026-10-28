<p align="center">
  <img src="public/icon.svg" alt="Logo do Central Hub" width="96" height="96">
</p>

<h1 align="center">Central Hub</h1>

<p align="center">
  Seus periféricos em um só lugar.<br>
  Um aplicativo leve para Windows, com interface minimalista em preto e grafite.
</p>

<p align="center">
  <a href="https://github.com/hugotakeda/Central-Hub/releases/latest"><img src="https://img.shields.io/badge/vers%C3%A3o-0.0.3-dedede?style=flat-square" alt="Versão 0.0.3"></a>
  <img src="https://img.shields.io/badge/plataforma-Windows%20x64-303030?style=flat-square" alt="Plataforma Windows x64">
  <img src="https://img.shields.io/badge/tecnologia-Tauri%20%2B%20Rust-303030?style=flat-square&amp;logo=tauri&amp;logoColor=white" alt="Desenvolvido com Tauri e Rust">
  <img src="https://img.shields.io/badge/testes%20automatizados-90%20aprovados-303030?style=flat-square" alt="90 testes automatizados aprovados na versão 0.0.3">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-AGPL%203.0-303030?style=flat-square" alt="Licença AGPL, versão 3 ou posterior"></a>
</p>

<p align="center">
  <a href="https://github.com/hugotakeda/Central-Hub/releases/latest"><strong>Baixar o Central Hub</strong></a>
  · <a href="#compatibilidade">Compatibilidade</a>
  · <a href="#desenvolvimento">Desenvolvimento</a>
  · <a href="https://github.com/hugotakeda/Central-Hub/issues">Relatar um problema</a>
</p>

---

O **Central Hub** reúne detecção, configuração e diagnóstico de mouses, teclados e headsets. Exibe os dados que o dispositivo realmente informa, com fotografias dos produtos e controles organizados por recurso.

A partir da **0.0.3**, o aplicativo incorpora as bibliotecas e o painel de configuração do **OpenMouse**, adaptados ao HID nativo do Windows. A cobertura passa a seguir o catálogo upstream, além das integrações próprias do F75 e de áudio. Consulte [como funciona a compatibilidade](docs/OPENMOUSE.md).

## Download e instalação

| Arquivo | Indicação |
|---|---|
| [**Instalador para Windows x64**](https://github.com/hugotakeda/Central-Hub/releases/download/v0.0.3/Central-Hub-0.0.3-Setup.exe) | Recomendado para instalar o aplicativo. |
| [**Executável independente**](https://github.com/hugotakeda/Central-Hub/releases/download/v0.0.3/CentralHub.exe) | Para abrir sem passar pelo instalador. Requer o Microsoft Edge WebView2 Runtime. |
| [**Código-fonte**](https://github.com/hugotakeda/Central-Hub/releases/download/v0.0.3/Central-Hub-0.0.3-fonte.zip) | Fontes correspondentes ao executável, inclusive o painel adaptado e os avisos de licença. |
| [**Checksums SHA-256**](https://github.com/hugotakeda/Central-Hub/releases/download/v0.0.3/SHA256SUMS.txt) | Para conferir a integridade dos arquivos baixados. |

1. Baixe o instalador ou o executável independente.
2. Feche qualquer versão anterior do Central Hub.
3. Abra o aplicativo e selecione **Configurar** no cartão do periférico.

A interface está em português do Brasil. Apenas uma instância do aplicativo pode ficar aberta por vez.

## Recursos

- **Detecção de periféricos:** agrupa as coleções HID, os dispositivos Plug and Play e os endpoints de áudio expostos pelo Windows.
- **Configuração real:** apresenta os valores lidos e confirma as alterações por releitura, nos modelos com integração disponível.
- **Catálogo OpenMouse:** clientes e critérios de reconhecimento compartilhados com o projeto upstream, com controles de DPI, frequência, botões, iluminação, sensor, macros e perfis conforme a capacidade de cada modelo.
- **Fotos dos produtos:** prioriza imagens locais e oferece busca online com fonte, prévia, correção manual e cache limitado a 32 MB.
- **Diagnóstico de hardware:** verifica presença, descritores, driver e leitura dos protocolos integrados, com relatório exportável.
- **Teste manual de entrada:** permite conferir teclas, cliques e rolagem em uma área com foco.
- **Perfis locais:** salva os ajustes lidos e aplica somente valores compatíveis com o dispositivo e o transporte atuais.
- **Interface discreta:** tema preto e grafite, janela sem barra nativa e controles de janela revelados por foco ou passagem do mouse.

Receptores genéricos, áudio da placa-mãe, interfaces virtuais e controladores internos ficam em **Interfaces**, separados dos cartões de periféricos.

## Compatibilidade

| Dispositivo | Recursos integrados |
|---|---|
| **Modelos do catálogo OpenMouse** | Painel e protocolos do upstream; os controles variam conforme modelo, firmware e transporte. A adaptação nativa ainda exige testes físicos por modelo. |
| **Logitech G Pro X Superlight original** | Leitura física validada com o cliente OpenMouse, DPI, frequência, bateria, firmware e painel de configuração com regras de perfis do upstream. |
| **Aula F75 por USB** | Identificação do modelo CD, efeitos internos, brilho e velocidade globais. |
| **Aula F75 por receptor 2,4 GHz** | Identificação do modelo CD, efeitos internos, brilho e velocidade, com confirmação por releitura. |
| **HyperX Cloud Flight** | Detecção e controles de volume/mudo de entrada e saída pelo áudio do Windows. |
| **Logitech G Pro TKL com fio** | Detecção, fotografia e diagnóstico; configuração de RGB e remapeamento ainda não integrada. |
| **Modelos fora do catálogo** | Detecção e diagnóstico conforme os dados expostos pelo Windows; configuração depende de uma integração disponível. |

**Detectar um dispositivo não significa oferecer configuração universal.** O catálogo principal contém 96 entradas de driver e o de teclados contém 3; esses números não representam uma validação física de 99 modelos. A configuração usa as capacidades e os bloqueios do OpenMouse. Atualização de firmware, serviço de perfis automáticos por jogo e bateria/DSP dos headsets não estão integrados.

No F75, a configuração por **Bluetooth não está integrada**. Em 2,4 GHz, acorde o teclado com uma tecla e use **Atualizar** caso ele esteja em repouso. A presença do receptor, sozinha, não comprova uma conexão ativa.

## Dados reais e desempenho

O aplicativo não preenche leituras ausentes com valores simulados. Níveis diferentes de iluminação são apresentados como mistos; uma falha de leitura permanece identificada como falha.

A detecção ocorre ao abrir, retornar à janela, atualizar manualmente ou receber uma alteração de dispositivos do Windows. Não há consulta periódica de status, serviço de fundo ou telemetria. O painel de configuração é carregado sob demanda, abre somente a sessão selecionada e encerra seus handles e leitores ao sair. Durante essa sessão, os leitores HID recebem respostas e notificações do hardware. As operações nativas rodam fora da interface.

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

A versão **0.0.3** passou em **52 testes de frontend e 38 testes unitários nativos**. O Superlight original também foi consultado fisicamente pelo cliente OpenMouse e pelo transporte HID nativo, sem alterar configurações. Os testes físicos são opcionais e não rodam na suíte comum. A validação de escrita USB/2,4 GHz do F75 feita na versão anterior permanece documentada; não foi repetida como se fosse uma validação dos outros modelos.

## Documentação técnica

| Documento | Conteúdo |
|---|---|
| [Arquitetura](docs/ARQUITETURA.md) | Organização do aplicativo e comunicação com o hardware. |
| [Compatibilidade OpenMouse](docs/OPENMOUSE.md) | Catálogo, transporte nativo, painel incorporado, validação e limites. |
| [Protocolos](docs/PROTOCOLOS.md) | Referências técnicas de identificação e configuração. |
| [Aula F75 sem fio](docs/F75-SEM-FIO.md) | Transporte 2,4 GHz, validação e limites da integração. |
| [Fotos online](docs/FOTOS-ONLINE.md) | Busca, cache, privacidade e correção das sugestões. |
| [Validação](docs/VALIDACAO.md) | Testes executados, evidências e limitações conhecidas. |

## Relatar problemas

Abra uma [issue](https://github.com/hugotakeda/Central-Hub/issues) informando a versão do Central Hub, o modelo do periférico, o modo de conexão e os passos para reproduzir o problema. Se anexar um diagnóstico exportado, revise seu conteúdo antes de publicá-lo.

## Créditos

As fotografias e marcas pertencem aos respectivos titulares. As origens estão documentadas em [Fontes das imagens](public/products/SOURCES.md); esses créditos não atribuem às imagens uma licença do código.

O painel de configuração é derivado do [OpenMouse](https://github.com/OpenMouse-Project/openmouse), com bibliotecas oficiais de mouse e teclado. O código adaptado, a revisão de origem e as modificações estão em [vendor/openmouse](vendor/openmouse/ORIGEM.md). O transporte nativo, o protocolo do F75, a descoberta Windows e a interface principal são mantidos pelo Central Hub.

O conjunto é distribuído sob **AGPL-3.0-or-later**. Consulte a [licença](LICENSE) e os [créditos das dependências](THIRD_PARTY_NOTICES.md).
