# Busca de fotos online — Central Hub 0.9.0

## Como o OpenMouse funciona

Código consultado: https://github.com/OpenMouse-Project/openmouse/blob/main/src/shared/device-images.ts (SHA 131d5be30813085ef5b087899536afae477f06a3).

O OpenMouse associa o nome retornado pelo periférico a um arquivo de imagem de seu catálogo, hospedado em https://img.openmouse.app/. Quando não encontra regra ou arquivo, usa um placeholder. Não é uma busca universal na internet. A documentação das artes descreve a seleção/upload manual: https://github.com/OpenMouse-Project/openmouse/blob/main/public/devices/README.md.

O Central Hub não incorporou código, regras ou imagens desse catálogo. A comparação orientou a separação entre identificação de hardware e apresentação da foto.

## Comportamento implementado

1. Foto escolhida pelo usuário tem prioridade.
2. Em seguida, usa a foto local já cadastrada para o modelo.
3. Para os demais aparelhos físicos, consulta automaticamente uma fonte online com marca/nome do produto.
4. Páginas públicas do fabricante são tentadas primeiro quando existe um endereço compatível com a família. A descoberta adicional usa resultados públicos DuckDuckGo e Bing RSS, com correspondência de modelo e rejeição de variantes divergentes.
5. A imagem vem da página do produto: metadados sociais específicos ou galeria. Logos, imagens genéricas de homepage e variantes de modelo incompatíveis são descartados. As páginas não executam scripts no app.
6. O Windows valida e converte a foto em uma miniatura PNG de até 512 px, preservando proporções/transparência. São aceitas somente origens PNG/JPEG/WebP, com limites de tamanho e resolução.
7. A UI identifica a imagem como foto sugerida, informa a fonte e permite abrir a origem no navegador.

Se o nome for genérico, como USB Receiver ou Gaming Keyboard, não há informação suficiente para escolher a foto correta. A página permite informar o nome público do modelo exclusivamente para a busca, conferir uma prévia e então escolher Usar esta foto. Cancelar a prévia não altera a foto nem salva a associação. Esse texto não renomeia o hardware nem libera controles de configuração.

É possível ocultar uma sugestão incorreta, substituir por uma foto local e voltar à foto automática. Cor, tamanho de gabinete/radiador, layout e variantes visuais não são inferidos pela foto. Nem todo modelo possui uma foto acessível ou uma página pública compatível.

## Cache e rede

- Ativada por padrão conforme pedido do usuário; Ajustes → Fotos dos dispositivos permite desativar e limpar o cache.
- Cache separado das fotos locais do usuário, limitado a 32 MB e 192 arquivos de metadados/miniaturas. O app remove apenas seus próprios arquivos de cache, preservando preferências e outros arquivos.
- Fotos válidas são reutilizadas; busca manual pode atualizar. Uma atualização com falha preserva a foto anterior em cache.
- Resultado sem correspondência: cache de 6 horas. Indisponibilidade: 15 minutos. Não há loop de tentativas, timer de coleta, download periódico ou dependência de API paga/chave secreta.
- Uma fila nativa serializa as buscas; componentes compartilham pedidos e resultados em memória. Cache nativo é consultado antes de novos downloads.
- HTTPS com validação padrão do Windows, sem cookies/autenticação automática. Redirecionamentos são limitados e revalidados; endereços locais/privados não são aceitos. Somente URLs públicas podem abrir a fonte.
- HTML até 2 MB; imagem até 3 MB; máximo 16 milhões de pixels antes da miniaturização, com saída até 1,5 MB. Cache não é empacotado no executável ou na fonte entregue.
- Apenas a marca e o nome público do produto são usados na consulta. Caminhos HID, Container ID, números de série, leituras de configuração e dados pessoais não fazem parte do pedido de foto.
- Bloqueios de acesso, validações de navegador/CAPTCHA, indisponibilidade e limites do site são tratados como falhas. Nenhuma barreira é contornada.

## Implementação

photo_rules.rs: normalização, correspondência, fontes conhecidas e parsing de metadados.
photo_http.rs: WinHTTP e Windows Imaging Component; sem navegador automatizado ou subprocesso.
photos.rs: serviço em worker, preferências, cache e IPC.
photoSearch.ts: deduplicação, cache de sessão e estado das preferências.
DeviceArt.tsx: prioridade das fotos e controles de correção.

WinHTTP e WIC são recursos nativos do Windows. As dependências diretas adicionais base64, url e regex já existiam transitivamente no projeto. CSP do frontend continua sem acesso externo: o backend consulta as fontes e a UI recebe somente uma miniatura PNG.

## Validação real

- G502 HERO: página oficial Logitech; miniatura 512×442, 55.772 bytes.
- G305 LIGHTSPEED: página oficial Logitech; foto de catálogo encontrada automaticamente (variante branca). Não é uma afirmação sobre a cor do aparelho do usuário.
- Razer DeathAdder V3: página oficial Razer; PNG original da galeria, miniatura 500×500.
- Segundo pedido G502 foi atendido pelo cache, com cached=true.
- Pedidos genéricos não geram pesquisa arbitrária. Sites limitados/sem correspondência permaneceram sem foto, com a razão disponível para correção.

Esses testes foram feitos no resolvedor de imagens com nomes públicos de produtos; não adicionam aparelhos fictícios à lista de hardware.
