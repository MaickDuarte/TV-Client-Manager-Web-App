# TV Client Manager - Web App

Aplicativo web local para gerenciamento de clientes de TV por assinatura, IPTV e streaming. Ele roda no navegador e salva os dados no `localStorage`, sem backend.

## Como rodar localmente

Requisitos:

- Node.js 20 ou superior
- npm

Instale as dependencias:

```bash
npm install
```

Inicie o servidor local:

```bash
npm start
```

Abra no navegador:

```text
http://127.0.0.1:4173/index.html
```

## Abrir sem servidor

Tambem e possivel abrir o arquivo `index.html` diretamente no navegador. Nesse modo o app continua funcionando e os dados continuam salvos no `localStorage` do navegador.

## Rodar os testes

Instale o navegador de teste do Playwright na primeira vez:

```bash
npx playwright install chromium
```

Execute a suite:

```bash
npm test
```

## Dados locais

Os dados ficam salvos apenas no navegador usado para acessar o app. Para limpar tudo, use o botao `Limpar` dentro da aplicacao.
