# Aula F75 no receptor 2,4 GHz — 0.0.2

O F75 usa transportes diferentes no cabo e no receptor. O Central Hub passou a consultar o modelo pela coleção de fabricante do receptor 3554:FA09, página FF02, uso 2. O VID/PID sozinho não identifica o teclado, pois outros modelos compartilham essa família.

A consulta é somente de identificação: relatório de saída 13, comando 05. Antes do envio, o descritor precisa anunciar entrada e saída de 20 bytes nesse relatório. A resposta precisa ter comprimento, comando, cabeçalho e checksum válidos, além do código CD do F75. Outros modelos, pacotes incompletos e ausência de resposta não recebem a identidade F75.

A identificação tem até duas tentativas curtas e não altera ajustes. Não há polling periódico. Se não responder, pressione uma tecla no teclado em modo 2.4G e use Atualizar. O receptor pode continuar no Windows enquanto o teclado dorme ou usa outro modo.

Após uma resposta válida, a identidade fica em memória apenas durante a sessão e para aquele receptor. Uma consulta sem resposta preserva o cartão com a indicação receptor presente e origem da identidade anterior nos detalhes. Outra resposta de modelo invalida a associação; desconectar o receptor ou fechar o app também a remove. A identidade anterior não é apresentada como uma resposta atual no teste de hardware.

Quando identificado, aparece um cartão Aula F75, com foto local e indicação 2,4 GHz. O receptor não recebe um segundo cartão. Configurar abre diretamente os ajustes e a configuração usa o transporte correspondente, sem enviar comandos com fio ao receptor.

## Configuração sem fio

aula_wireless.rs lê todos os dez fragmentos da configuração, validando ordem/índices, checksum, comprimentos, trailer e tabela. Pacotes incompletos ou conflitantes impedem a aplicação; não há configuração padrão de substituição.

Efeito, brilho e velocidade alteram somente os campos correspondentes da configuração lida. Flags de cor, paletas e dados desconhecidos são preservados. Cada fragmento de escrita exige eco completo. No receptor validado, SAVE não produz eco; a confirmação é uma leitura completa posterior com comparação de efeito e tabela. Não são transmitidos templates de fábrica, paletas, mapas por tecla ou firmware.

A API revalida o modelo CD e compara a revisão antes de aplicar. Falhas interrompem a sequência e a interface tenta reler o estado; uma alteração parcialmente enviada não é anunciada como concluída. Não há rollback automático de uma configuração arbitrária.

Brilho sem fio aceita 0–9; por USB a integração atual aceita 1–9. Perfis locais respeitam os limites do transporte atual. Níveis diferentes entre efeitos são exibidos como mistos.

Referências primárias de protocolo consultadas; implementação Rust própria:

- https://github.com/ushineko/sanshoku/blob/main/aula/canvas.go — consulta do modelo e código CD.
- https://github.com/ushineko/sanshoku/blob/main/aula/driver.go — coleção FF02 e limites de resposta.
- https://github.com/free-soldier28/Aula-Manager/blob/main/docs/PROTOCOL.md — diferença entre os transportes com fio e sem fio.

Validação inicial de identificação: o receptor retornou 13 05 01 00 0A 03 00 00 00 00 CD 01 00 00 00 00 00 00 00 F4. A primeira consulta não obteve resposta; a seguinte confirmou CD. Essa consulta inicial não verificava a configuração sem fio nem garantia disponibilidade contínua enquanto o teclado dorme.

Na validação 0.0.2, os ajustes de efeito, brilho e velocidade foram alterados, relidos e restaurados. A restauração comparou todos os bytes de dados dos dez fragmentos, exceto os dois campos de controle de aplicação. Um segundo teste pela API normal confirmou troca/restauração de efeito e igualdade dos ajustes originais. A primeira tentativa do teste detectou a ausência de eco de SAVE; após corrigir essa confirmação, a restauração do backup original e ambos os testes passaram. Os testes físicos ficam ignorados por padrão.
