# Validação — Central Hub 0.9.1

Windows x64, 27/10/2026.

## Correção da lista e F75 sem fio 0.9.1

42 testes frontend e 30 testes unitários Rust passaram. Dois testes físicos antigos de escrita continuam ignorados. Regressões cobrem a lista de periféricos sem receptores/Realtek/NZXT/virtuais, outros mouses e teclados sem catálogo, identidade F75 pelo receptor, indicação de conexão e ausência de leitura de ajustes com fio no receptor. Testes nativos rejeitam outro modelo, checksum incorreto, pacote incompleto e descritor sem entrada/saída compatível. O cache de identidade exige resposta válida, não é compartilhado entre receptores e é invalidado por outro modelo.

Consulta física de identificação no receptor 3554:FA09 retornou o modelo CD do F75 com checksum válido. Não houve escrita de configuração. A primeira consulta não respondeu e a próxima confirmou o modelo; não se presume presença ativa somente pelo receptor. Consulte F75-SEM-FIO.md.

O usuário confirmou o modo 2.4G ativo e digitação normal. Nova consulta física confirmou novamente CD. Um teste de diagnóstico anterior havia encontrado ausência temporária de resposta, corretamente reportada como falha de identificação atual.

As seções abaixo preservam o histórico de validação das versões anteriores.

- 22 testes frontend passaram: agrupamento/identidade, imagens, falhas de descoberta/áudio, concorrência, renderização dos valores reais, opções anunciadas, modo onboard e ausência de valores fictícios para níveis mistos.
- 10 testes unitários Rust passaram: respostas/descritores, faixas DPI malformadas, preservação de bytes do F75, limites e revisão independente da bateria.
- Validação física herdada da versão 0.5.0 (não repetida na alteração visual 0.6.0): 2 testes de hardware F75 foram executados explicitamente e passaram: brilho e velocidade, com escrita/releitura e restauração byte a byte dos 128 bytes originais. São ignorados por padrão no cargo test.
- Também na versão 0.5.0, teste nativo adicional: Superlight confirmou alteração de DPI e polling; valores iniciais foram restaurados. F75 confirmou troca de efeito e restauração. O executável temporário de teste foi removido da fonte entregue.
- Estado inicial observado: Superlight 800 DPI, 1000 Hz, modo software e 38% de bateria; F75 efeito 11, com níveis diferentes entre efeitos. Esses dados não são defaults do app.
- A UI só confirma valores após releitura. Mudanças externas invalidam a revisão e exigem nova aplicação.
- TypeScript e Vite passaram. A compilação Tauri final é executada antes do empacotamento.

Não foi certificado benchmark de CPU/RAM nem teste de firmware, macros, remapeamento ou gravação de perfis onboard. As verificações de configuração foram feitas pela camada nativa e pelos testes de renderização dos formulários, a verificação da janela 0.6.0 é documentada abaixo.

Build final: cargo check, compilação release Tauri e geração do instalador NSIS concluídos sem erros. A fonte entregue contém apenas o binário principal e o diagnóstico de leitura; o programa temporário de verificação foi removido.

## Marca e janela 0.6.0

22 testes frontend e 10 testes unitários Rust passaram novamente. Dois testes de escrita física foram ignorados por ser uma alteração visual; os resultados físicos anteriores pertencem à versão 0.5.0. SVG e ícones Windows foram regenerados pelo CLI Tauri, e o ícone PNG foi inspecionado.

A inspeção da janela existente confirmou que 0.5.0 ainda estava aberta. O usuário interrompeu a automação com Esc durante a preparação da troca de versão. Não foi possível concluir a confirmação visual dos controles hover/foco, arraste, minimizar/maximizar e fechar na janela 0.6.0. A configuração e as permissões foram verificadas no código e pela compilação.
## Paleta 0.7.0

Tema convertido integralmente de verde para preto/grafite, com marca branca e cores neutras em fundos, textos, foco, hover, botões, formulários, tabelas e avisos comuns. Avisos/erros mantêm sinalização semântica. Fundo nativo, favicon e todos os ícones foram regenerados. Não há dependências, efeitos de composição ou consultas de hardware adicionais.

22 testes frontend, 10 testes unitários Rust e build TypeScript/Vite passaram. Auditoria confirmou referências CSS resolvidas e cores neutras nos tokens de interface; o menor contraste dos pares de texto usados é 5,12:1. O ícone PNG foi inspecionado. Testes de escrita física não foram repetidos nesta alteração de cores. A verificação manual dos controles de janela continua pendente conforme a seção anterior; nenhuma automação da janela do usuário foi realizada nesta versão.
## Descoberta, interface e diagnóstico 0.8.0

- 32 testes frontend passaram: catálogo/fotos, agrupamento de HID/PnP/áudio, nomes desconhecidos, G Pro TKL C339, duas unidades do mesmo headset, valores anunciados, estado misto, validação de perfis e concorrência de descoberta/áudio.
- 13 testes unitários Rust passaram; 2 testes antigos de escrita física foram ignorados. Novos testes cobrem hash de Container ID e rejeição de seleção inválida antes de consultar hardware.
- TypeScript/Vite e cargo check passaram. Build release Tauri e NSIS concluídos; os artefatos finais são gerados após as últimas mudanças de frontend.
- Diagnósticos reais de leitura passaram no Superlight e no F75: presença Windows/PnP, descritores, versão de driver e consulta de configuração. Superlight retornou 800 DPI, 1000 Hz, modo software e 37%; F75 retornou efeito 15, brilho 3 e velocidade 4. Esses são valores observados, não defaults.
- Cloud Flight passou na presença, descritores, driver e controles Core Audio; consulta de configuração HID foi corretamente marcada como não verificada. Nenhum volume, mudo, iluminação, DPI, modo ou perfil foi alterado pelo teste.
- Tempos observados dos relatórios de leitura: 692 ms (mouse), 807 ms (F75) e 410 ms (headset), incluindo descoberta. Não representam benchmark universal de latência ou polling.
- A enumeração ampliada detectou coleções de todos os fabricantes presentes e identificou o teclado virtual do G HUB separadamente. Os endpoints Cloud Flight foram agrupados no mesmo Container ID HID; áudio Realtek também foi incluído.
- G Pro TKL com fio foi validado por testes de correspondência VID/PID C339 e fonte primária de catálogo. Nas leituras físicas desta sessão não estava presente no HID ou PnP; por isso não foi declarado teste físico desse modelo. Não há controles de iluminação/macros G Pro implementados.
- A foto oficial G Pro TKL foi inspecionada. Layout/switches de catálogo podem diferir da unidade do usuário; fotos desconhecidas não são substituídas por um mouse fictício.

Nenhuma simulação foi adicionada ao aplicativo. Fixtures de testes unitários existem somente na pasta tests. Firmware não consultado, compatibilidade de configuração não implementada e testes não executados permanecem identificados como indisponíveis/não verificados.

Revisão visual nativa: tela principal confirmou 7 grupos físicos, fotos de catálogo, bateria 37% e polling 1000 Hz; Visão geral, Desempenho e Teste de hardware foram inspecionados em janela sem barra nativa, com a paleta preto/grafite. Nenhum formulário de aplicação foi enviado nessa revisão.

O teste pela UI encontrou uma resposta temporariamente indisponível durante a reidentificação. A classificação foi corrigida: ausência de resposta não é tratada como ausência de integração; a nova tentativa usa apenas coleções dos protocolos já existentes e revalida o modelo antes de ler ajustes. Modelos desconhecidos continuam sem comandos de configuração. Teste unitário adicional confirmou os limites dessa seleção. Não foi declarado suporte novo de configuração ao G Pro TKL.
Após a correção, uma nova consulta ao mouse sem resposta confirmou o resultado correto: falha de identificação com a mensagem para mover o mouse e tentar novamente, em vez de alegar que a integração não existe. Leituras anteriores de configuração haviam sido confirmadas. A disponibilidade da resposta não é garantida continuamente, e nenhum valor foi fabricado para substituir a falha.

## Fotos online 0.9.0

37 testes frontend e 27 testes unitários Rust passaram. Dois testes físicos antigos de escrita continuam ignorados; nenhum ajuste de hardware foi necessário para testar fotos. TypeScript/Vite e cargo check passaram.

Novos testes cobrem deduplicação, expiração de falhas, preferência salva, retomada após desativação, match de modelo/variante, metadados de página, rejeição de logos/HTML/SVG, endereços públicos HTTPS, payload de cache, persistência de preferências e limpeza limitada ao cache.

Validação de rede real: fotos de G502 HERO, G305 LIGHTSPEED e Razer DeathAdder V3 obtidas nas páginas oficiais, normalizadas e mantidas em cache. Repetição G502 confirmou cache=true. Bloqueios/ausência de correspondência foram mantidos como indisponibilidade, sem inventar imagem ou contornar validação de acesso. O hardware descoberto não recebeu registros de teste.

Revisão na janela nativa 0.9.0: busca manual de Logitech G502 HERO exibiu a miniatura oficial na prévia. Cancelar prévia removeu o resultado sem aplicar a foto ao receptor usado para abrir o editor. O nome e os recursos reais desse receptor permaneceram inalterados. A consulta foi somente de imagem, sem simular presença do G502.
