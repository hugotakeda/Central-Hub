# Arquitetura — 0.0.2

React → Zustand/estado local do formulário → IPC Tauri → Rust → HID/Core Audio.

0.0.2 integra aula_wireless.rs como um alvo separado em controls.rs. Seleção de transporte e revalidação do modelo acontecem nativamente; a UI recebe somente ajustes tipados com limites. Revisões, leitura completa, eco por fragmento e releitura após SAVE protegem o fluxo de aplicação. A navegação Configurar seleciona a aba de ajustes, enquanto o clique no cartão continua abrindo a visão geral.

Em 0.9.1, peripheralDevices seleciona mouses, teclados e headsets físicos para Home e Teste de hardware. A enumeração completa permanece disponível em Interfaces. Identificação do F75 pelo receptor Compx é independente da integração de configuração USB; supportsSettings impede enviar leituras de configuração com fio ao receptor. Consulte F75-SEM-FIO.md.

- `identity.rs`: identificação por HID++/Sinowealth. IDs de software HID++ alternados para rejeitar respostas atrasadas; o ID B das versões antigas é reservado.
- `hid.rs`: metadados e agrupamento físico. Mutex compartilhado entre detecção e configuração impede intercalar pedidos HID dentro do processo.
- `controls.rs`: resolve o dispositivo pelo hash do Container ID e revalida o modelo antes de ler/escrever. Aceita um ajuste tipado por pedido, compara revisão e confirma por releitura. O frontend não envia caminhos HID, comandos brutos nem regiões de configuração.
- Superlight: faixa DPI anunciada pelo mouse, polling anunciado, modo de configuração e bateria Unified Battery. A bateria não participa da revisão, pois muda independentemente dos ajustes.
- F75: região de 128 bytes validada por cabeçalho/tamanho/trailer/tabela. Read-modify-write preserva os bytes sem relação com o ajuste. Releitura exige a região esperada byte a byte.
- `HardwareControls.tsx`: carrega dados reais, mantém rascunhos locais e só apresenta confirmação após resposta validada. Erro tenta reler estado; navegação invalida respostas antigas.
- `audio.rs`: Windows Core Audio, volume/mudo do endpoint explicitamente selecionado.
- `discovery.rs`/`monitor.rs`: descoberta em worker e eventos PnP, sem loop de polling.
- `hardwareGroups.ts`: agrupa interfaces físicas e distingue identidade de protocolo, nome explícito e grupo genérico.
- `DeviceArt.tsx`: fotos locais, sem desenho sintético de substituição.
- `hub-diagnostics.rs`: descoberta nativa em JSON.

Comandos IPC: scan_hardware, read_device_settings, apply_device_setting e set_audio_endpoint. CSP local/IPC e frontend sem permissões de shell/filesystem. Instância única.

Sem providers fictícios, seeds ou persistência de perfis de teste. Escritas de firmware, macros e perfis onboard não fazem parte das rotas de configuração.

Marca em SVG local. WindowChrome usa as APIs de janela do Tauri, com permissões específicas de minimizar, maximizar/restaurar, fechar e arrastar; sem polling, bibliotecas extras ou transparência de composição. Controles ocultos via opacity e revelados por hover/focus-within; navegação por teclado preservada.

## Descoberta e telas 0.8.0

metadata.rs consulta propriedades CM do Windows a partir de caminhos de interface, sem abrir handles de escrita de teclados/mouses protegidos. pnp.rs enumera classes presentes de teclado/mouse via SetupAPI. audio.rs obtém Container ID dos endpoints; os três fluxos convergem para o mesmo hash físico.

hardwareGroups.ts exibe todos os grupos, sem filtro por lista de modelos. O catálogo só atribui nome/foto e não libera configuração. Uso HID e classe PnP fornecem o tipo; dispositivos virtuais ficam identificados. HardwareTest faz leituras em worker, com relatório por verificação e limites explícitos. Protocolo desconhecido é não verificado, não aprovado.

useDeviceSettings coordena leitura/aplicação e descarta respostas após navegação; bloqueio imediato evita submissões concorrentes. LocalProfiles valida valores contra as opções atuais e encadeia revisões. localData mantém perfis, fotos e histórico limitados, sem dados sintéticos, timers de coleta ou acesso externo.

APIs Windows consultadas: https://learn.microsoft.com/en-us/windows/win32/api/setupapi/nf-setupapi-setupdigetdeviceinterfacedetailw e propriedades de dispositivo CM/SetupAPI. Imagens e identificação de catálogo têm fontes em public/products/SOURCES.md.

## Fotos online 0.9.0

Serviço photos.rs isolado do acesso HID; não usa o mutex de configuração. A busca roda em worker, usa WinHTTP/WIC nativos e cache próprio de miniaturas. O frontend conserva a CSP local, exibe a proveniência e mantém a prioridade de fotos locais/cadastradas. Nenhum código de imagem muda o nome, a identidade, os protocolos suportados ou a conexão do hardware.

Detalhes, limites e testes de rede reais: FOTOS-ONLINE.md.
