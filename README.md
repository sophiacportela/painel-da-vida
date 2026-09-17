# Painel da Vida

App pessoal (não é Artifact do Claude, é um app de verdade, seu) com 7 pilares:
Saúde & corpo, Sono & descanso, Espiritualidade, Mente, Estudos, Carreira, Finanças.

Funciona sozinho, salvando no seu navegador (localStorage). Pra sincronizar entre
computador e celular, siga os passos abaixo (grátis, ~10 minutos, só uma vez).

## 1. Criar o banco de dados grátis (Supabase)

1. Vá em https://supabase.com e crie uma conta grátis (dá pra usar login do Google).
2. Crie um novo projeto (New Project). Escolha uma senha de banco qualquer — não
   vai precisar dela no dia a dia.
3. Espere o projeto terminar de subir (1-2 minutos).
4. No menu lateral, vá em **SQL Editor** → **New query**.
5. Abra o arquivo `sql/schema.sql` desta pasta, copie tudo, cole no editor e
   clique em **Run**.
6. Vá em **Project Settings** (ícone de engrenagem) → **API**.
7. Copie:
   - **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
   - **anon public key** (uma chave longa)

## 2. Colar as chaves no app

Abra o arquivo `config.js` desta pasta e preencha:

```js
window.SUPABASE_CONFIG = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "eyJhbGciOi...",
};
```

Salve. Pronto — o app já sincroniza.

## 3. Colocar o app no ar (pra abrir do celular também)

Mais simples: **GitHub Pages**, grátis, e você já usa GitHub.

1. Crie um repositório novo no GitHub chamado, por exemplo, `painel-da-vida`
   (pode deixar privado).
2. Suba os arquivos desta pasta pra esse repositório (Sophia, se quiser eu faço
   isso por você quando você confirmar o nome do repositório).
3. No repositório, vá em **Settings → Pages**, escolha a branch `main` e a
   pasta raiz (`/`). Salve.
4. Em alguns minutos o GitHub te dá um link tipo
   `https://seu-usuario.github.io/painel-da-vida/`.

## 4. Instalar como app no celular

1. Abra esse link no navegador do celular (Chrome/Safari).
2. Toque no menu do navegador → **"Adicionar à tela inicial"** (Android) ou
   **"Adicionar à Tela de Início"** (iPhone, no botão de compartilhar).
3. Vai aparecer um ícone de app de verdade, sem barra de navegador.

## Sem internet / sem Supabase configurado ainda

O app funciona igual, só que cada aparelho guarda os próprios dados
(localStorage). No topo da barra lateral ele avisa se está "sincronizado" ou
"só local".

## Onde cada coisa fica guardada

Tudo vive num objeto JSON só (arquivo `app.js`, função `defaultState()`).
Se um dia quiser mudar um pilar, mexe ali — não tem banco de dados complexo
por trás, é tudo simples de propósito.
