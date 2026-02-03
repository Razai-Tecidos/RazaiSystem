# Contexto Técnico - RazaiSystem

> **IMPORTANTE**: Este arquivo deve ser atualizado sempre que houver decisões importantes ou mudanças de padrão no projeto. Mantenha sempre atualizado para garantir que informações críticas sejam preservadas durante compressão de contexto.

## Padrões de Formatação

### Números Decimais
- **Padrão brasileiro**: Use vírgula (,) como separador decimal
- Exemplo: `1,50` metros (não `1.50`)
- Conversão automática:
  - Ao salvar: vírgula → ponto (para compatibilidade com banco)
  - Ao exibir: ponto → vírgula (para usuário brasileiro)
- **Aplicar em**: Todos os campos numéricos do projeto

### Unidades de Medida
- **Largura**: Sempre em metros (não centímetros)
- Exemplo: `1,50` metros
- Input aceita vírgula ou ponto, converte automaticamente

## Decisões de UI/UX

### Campo de Composição
- Campo de **texto livre** simples (Textarea)
- Não há múltiplos campos ou agrupamento
- Não há botão "Adicionar" ou "Remover"
- Apenas um campo Textarea para digitar a composição
- Apenas valida se está preenchido
- Exemplo: "Algodão 60%, Poliester 40%"

### Formatação de Valores
- Valores numéricos sempre exibidos com vírgula
- Tabelas e formulários seguem padrão brasileiro
- Placeholders e exemplos usam vírgula

## Padrões Técnicos

### UI Otimista
- Padrão implementado em operações CRUD
- Atualização imediata da interface antes da confirmação do servidor
- Reversão automática em caso de erro
- Feedback visual durante operações (loading states)
- Toasts para feedback de ações

### Estrutura de Dados
- Composição: string simples (texto livre), não é mais array
- Compatibilidade: dados antigos em array são convertidos automaticamente para string ao carregar
- Largura: número em metros (armazenado como float)
- SKU: formato T001, T002, etc. (não reutiliza SKUs excluídos)

### Validação de TO-DOs
- **OBRIGATÓRIO**: Após executar qualquer plano, sempre validar se todos os TO-DOs foram marcados como `completed`
- Usar `todo_write` durante execução para atualizar status
- Nunca finalizar plano sem marcar todos os TO-DOs
- Ver regra completa em `.cursor/rules/todo-validation.mdc`

## Quando Atualizar Este Arquivo

Atualize CONTEXT.md sempre que:
- [ ] Nova decisão de formatação é estabelecida
- [ ] Padrão de UI/UX é definido ou alterado
- [ ] Convenção técnica importante é criada
- [ ] Regra de negócio crítica é implementada
- [ ] Mudança que afeta como código deve ser escrito
- [ ] Novo processo ou workflow é estabelecido

### Processo de Atualização

1. **Durante desenvolvimento**: Ao fazer mudanças importantes, atualizar CONTEXT.md imediatamente
2. **Ao finalizar features**: Revisar se novas decisões precisam ser documentadas
3. **Revisão periódica**: Verificar se CONTEXT.md reflete o estado atual do projeto

### Exemplos do que Documentar

- Padrões de formatação (vírgula vs ponto, unidades, etc.)
- Decisões de UI (campos texto livre, agrupamento visual, etc.)
- Convenções de código (nomenclatura, estrutura, etc.)
- Padrões técnicos (UI otimista, estrutura de dados, etc.)
- Regras de negócio importantes

**Última atualização**: 2026-02-03

## Fluxo de Captura de Cor

### Divisão de Responsabilidades

**Tela de Captura de Cor**:
- Conexão Bluetooth com colorímetro LS173
- Captura automática via botão físico do dispositivo
- Lista simplificada de capturas (sem edição)
- Validação de conflitos com Delta E 2000
- Envio de cores para Firebase

**Tela de Gerenciar Cores**:
- Edição de cores (nome, hex)
- Preview do tecido tingido (algoritmo Reinhart)
- Sliders de ajuste de cor (matiz, saturação, brilho, contraste)
- Informações da captura (LAB, tecido associado)

### Protocolo do Colorímetro LS173

- Pacote de 64 bytes
- Header: `AB 44`
- L, a, b: int16 little-endian dividido por 100
- Offsets: L=8, a=10, b=12

## Compatibilidade com Dados Antigos

### Composição
- Dados antigos podem estar armazenados como array de ComposicaoItem[]
- Sistema converte automaticamente para string ao carregar
- Novos dados sempre salvos como string
