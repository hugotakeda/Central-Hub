# Central Hub 0.0.1

Central Hub is a lightweight Windows app for managing mice, keyboards, and headsets. Discover devices, view real hardware data and product photos, run diagnostics, and configure supported peripherals through a minimal black-and-graphite interface.

## Download

**Windows x64:** [Download the installer](https://github.com/hugotakeda/Central-Hub/releases/download/v0.0.1/CentralHub.exe) or [download the standalone executable](https://github.com/hugotakeda/Central-Hub/releases/latest/download/CentralHub.exe).

See [releases](https://github.com/hugotakeda/Central-Hub/releases) for source downloads, checksums, changes, and compatibility notes. The standalone app requires Microsoft Edge WebView2 Runtime. Close any older Central Hub instance before opening this version. The current interface is in Brazilian Portuguese.

## Supported features

| Device | Available integration |
|---|---|
| Logitech G Pro X Superlight, original | Reported DPI/polling options, software/onboard mode, battery readings |
| Aula F75, USB, model CD confirmed | Built-in lighting effects, brightness and speed |
| Aula F75, 2.4 GHz | Protocol-confirmed identification, product photo and diagnostics; use USB for lighting configuration |
| HyperX Cloud Flight | Windows audio volume/mute controls; headset battery and DSP controls are not integrated |
| Logitech G Pro TKL, wired | Detection, product photo and diagnostics; RGB/remapping configuration is not integrated |
| Other mice and keyboards | Windows HID/PnP discovery and diagnostics where available; configuration depends on an implemented protocol |

Generic receivers, motherboard audio and internal controllers stay in **Interfaces**, outside the main peripheral list. Online photo suggestions show their source and use a bounded local cache. Unknown hardware values are never filled with simulated data. Detection does not imply universal configuration support.

## Build from source

Requirements: Windows x64, Node.js 22.12+, Rust, Visual Studio C++ Build Tools and WebView2.

```powershell
git clone https://github.com/hugotakeda/Central-Hub.git
cd Central-Hub
npm ci
npm run tauri dev
```

For a release build, run `npm run tauri build`. For frontend checks, run `npm test` and `npm run check`. Native unit tests: `cargo test --manifest-path src-tauri/Cargo.toml --lib`. The two physical hardware-write tests are ignored by default and should only be run intentionally on the appropriate device. A browser-only preview cannot access native hardware.

The v0.9.1 validation passed 42 frontend tests and 30 native unit tests. See [validation notes](docs/VALIDACAO.md), [wireless F75 details](docs/F75-SEM-FIO.md), [online photos](docs/FOTOS-ONLINE.md), and [product image credits](public/products/SOURCES.md). Product photos and trademarks belong to their respective owners; the credits do not grant a license to those assets.

## Documentação em português

Aplicativo Windows x64, local, com interface preto/grafite e dados reais de periféricos.

## Detecção

A tela principal mostra somente periféricos físicos classificados como mouse, teclado ou headset. Receptores genéricos, áudio da placa-mãe, controladores internos e interfaces virtuais ficam na página Interfaces, sem gerar cartões nem buscas automáticas de foto na tela principal. O seletor de Teste de hardware usa a mesma lista de periféricos. Outros mouses e teclados continuam aparecendo pelo tipo informado pelo Windows, mesmo sem entrada no catálogo ou integração de configuração.

Coleções, interfaces de entrada e áudio são agrupadas pelo Container ID do Windows, convertido em hash local. A detecção usa metadados e consultas de identificação apenas nos protocolos já conhecidos; não envia comandos arbitrários aos demais aparelhos. O receptor presente não comprova link sem fio. Um dispositivo ausente do próprio Windows não pode ser detectado pelo app.

G Pro TKL com fio: identificação de catálogo por 046D:C339 ou nome correspondente e foto oficial local. Não confunde o teclado virtual do G HUB (C232) com o G Pro físico. Outros modelos são exibidos pelo nome/uso informado pelo Windows. Não há identificação de switch, cor ou versão por suposição.

Aula F75 em 2,4 GHz: identificação pelo modelo CD retornado no protocolo do receptor, foto e diagnóstico. Se estiver dormindo, pressione uma tecla e atualize. O receptor genérico sozinho não gera cartão. Iluminação e perfis do F75 continuam sendo configurados por cabo USB. Detalhes: docs/F75-SEM-FIO.md.

## Controles

| Produto | Configuração integrada |
|---|---|
| Superlight original | DPI e polling anunciados pelo mouse, modo software/memória e leitura de bateria |
| Aula F75 USB, modelo CD confirmado | Efeitos internos 0–18, brilho e velocidade globais |
| Áudio Windows, incluindo Cloud Flight e dispositivos genéricos | Volume e mudo dos endpoints ativos de entrada/saída |
| G Pro TKL e demais modelos HID/PnP | Detecção, foto quando disponível, dados e teste; protocolo de configuração ainda não integrado |

Valores só aparecem quando foram lidos. Ajustes são explícitos e seguidos de releitura; revisão do estado evita sobrescrever mudanças de outro software. DPI/polling alteram o estado ativo, sem regravar perfis onboard. O modo software é ativado somente por pedido explícito. G HUB pode substituir os valores ativos. O F75 exige USB e preserva os bytes não relacionados ao ajuste.

## Interface

Cartões com fabricante, tipo, conexão e bateria/polling quando disponíveis. Página com Visão geral, Desempenho/Configuração, Avançado e Perfis. Detalhes incluem VID/PID, barramento, usos, driver Windows, modelo retornado e configurações lidas. Firmware não consultado não recebe versão fictícia nem indicação de atualização.

Histórico de bateria local dos últimos 7 dias, limitado a 100 leituras por dispositivo. Registra apenas consultas que já ocorreriam no uso do app. O gráfico só aparece após duas leituras; não há polling adicional.

Perfis locais começam vazios. Salve os valores realmente lidos e aplique explicitamente; até 20 por modelo. As opções são validadas contra o aparelho atual. Uma falha interrompe a sequência e relê o estado; ajustes anteriores confirmados podem permanecer. Não há rollback oculto nem gravação de perfis na memória interna do mouse. Níveis mistos do F75 são preservados pelo perfil quando não representam um valor global.

## Teste de hardware

Teste explícito e de leitura: nova enumeração, presença PnP/HID/áudio, metadados, versão de driver e consulta de configuração nos modelos integrados. Resultado por etapa: confirmado, falhou ou não verificado. Não altera configurações, reproduz áudio, grava microfone ou escreve firmware. Não certifica integridade física nem compatibilidade completa.

Relatório JSON exportável, com dados do aparelho selecionado, resultados e tempo real da execução. Avançado também exporta um diagnóstico. Não são incluídos caminhos HID ou números de série; IDs locais são hashes. Nenhum relatório é enviado automaticamente.

Teste manual de teclas, cliques e scroll captura apenas a área em foco; Tab/Esc ou perda de foco encerra a captura. Eventos ficam na sessão, não são armazenados nem enviados. O navegador não atribui esses eventos a um aparelho físico específico, por isso o usuário deve isolar o periférico em teste. Não mede polling USB ou latência do sensor.

## Fotos e marca

Fotos locais de catálogo: Superlight rosa, Aula F75 preto, Cloud Flight e G Pro TKL com fio. Layout, iluminação e switches da foto podem variar; não representam o estado atual do aparelho. Para modelos sem foto local, busca online automática com fonte e cache; quando não houver correspondência ou acesso, mantém o ícone de categoria. É possível escolher uma foto local PNG/JPG/WebP de até 250 KB, limitada a 10 fotos, armazenada por aparelho.

Monograma CH vetorial em branco, com fundo preto/grafite. Fontes em public/brand e public/icon.svg. A janela não tem barra nativa. Passe o mouse no canto superior direito ou use Tab para revelar os controles; arraste a faixa superior transparente para mover. Alt+F4 fecha a janela.

## Executar e compilar

Feche a versão antiga antes de abrir a nova: há uma única instância por aplicativo.

Requisitos de desenvolvimento: Node.js 22.12+, Rust, ferramentas C++ do Visual Studio e WebView2.

```powershell
npm ci
npm run tauri dev
```

Porta 1420 deve estar livre. A prévia web não acessa hardware; use o app Windows.

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

Executável: src-tauri/target/release/central-hub.exe.
Instalador: src-tauri/target/release/bundle/nsis/Central Hub_0.9.1_x64-setup.exe.
Diagnóstico de leitura: cargo run --manifest-path src-tauri/Cargo.toml --bin hub-diagnostics.
Teste de leitura: mesmo comando com -- --test IDENTIDADE_FISICA.

Os dois testes antigos de escrita física F75 ficam ignorados por padrão; só devem ser invocados explicitamente quando houver intenção de alterar temporariamente/restaurar o hardware. Não fazem parte da execução do novo botão Teste de hardware.

## Desempenho e limites

Sem consultas periódicas de hardware, serviço de fundo, telemetria ou blur. Downloads ocorrem somente na busca de fotos online, quando ativada. Detecção ao abrir, retornar à janela, atualizar ou receber evento PnP com debounce. Leituras adicionais restritas aos modelos com configuração integrada. Páginas secundárias sob demanda; histórico e fotos limitados; configuração nativa em worker e acesso HID serializado.

Detecção ampla não significa configuração universal: firmware, macros, remapeamento, gravação de perfis onboard, DSP/LED e bateria do headset continuam fora das integrações disponíveis. A lista depende do que o Windows e os drivers expõem.

Fotos online: [como funciona, fontes e limites](docs/FOTOS-ONLINE.md). Fotos sugeridas não alteram a identidade ou os recursos do hardware. O modelo da busca pode ser corrigido na página do dispositivo; Ajustes permite desativar a busca e limpar seu cache.

Fontes e validação: docs/PROTOCOLOS.md, docs/VALIDACAO.md, docs/ARQUITETURA.md e public/products/SOURCES.md.
