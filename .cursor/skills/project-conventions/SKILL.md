---
name: project-conventions
description: Convenções e contexto do projeto RazaiSystem. Use quando precisar seguir padrões do repositório.
---

# Convenções do Projeto RazaiSystem

## Stack Tecnológica

- **Backend**: Node.js + Express + TypeScript + Firebase Admin SDK
- **Frontend**: React + Vite + TypeScript + Firebase Client SDK + shadcn/ui + Tailwind CSS
- **Banco de Dados**: Firestore
- **Autenticação**: Firebase Authentication
- **Storage**: Firebase Storage

## Estrutura do Projeto

- `backend/` - API REST com Express
- `frontend/` - Aplicação React com Vite
- `.cursor/` - Configurações do Cursor (rules, skills, agents)

## Instruções

- Respeitar as regras em `.cursor/rules/`.
- Manter documentação e comentários em português quando o projeto for em português.
- Ao criar ou alterar arquivos, manter consistência com a estrutura existente do projeto.
- Backend usa Firebase Admin SDK para operações administrativas.
- Frontend usa Firebase Client SDK para operações do usuário.
- Usar paths/aliases TypeScript (@/components, @/lib) para imports organizados.

## Exemplos

- Novos módulos: criar na pasta apropriada (backend/src/ ou frontend/src/) e documentar no README se necessário.
- Commits: mensagens claras e objetivas, em português se for o padrão do time.
- Componentes React: usar shadcn/ui quando possível, criar em `frontend/src/components/ui/`.
- Rotas backend: criar em `backend/src/routes/` e registrar em `backend/src/index.ts`.
