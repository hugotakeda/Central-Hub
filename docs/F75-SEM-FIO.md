# Aula F75 no receptor 2,4 GHz — 0.9.1

O F75 usa transportes diferentes no cabo e no receptor. O Central Hub passou a consultar o modelo pela coleção de fabricante do receptor 3554:FA09, página FF02, uso 2. O VID/PID sozinho não identifica o teclado, pois outros modelos compartilham essa família.

A consulta é somente de identificação: relatório de saída 13, comando 05. Antes do envio, o descritor precisa anunciar entrada e saída de 20 bytes nesse relatório. A resposta precisa ter comprimento, comando, cabeçalho e checksum válidos, além do código CD do F75. Outros modelos, pacotes incompletos e ausência de resposta não recebem a identidade F75.

A consulta tem até duas tentativas curtas. Não há polling periódico, comandos de iluminação, pareamento, gravação de firmware ou alteração de ajustes. Se não responder, pressione uma tecla no teclado em modo 2.4G e use Atualizar. O receptor pode continuar no Windows enquanto o teclado dorme ou usa outro modo.

Após uma resposta válida, a identidade fica em memória apenas durante a sessão e para aquele receptor. Uma consulta sem resposta preserva o cartão com a indicação receptor presente e origem da identidade anterior nos detalhes. Outra resposta de modelo invalida a associação; desconectar o receptor ou fechar o app também a remove. A identidade anterior não é apresentada como uma resposta atual no teste de hardware.

Quando identificado, aparece um cartão Aula F75, com foto local e indicação 2,4 GHz. O receptor não recebe um segundo cartão. Configuração da iluminação continua disponível somente pelo cabo USB nesta versão. O app não tenta o protocolo de configuração com fio no receptor.

Referências primárias de protocolo consultadas; implementação Rust própria:

- https://github.com/ushineko/sanshoku/blob/main/aula/canvas.go — consulta do modelo e código CD.
- https://github.com/ushineko/sanshoku/blob/main/aula/driver.go — coleção FF02 e limites de resposta.
- https://github.com/free-soldier28/Aula-Manager/blob/main/docs/PROTOCOL.md — diferença entre os transportes com fio e sem fio.

Validação física nesta sessão: o receptor retornou 13 05 01 00 0A 03 00 00 00 00 CD 01 00 00 00 00 00 00 00 F4. A primeira consulta não obteve resposta; a seguinte confirmou CD. Isso não certifica configuração sem fio ou disponibilidade contínua enquanto o teclado dorme.
