# Painel de configuração do OpenMouse

Fonte: [OpenMouse-Project/openmouse](https://github.com/OpenMouse-Project/openmouse).

Revisão incorporada: `eb318ad1a13cb2af94bc5e8e2a9e43020d0da038`.

Licença: **AGPL-3.0-or-later**. O texto original e os avisos de autoria estão preservados em `LICENSE`. As bibliotecas de protocolo são instaladas pelo npm, com versões e integridades fixadas no `package-lock.json` da raiz.

## Adaptações do Central Hub

- O ponto de entrada é `protocol/main.tsx`; o aplicativo web completo não é iniciado.
- O painel é empacotado localmente e usa o transporte HID nativo do Central Hub. Não depende de acessar o site do OpenMouse ou instalar o OpenMouse Bridge.
- A interface de configuração mantém o controlador e os componentes de recursos por fabricante, com tema monocromático, português, fontes do sistema e animações reduzidas.
- `controller.ts`: desativados os modos de demonstração, removidas suas implementações de clientes e fixtures em memória, desativada a atualização periódica, expostas leitura manual e liberação de sessão. O cadastro inicial usa uma única tentativa de inventário já disponível.
- `platform/analytics.ts`: substituído por uma implementação sem envio, carregamento de SDK ou coleta de eventos.
- `shared/device-images.ts`: usa a fotografia selecionada pelo Central Hub. Imagens do CDN e imagens promocionais do OpenMouse não são utilizadas.
- `FirmwareCard.tsx`: exibe somente a identificação de firmware lida. Não consulta atualização, baixa executáveis ou grava firmware.
- `i18n/index.ts`: somente a tradução portuguesa é incluída no pacote produzido.
- Dados marcados por um driver como não verificados ou somente de escrita não são exibidos como leituras atuais. Os presets do modo Host são identificados como atalhos locais; reconhecimento apenas pelo catálogo fica separado de uma resposta de protocolo.
- Não são iniciadas as páginas de jogos, notícias, patrocinadores, configurações do Bridge ou serviço web/PWA. Funções que dependem desses serviços não são anunciadas como integradas ao Central Hub.

`scripts/adapt-openmouse.mjs` registra as transformações iniciais; ajustes posteriores estão nos arquivos e no histórico do Central Hub. Não execute esse script novamente sobre os arquivos já adaptados.

O suporte do catálogo upstream não equivale a uma validação física local de cada modelo. A configuração do Aula F75 e o áudio Windows continuam implementados no próprio Central Hub.

Na versão 0.0.4, a exibição de bateria em DeviceHero, DeviceStats e OverviewPage passou a respeitar a preferência do Central Hub, por meio de shared/power-visibility.ts. Ajustes locais de CSS do painel corrigem rolagem, notificações e o espaço da barra de aplicação.

O início do controller passa a retornar a Promise da reconexão inicial. O host Central Hub usa esse resultado para mostrar carregamento/recuperação do aparelho selecionado e renderiza diretamente a área de configuração, sem a lista de autorização WebHID interna. A página original do upstream permanece no código de origem, mas não integra esse fluxo do aplicativo.
