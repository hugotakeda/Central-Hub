# Compatibilidade com o OpenMouse

O Central Hub 0.0.3 incorpora as bibliotecas oficiais de protocolo e uma adaptação local do painel de configuração do OpenMouse. A integração funciona no executável Windows, sem abrir o site do OpenMouse nem exigir a instalação do OpenMouse Bridge.

## Versões incorporadas

| Componente | Versão ou revisão |
|---|---|
| `@openmouse/protocol` | 0.48.0 |
| `@openmouse/keyboard-protocol` | 1.1.0 |
| Painel OpenMouse | `eb318ad1a13cb2af94bc5e8e2a9e43020d0da038` |

Essas são as versões de protocolo declaradas pelo painel nessa revisão. O registro da biblioteca principal contém **96 entradas de driver** e o de teclados contém **3**. Uma entrada não corresponde necessariamente a um único modelo: há famílias, gerações e alguns teclados de identificação limitada no registro principal.

Entre as marcas presentes estão Logitech, Razer, SteelSeries, Corsair, Pulsar, Endgame Gear, Lamzu, ATK, VXE, VGN, MCHOSE, Glorious, HyperX, ASUS, Keychron, Finalmouse, Wooting e Wuque Studio. A presença de uma marca não significa que todos os seus produtos sejam compatíveis.

## Descoberta e transporte

1. O Windows fornece as interfaces HID, os identificadores USB e os Container IDs. Os caminhos e Container IDs não são enviados ao frontend; são usados identificadores locais derivados de hash.
2. Os descritores HID reais são convertidos para o formato esperado pelos clientes WebHID. Coleções de uma mesma interface USB física são reunidas, preservando os relatórios e suas dimensões. Aparelhos fisicamente distintos não são unidos pelo nome ou pelo VID/PID.
3. Os critérios do registro upstream escolhem os candidatos. A consulta do protocolo identifica o modelo atrás do receptor quando o driver oferece essa capacidade. Receptores sem identidade confirmada continuam fora da tela inicial.
4. A comunicação é feita por `hidapi` no processo Rust. Os drivers recebem um adaptador WebHID; o navegador não recebe caminhos USB e não abre diretamente o hardware.
5. O transporte valida operação, ID e tamanho contra o descritor. Uma colisão ambígua entre coleções não produz uma escrita. Não são capturados os relatórios de digitação da coleção de teclado padrão.

O F75 continua com o protocolo nativo do Central Hub, inclusive por USB e 2,4 GHz. Suas interfaces conhecidas são reservadas a essa integração mesmo quando o teclado não responde à identificação; um driver de mouse que compartilhe o fabricante do receptor não recebe essas coleções.

## Recursos disponíveis

O botão **Configurar** abre o painel local. As abas e os controles são os do modelo e das capacidades que a implementação upstream oferece: sensibilidade, estágios de DPI, frequência, sensor, debounce, suspensão, iluminação, botões, macros, memória interna e diagnósticos, conforme o dispositivo.

Um recurso não implementado ou bloqueado pelo driver não é liberado por existir no protocolo de outro modelo. Os bloqueios de formato e validação de perfis do upstream são preservados.

Os presets de DPI no modo Host são atalhos locais: o valor atual é uma leitura do mouse, mas os outros presets representam escolhas de configuração. Eles não são apresentados como uma leitura dos perfis da memória interna. As alterações pendentes são rascunhos até a aplicação explícita. Ao sair do painel com rascunhos pendentes, o aplicativo pede que sejam aplicados ou descartados.

Protocolos somente de escrita podem disponibilizar opções de configuração sem conseguir ler seus valores atuais. O marcador `valuesVerified: false` do driver impede tratar esses padrões de edição como leituras: a interface apresenta o estado como não informado, mantém os campos como escolhas para envio e não afirma confirmação por releitura. Da mesma forma, uma identificação que dependa somente do catálogo não é promovida a uma leitura de estado aprovada no teste de hardware.

As fotografias vêm do catálogo, da escolha local do usuário ou da busca do próprio Central Hub. A busca de uma imagem não habilita um protocolo de configuração e não confirma a identidade do hardware.

## O que esta equivalência abrange

A integração compartilha o catálogo, os clientes e o painel de **configuração dos dispositivos**. Isso amplia a cobertura para além dos periféricos usados no desenvolvimento inicial, preservando as limitações de cada driver.

Não representa uma certificação física de todo o catálogo. A adaptação de transporte pode exigir ajustes para interfaces ou modelos ainda não testados no Windows. Não inclui o serviço de perfis automáticos por jogo, o OpenMouse Bridge, serviços de nuvem, notícias ou atualização de firmware. Headsets usam os controles de áudio do Windows; a integração não cria protocolos de bateria, DSP ou equalizador para todos os modelos.

Não são iniciados modos de demonstração. Não há consulta periódica de status, telemetria ou carregamento do site externo. O painel abre as coleções necessárias durante seu uso; ao sair, os handles e leitores são encerrados. Essas leituras de respostas HID não são uma medição da frequência de reporte ou da latência do sensor.

## Validação física

No Superlight original conectado por LIGHTSPEED, o cliente upstream leu **PRO X Wireless**, **800 DPI**, **1.000 Hz**, **36% de bateria**, modo **Host** e os identificadores de firmware. A lista de DPI retornou **511 valores** e incluiu o valor ativo. Nenhuma configuração foi alterada nesse teste de leitura.

A validação visual do executável confirmou a detecção dos três periféricos reais, a fotografia rosa do Superlight e o painel de desempenho com os valores lidos. Os testes unitários verificam agrupamento das coleções curtas/longas do Windows, separação de aparelhos idênticos, roteamento de relatórios e descarte de sessões parcialmente abertas.

Para repetir o teste físico de leitura, com um Superlight original presente:

```powershell
cargo build --manifest-path src-tauri/Cargo.toml --bin hub-protocol-check
$env:CENTRAL_HUB_PROTOCOL_HARDWARE = '1'
npx vitest run tests/protocolHardware.test.ts
Remove-Item Env:CENTRAL_HUB_PROTOCOL_HARDWARE
```

O helper de diagnóstico usa JSON por entrada/saída padrão e só é iniciado pelo teste explícito. Ele não é um serviço de rede e não é necessário para executar o aplicativo.

## Licença e manutenção

O conjunto derivado usa **AGPL-3.0-or-later**. Consulte [créditos](../THIRD_PARTY_NOTICES.md), [licença](../LICENSE) e [origem/adaptações](../vendor/openmouse/ORIGEM.md). As bibliotecas estão fixadas no arquivo de lock; atualizá-las exige revisar o contrato de transporte, recompilar e repetir os testes.
