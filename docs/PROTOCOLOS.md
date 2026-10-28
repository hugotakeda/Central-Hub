# Consultas de identificação

Implementação Rust de identificação e configuração restrita aos recursos abaixo. Fontes técnicas primárias consultadas em 27/10/2026:

- [libratbag: Superlight original](https://github.com/libratbag/libratbag/blob/master/data/devices/logitech-g-pro-x-wireless-superlight.device): associação dos IDs de transporte 4093 e C094 ao modelo original.
- [Solaar: identidade PRO X Wireless](https://github.com/pwr-Solaar/Solaar/blob/master/docs/devices/PRO%20X%20Wireless%204093.txt): exemplo de identidade e recursos HID++.
- [OpenMouse: HID++](https://github.com/OpenMouse-Project/mouse-protocol/blob/main/src/drivers/logitech/hidpp.ts): sequência de consulta dos recursos 0003/0005, leitura do nome em fragmentos e correlação de respostas.
- [OpenRGB: detecção Sinowealth](https://github.com/CalcProgrammer1/OpenRGB/blob/master/Controllers/SinowealthController/SinowealthControllerDetect.cpp): consulta do cabeçalho de modelo via report 06/comando 82.
- [OpenRGB: códigos de modelo](https://github.com/CalcProgrammer1/OpenRGB/blob/master/Controllers/SinowealthController/SinowealthKeyboard10cController/SinowealthKeyboard10cDevices.cpp): CD corresponde ao F75; o VID/PID é compartilhado com outros produtos.

HID++: o app consulta o recurso de identidade 0003, exige os seis bytes 40 93 C0 94 00 00, consulta o recurso de nome 0005 e lê seus fragmentos. Usa a coleção vendor de relatório longo e filtra por report, slot, recurso e ID de software. Um timeout não gera identidade.

F75 USB: o app confirma no descritor um feature report 06 de 520 bytes. Envia a solicitação de leitura de cabeçalho, valida o eco/endereço/tamanho e exige CD no campo de modelo. Outras coleções não recebem a consulta.

A resposta observada do teclado foi: 06 82 01 00 01 00 06 00 03 00 00 00 00 CD. Essa consulta identifica o modelo; as alterações usam comandos distintos e validados.

Os pacotes e drivers completos desses projetos não foram incorporados ao app. As referências documentam a origem dos fatos de protocolo; respectivas licenças e avisos permanecem nos projetos citados.

## Configuração 0.5.0

Fontes adicionais: [F75 feature transport](https://github.com/cloudglides/aula-f75-linux-drivers/blob/main/web/src/lib/f75.ts), [layout da região](https://github.com/cloudglides/aula-f75-linux-drivers/blob/main/web/src/lib/f75-layout.ts), [referência do protocolo](https://github.com/cloudglides/aula-f75-linux-drivers/blob/main/docs/PROTOCOL.md), [tabela OEM do F75](https://github.com/cloudglides/aula-f75-linux-drivers/blob/main/assets/oem/Dev/kb/wired/KB.ini).

HID++ 2201: lista anunciada e DPI do sensor 0; setSensorDpi seguido de getSensorDpi. HID++ 8060: bitmap dos intervalos em ms, estado e alteração do report rate. HID++ 8100: leitura/seleção entre memória e controle por software; sem gravar setores de perfil. HID++ 1004: percentual retornado, sem curva de estimativa.

F75: SET-then-GET do feature report 06, comando 84, endereço 00010000, comprimento 0080. Escrita de configuração: comando 04, mesma região, 128 bytes preservados por read-modify-write. Efeito no offset 10. Tabela de níveis nos offsets 64–101, em pares brilho/velocidade-cor; brilho global modifica apenas os bytes pares dessa tabela, velocidade global modifica apenas o nibble superior dos bytes ímpares. Efeitos 0–18 conforme conjunto interno; sem habilitar o modo de streaming ou a tabela de cores não validada.

A UI usa níveis numéricos e IDs dos efeitos. Não atribui nomes visuais ou interpreta uma fotografia como leitura do estado RGB. Testes nativos confirmaram as escritas e restauraram os bytes originais.