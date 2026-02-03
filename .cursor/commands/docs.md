---
name: docs
description: Gera ou atualiza documentação do projeto. Acionado pelo usuário via /docs.
---

Analise o código, arquivos ou funcionalidades indicadas e gere/atualize documentação apropriada.

## Tipos de Documentação

### README.md
- Instruções de setup
- Estrutura do projeto
- Scripts disponíveis
- Variáveis de ambiente

### Documentação de API
- Endpoints disponíveis
- Parâmetros de requisição
- Respostas esperadas
- Exemplos de uso

### Documentação de Componentes
- Props e tipos
- Exemplos de uso
- Comportamento esperado

### Documentação de Funções/Hooks
- Parâmetros
- Retorno
- Exemplos de uso
- Casos de uso

## Formato

- Use Markdown
- Inclua exemplos de código quando relevante
- Seja claro e objetivo
- Mantenha em português quando o projeto for em português

## Quando Atualizar

- Ao adicionar novas features
- Ao mudar APIs ou interfaces
- Ao adicionar novos componentes públicos
- Quando a estrutura do projeto mudar

## Exemplos

### Documentação de API

```markdown
## GET /api/users

Retorna lista de usuários.

### Resposta

```json
{
  "success": true,
  "data": [
    { "id": "123", "name": "João", "email": "joao@example.com" }
  ]
}
```
```

### Documentação de Componente

```markdown
## Button

Componente de botão usando shadcn/ui.

### Props

- `variant`: 'default' | 'destructive' | 'outline' | 'ghost'
- `size`: 'default' | 'sm' | 'lg'
- `onClick`: () => void
```

Sempre mantenha a documentação atualizada e útil para desenvolvedores.
