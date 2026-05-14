# Kehl Study — Desktop Infrastructure

Este documento descreve a arquitetura desktop do Kehl Study e os passos necessários para suporte futuro ao macOS.

## Arquitetura Atual (Windows)

- **Engine**: Electron + Next.js (Standalone)
- **Database**: SQLite (via `better-sqlite3` e Prisma)
- **Persistência**: 
  - Banco de dados localizado em `%APPDATA%/kehl/database.db`
  - Pasta de PDFs (Inbox) localizada em `%USERPROFILE%/Downloads/KehlStudy_Inbox` por padrão.
- **Auto-Update**: Gerenciado pelo `electron-updater` via GitHub Releases.

## Futuro: Suporte para macOS

Para gerar a versão macOS (`.app` ou `.dmg`), os seguintes passos serão necessários:

### 1. Ambiente de Build
O build de macOS **deve** ser realizado em um ambiente macOS (físico ou VM) devido à necessidade de ferramentas da Apple (Xcode, `codesign`).

### 2. Code Signing & Notarization
Ao contrário do Windows (onde o NSIS funciona sem assinatura, embora com avisos), o macOS é extremamente rigoroso:
- É necessário ter uma conta de **Apple Developer** ($99/ano).
- O aplicativo deve ser assinado digitalmente (`codesign`).
- O aplicativo deve ser enviado para os servidores da Apple para "Notarization" antes de ser distribuído.

### 3. Rebuild de Módulos Nativos
O `better-sqlite3` e o `canvas` possuem binários nativos. No macOS:
- Devem ser recompilados para a arquitetura alvo: **Apple Silicon (arm64)** e **Intel (x64)**.
- O comando `electron-rebuild` deve ser executado no Mac.

### 4. Ajustes de Código
- **UserData**: `app.getPath("userData")` no Mac aponta para `~/Library/Application Support/kehl`. O código atual já é compatível com isso.
- **Downloads**: `app.getPath("downloads")` aponta para `~/Downloads`. Também compatível.
- **Menu**: O Electron requer um menu superior diferente para macOS (incluindo o item "Quit" no menu da maçã).

### 5. Scripts de Build
Adicionar ao `package.json`:
```json
"electron:build:mac": "next build && electron-builder --mac"
```

## Como Publicar uma Nova Versão (Windows)

1. Garanta que o `GITHUB_TOKEN` com permissão de escrita em repositórios está configurado nas variáveis de ambiente.
2. Atualize a `version` no `package.json`.
3. Rode `npm run electron:build:win`.
4. O `electron-builder` fará o upload do `.exe` e do arquivo `latest.yml` para as Releases do GitHub automaticamente.
5. Publique a release no GitHub (draft -> public).
6. Os aplicativos instalados detectarão a atualização automaticamente no próximo início.
