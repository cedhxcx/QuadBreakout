# QuadBreakout

Arcade multiplayer em HTML5 Canvas com salas PeerJS, quatro cores iniciais e bots para preencher as vagas.

## Executar

Para testar localmente, sirva esta pasta com qualquer servidor HTTP estático e abra a URL local no navegador. Não abra o arquivo diretamente via `file://`, pois o jogo precisa carregar PeerJS e estabelecer conexões WebRTC.

O jogo não usa etapa de build nem dependências locais; PeerJS 1.5.4 é carregado por CDN. Também pode ser publicado diretamente no GitHub Pages.

## Partida

- O host escolhe de 2 a 8 participantes no lobby.
- Com 2 participantes, a arena é um retângulo com jogadores nas laterais esquerda e direita; as bordas superior e inferior rebatem a bola.
- Com 3 ou mais, a arena se transforma em um polígono regular com uma defesa por lado: triângulo, quadrado, pentágono até octógono.
- As vagas sem jogadores humanos são preenchidas por bots quando a partida começa.
- O host configura duração e pontuação-alvo.
- A, D e setas movem nas arestas horizontais; W, S e setas movem nas arestas verticais. Nas arenas poligonais, o movimento segue a direção da aresta mais próxima.
- Rebater uma bola define sua cor como a do jogador. Fazer gol com bola adversária vale um ponto; gol contra remove um ponto, sem pontuação negativa. Bolas brancas são neutras.
- Blocos roxos liberam 20 bolas da mesma cor. Quando todos os blocos acabam, uma nova matriz aparece após 3 segundos.

## Publicar no GitHub Pages

O workflow em `.github/workflows/pages.yml` publica automaticamente cada push na branch `main`. O repositório-fonte pode permanecer privado; o site do GitHub Pages pode ficar publicamente acessível. A publicação de Pages a partir de repositórios privados depende do plano e das configurações da conta GitHub.

## Testes locais

Com Node.js instalado, execute:

```text
node tests/physics.test.cjs
```

Node.js é usado somente para os testes; não é necessário para hospedar ou jogar.
