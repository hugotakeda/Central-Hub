# Protocolos próprios e bateria

## Escopo da versão 0.0.4

O catálogo fornecido pelo usuário contém **225 produtos: 75 mouses, 75 teclados e 75 headsets/fones**. Está em `src/domain/peripheralCatalog.json`. É uma lista de identificação e associação; não é uma pesquisa de participação de mercado nem uma declaração de suporte completo aos 225 protocolos.

O reconhecimento compara marca, categoria e nome normalizado exato. Não usa correspondência aproximada que confunda, por exemplo, F75 com F75 Max ou AJ199 com AJ199 Pro. Os dados do catálogo melhoram o nome e a consulta de fotos de um aparelho realmente enumerado; não criam cartões de equipamentos ausentes. Interfaces com nomes genéricos continuam dependendo de identificação pelo protocolo. Fotos online permanecem sugestões com fonte.

As bibliotecas OpenMouse continuam responsáveis pelos modelos que já atendem, inclusive várias famílias AJAZZ, Attack Shark, ATK, Delux, Fantech, Incott, MCHOSE, Rapoo, Redragon e VGN. Não são reclassificadas como protocolos de autoria do Central Hub.

## VIA/QMK próprio

Implementação: `src/services/ownVia.ts`; painel: `src/pages/ViaDevice.tsx`; variantes: `src/domain/viaDefinitions.json`.

| Família | VID / PID documentados | Matriz |
|---|---|---|
| Keychron V1 USB | `3434:0310` a `3434:0315`, ANSI/ISO/JIS, com e sem knob | 6 × 16 |
| Keychron V2 USB | `3434:0320` a `3434:0325`, ANSI/ISO/JIS, com e sem knob | 5 × 15 |
| MonsGeek M1 VIA | `FFFE:0005` | 6 × 16 |

São **13 variantes**, não 13 famílias diferentes. Versões Max, Pro, HE, revisões com outro VID/PID e firmwares sem VIA não herdam esta integração.

O transporte exige a coleção Raw HID `FF60:0061` com entrada e saída de 32 bytes. A identificação lê versão VIA `0x01` e número de camadas `0x11`; aceita versões 9 a 13 e 1 a 16 camadas. A configuração lê o mapa por blocos `0x12`, mostra somente as posições documentadas e permite gravar códigos HID básicos com `0x05`.

Antes de alterar uma tecla, a implementação reenumera a interface, verifica a mesma identidade física/VID/PID e versão/camadas, relê o código anterior com `0x04`, envia a única alteração solicitada e relê o resultado. Uma edição desatualizada ou uma confirmação divergente resulta em erro. As demais posições e os códigos avançados existentes são preservados. A gravação pode persistir na memória do teclado. Não há comandos de reset, bootloader, flash ou uma API de pacotes arbitrários no painel próprio.

A validação automatizada cobre enquadramento, leitura de camadas, limites, conflito de edição e releitura da gravação. **As variantes VIA ainda não foram conectadas fisicamente neste ambiente.**

Fontes primárias, consultadas em 28/10/2026:

- [QMK: IDs do protocolo VIA](https://github.com/qmk/qmk_firmware/blob/master/quantum/via.h) e [tratamento de comandos](https://github.com/qmk/qmk_firmware/blob/master/quantum/via.c).
- [Definições VIA Keychron V1](https://github.com/the-via/keyboards/tree/master/v3/keychron/v1), [V2](https://github.com/the-via/keyboards/tree/master/v3/keychron/v2) e [MonsGeek M1](https://github.com/the-via/keyboards/blob/master/v3/monsgeek/m1/m1.json).

## Provedores nativos de bateria

Implementação: `src-tauri/src/battery.rs`, `hid_battery.rs` e `windows_battery.rs`.

| Integração própria | Modelos / revisões reconhecidos | O que apresenta |
|---|---|---|
| HyperX Flight | `0951:16C4`, `0951:1723`, coleção `FF90:0303` ou `FF53:0303` | Tensão em mV; indicação de carga quando o protocolo a sinaliza |
| HyperX Cloud II Wireless HP | `03F0:0696`, `03F0:018B`, coleção `FF90:0303` | Porcentagem e estado de carga |
| HyperX Cloud II Wireless Kingston | `0951:1718`, coleção `FF90:0303` | Porcentagem e estado de carga |
| HyperX Cloud Alpha Wireless | `03F0:098D`, coleção `FF90:0303` | Porcentagem ou estado de carga, após consultar o link |
| Logitech G933/G935/G733 | `046D:0A5B`, `0A87`, `0AB5`, `0AFE`, `0B1F`, coleção `FF43:0202` | Tensão em mV e estado de carga quando reconhecido |
| Corsair Void/HS, protocolo legado | PIDs explicitamente relacionados no código; coleção `FFC5:0001`, interface 3 | Porcentagem e carga; remove o bit de microfone do valor |
| SteelSeries Arctis 7/2019 | `1038:1260`, `1038:12AD`, interface 5 | Porcentagem |
| USB HID Battery Strength | Campo Feature declarado na página `0x06`, uso `0x20` | Proporção da faixa lógica anunciada pelo próprio descritor |
| Windows | Propriedade de bateria de um nó presente, sem erro/desconexão sinalizada | Último nível disponibilizado pelo driver; sem inferir carga |

Os provedores específicos conferem VID/PID, coleção/interface, existência e comprimento do relatório, eco do comando e limites dos valores. As filas antigas são drenadas antes da consulta, o tempo de espera é limitado e os handles são fechados ao terminar. Apenas consultas de estado são enviadas. Não são enviados comandos de iluminação, som, desligamento, DSP ou firmware.

**Não convertemos tensão em porcentagem por curva estimada.** Quando o hardware só informa mV, a interface apresenta mV. Zero é um nível válido; ausência, 255, resposta inválida e falha de acesso não se transformam em 0% ou 100%. Se a revisão não anunciar o formato esperado, a consulta é recusada.

O campo HID Battery Strength só é lido quando está declarado como Feature variável e dentro dos limites aceitos. Não são capturadas entradas normais de teclado/mouse para tentar adivinhar bateria.

As propriedades Windows são opcionais. A chave pública `System.Devices.BatteryLife` é tentada primeiro; a propriedade utilizada pelos drivers Bluetooth é um fallback sem garantia pública de estabilidade. A interface identifica esta origem como **último valor do driver**, não como uma medição de rádio recém-obtida. Propriedades sem valor são ignoradas.

Validação física nesta versão: **Cloud Flight `0951:1723` respondeu com 3814 mV**, sem qualquer alteração de configuração. Os demais provedores possuem testes de interpretação e proteção, mas ainda precisam de testes físicos por revisão. O F75 mantém a configuração USB/2,4 GHz existente; esta versão não atribui uma porcentagem a bytes de configuração que não foram validados como bateria.

Fontes primárias:

- [HeadsetControl: implementações dos headsets](https://github.com/Sapd/HeadsetControl/tree/master/lib/devices). O Central Hub tem seus próprios parsers e transporte; as referências descrevem os pacotes e revisões conhecidos.
- [USB HID Usage Tables](https://www.usb.org/sites/default/files/hut1_21_0.pdf), página Generic Device Controls, Battery Strength.
- [Microsoft: System.Devices.BatteryLife](https://learn.microsoft.com/en-us/windows/win32/properties/props-system-devices-batterylife), [SetupDiGetDevicePropertyW](https://learn.microsoft.com/en-us/windows/win32/api/setupapi/nf-setupapi-setupdigetdevicepropertyw) e [CM_Get_DevNode_Status](https://learn.microsoft.com/en-us/windows/win32/api/cfgmgr32/nf-cfgmgr32-cm_get_devnode_status).
- [Xm4Battery: propriedades Bluetooth observadas](https://github.com/nikvoronin/Xm4Battery), para o fallback do driver.

## Fones P2 e áudio

Um fone analógico passivo não envia marca, modelo, VID/PID ou nível de bateria pelo conector P2. O aplicativo enumera os endpoints de áudio ativos do Windows e o seu [formato físico](https://learn.microsoft.com/en-us/windows/win32/coreaudio/pkey-audioendpoint-formfactor), quando o driver o fornece. Headphones/Headset podem aparecer automaticamente; alto-falantes de sistema e saídas digitais continuam fora da página principal.

**Adicionar fone P2**, na sidebar, abre uma página com busca integrada, filtros por marca e resumo da associação. Permite selecionar uma saída real, um microfone opcional e um dos 75 modelos ou um nome personalizado. Essa associação local é marcada como **modelo escolhido por você**. O cartão oferece foto, volume e mudo da saída correspondente. Não faz reconhecimento elétrico do modelo nem garante que o plugue esteja inserido: alguns drivers mantêm o endpoint ativo mesmo com o conector vazio. Uma saída ausente não cria um cartão ativo. A associação pode ser removida em Ajustes ou no próprio dispositivo.

Não há bateria para fones passivos como KZ, QKZ, Moondrop e outros IEMs com cabo P2. Modelos sem fio de qualquer marca só exibem bateria quando uma leitura real está disponível.

## Interface e desempenho

- Janela fixa de até 1100 × 750 unidades lógicas, ajustada uma vez na abertura para caber na área útil e escala DPI do monitor; redimensionamento e maximização desativados.
- Sidebar de 13 px com controles maiores.
- Uma área principal de rolagem; nas configurações OpenMouse, a rolagem pertence ao próprio painel. Há espaço após o último controle e antes da barra de aplicação.
- Avisos no topo da área de conteúdo, com largura/altura limitadas, fechamento acessível e rolagem própria quando necessário. Não cobrem Aplicar/Descartar na parte inferior.
- Catálogo local, sem baixar 225 imagens na abertura. Fotos são resolvidas apenas para cartões realmente apresentados e reutilizam o cache existente.
- Nenhuma consulta periódica de bateria adicionada. Leituras acompanham as atualizações manuais e os eventos de dispositivos já usados pelo aplicativo. O botão de bateria em Ajustes controla sua exibição.

## Separação de headsets e clientes de mouse

O filtro do cliente upstream HyperX Pulsefire Haste reconhece o fornecedor e a coleção `FF00:0001`; headsets Cloud Flight também podem expor essa coleção sem o canal de configuração do mouse. A descoberta exclui grupos identificados como headset/áudio antes de construir clientes de mouse e valida o canal de entrada/saída não numerado de 64 bytes exigido pelo Haste. O agrupamento ignora sondagens de mouse associadas a headsets e a navegação mantém estes aparelhos no painel nativo. Assim o Cloud Flight conserva volume/mudo e a consulta de bateria compatível, sem receber comandos do Pulsefire.
