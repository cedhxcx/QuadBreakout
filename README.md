# QuadBreakout

Arcade multiplayer em HTML5 Canvas com salas PeerJS, cores personalizáveis e bots para preencher as vagas.

## Executar

Para testar localmente, sirva esta pasta com qualquer servidor HTTP estático e abra a URL local no navegador. Não abra o arquivo diretamente via `file://`, pois o jogo precisa carregar PeerJS e estabelecer conexões WebRTC.

O jogo não usa etapa de build nem dependências locais; PeerJS 1.5.4 é carregado por CDN. Também pode ser publicado diretamente no GitHub Pages.

## Partida

- O host escolhe de 2 a 8 participantes no lobby.
- Com 2 participantes, a arena é um retângulo com jogadores nas laterais esquerda e direita; as bordas superior e inferior rebatem a bola.
- Com 3 ou mais, a arena se transforma em um polígono regular com uma defesa por lado: triângulo, quadrado, pentágono até octógono.
- As vagas sem jogadores humanos são preenchidas por bots quando a partida começa.
- O host configura duração e pontuação-alvo.
- Cada jogador escolhe sua própria cor no lobby. O host também configura o intervalo de reaparecimento dos blocos, de 30 a 120 segundos.
- A, D e setas movem nas arestas horizontais; W, S e setas movem nas arestas verticais. Nas arenas poligonais, o movimento segue a direção da aresta mais próxima.
- Rebater uma bola define sua cor como a do jogador. Fazer gol com bola adversária vale um ponto; gol contra remove um ponto, sem pontuação negativa. Bolas brancas são neutras.
- A arena começa com 25 blocos e apenas 1 ou 2 blocos especiais. Os especiais precisam de 2 ou 3 impactos para liberar multibolas; a partida mantém no máximo 5 bolas simultâneas.
- Quando todos os blocos acabam, o contador aparece acima da arena. Uma nova matriz surge após o intervalo configurado (30 segundos por padrão).

## Publicar no GitHub Pages

O workflow em `.github/workflows/pages.yml` publica automaticamente cada push na branch `main`. O repositório-fonte pode permanecer privado; o site do GitHub Pages pode ficar publicamente acessível. A publicação de Pages a partir de repositórios privados depende do plano e das configurações da conta GitHub.

## Testes locais

Com Node.js instalado, execute:

```text
node tests/physics.test.cjs
```

Node.js é usado somente para os testes; não é necessário para hospedar ou jogar.
