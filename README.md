# QuadBreakout

Arcade multiplayer em HTML5 Canvas com salas PeerJS, cores personalizáveis e bots para preencher as vagas.

## Executar

Para testar localmente, sirva esta pasta com qualquer servidor HTTP estático e abra a URL local no navegador. Não abra o arquivo diretamente via `file://`, pois o jogo precisa carregar PeerJS e estabelecer conexões WebRTC.

O jogo não usa etapa de build nem dependências locais; PeerJS 1.5.4 é carregado por CDN. Também pode ser publicado diretamente no GitHub Pages.

## Partida

- Ao abrir um link de convite (`?room=CODIGO`), o jogador escolhe o nome e entra diretamente nessa sala; a criação e a entrada manual por código ficam disponíveis na página inicial sem convite.
- O anfitrião cria uma sala com um código aleatório de quatro letras. O código aparece na URL e qualquer jogador no lobby pode copiar/compartilhar o link de convite.
- O host escolhe de 2 a 8 participantes no lobby.
- Com 2 participantes, a arena é um retângulo com jogadores nas laterais esquerda e direita; as bordas superior e inferior rebatem a bola.
- Com 3 ou mais, a arena se transforma em um polígono regular com uma defesa por lado: triângulo, quadrado, pentágono até octógono.
- As vagas sem jogadores humanos são preenchidas por bots quando a partida começa.
- O host configura duração e pontuação-alvo.
- Cada jogador escolhe sua própria cor no lobby. O host também configura o intervalo de reaparecimento dos blocos, de 30 a 120 segundos.
- A, D e setas movem nas arestas horizontais; W, S e setas movem nas arestas verticais. Nas arenas poligonais, o movimento segue a direção da aresta mais próxima.
- Rebater uma bola define sua cor como a do jogador. Fazer gol com bola adversária vale um ponto; gol contra remove um ponto, sem pontuação negativa. Bolas brancas são neutras.
- A arena mantém de 1 a 2 blocos especiais de multiball, separados e distribuídos em quadrantes próximos ao centro. Cada bloco exige 2 ou 3 impactos e libera multibolas; a partida mantém no máximo 5 bolas simultâneas.
- Quando todos os blocos de multiball acabam, o contador aparece acima da arena. Novos blocos especiais surgem após o intervalo configurado (30 segundos por padrão).
- Um power-up aleatório de gelo ou fogo surge no centro após 3 segundos, mesmo enquanto blocos multiball estiverem ativos. A bola que o coleta fica marcada com o efeito; ao rebater na barra, aplica lentidão (0,75×) ou aceleração (1,25×) por 8 segundos. O próximo power-up aparece 15 segundos após a coleta; se não for coletado, permanece no campo. Blocos reaparecem sem ocupar a posição de um power-up ativo.

## Publicar no GitHub Pages

O workflow em `.github/workflows/pages.yml` publica automaticamente cada push na branch `main`. O repositório-fonte pode permanecer privado; o site do GitHub Pages pode ficar publicamente acessível. A publicação de Pages a partir de repositórios privados depende do plano e das configurações da conta GitHub.

## Testes locais

Com Node.js instalado, execute:

```text
node tests/physics.test.cjs
```

Node.js é usado somente para os testes; não é necessário para hospedar ou jogar.
