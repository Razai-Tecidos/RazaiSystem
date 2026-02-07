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

**Última atualização**: 2026-02-06 (atualizado com novas funcionalidades de edição inline, validação de duplicados e geração de SKU)

## Processamento de Imagens

### Formato e Qualidade
- **Formato padrão**: PNG (sem perda de qualidade)
- **Resolução**: Mantém resolução original (sem limite de pixels)
- **Compressão**: Nenhuma compressão de qualidade aplicada

### Fluxo de Imagem
```
Imagem Original → Reinhard → PNG (resolução original) → Storage (imagemTingida)
```

> **Nota**: A funcionalidade de imagem com marca (logo) foi removida por decisão de negócio.

## Fluxo de Captura de Cor

### Divisão de Responsabilidades

**Tela de Captura de Cor**:
- Conexão Bluetooth com colorímetro LS173
- Captura automática via botão físico do dispositivo
- Lista simplificada de capturas (sem edição)
- Validação de conflitos com Delta E 2000
- Escolha de ação para conflitos: usar cor existente ou criar nova
- Envio de cores e vínculos para Firebase

**Tela de Gerenciar Cores**:
- Listagem de todas as cores cadastradas
- Edição de cores (nome, hex)
- Visualização de vínculos associados
- Navegação para edição de vínculos

**Tela de Vínculos**:
- Listagem de todos os vínculos cor-tecido agrupados por tecido
- Grupos expansíveis/colapsáveis por tecido
- Filtro por tecido e cor
- Coluna de SKU do vínculo (TecidoSKU-CorSKU)
- Coluna de HEX com clique para copiar
- Edição inline de nome da cor (Enter vai para próximo)
- Edição inline de SKU da cor (clique em "+ SKU" ou no SKU existente)
- Validação de nome duplicado com bloqueio e aviso
- Geração automática de SKU ao renomear cor
- Ações em lote por tecido:
  - Copiar SKUs, HEX, Nomes (separados por tab)
  - Download Preview em ZIP
- Exportação XLSX com imagens como mídia (não URLs)
- Barra de progresso visual durante exportação
- Geração em lote de SKUs (cores + vínculos)
- Diagnóstico de vínculos com referências inválidas
- Edição de ajustes Reinhard
- Exclusão de vínculos

**Tela de Editar Vínculo**:
- Preview do tecido tingido (algoritmo Reinhard)
- Sliders de ajuste do algoritmo
- Correção manual de cor (coleta exemplos para ML)
- Salvamento da imagem tingida (PNG, resolução original)
- Geração automática de imagem com marca

### Separação Cor vs CorTecido

**Cor**: Entidade independente (nome, hex, LAB, sku)
**CorTecido**: Vínculo entre cor e tecido com campos:
- `sku`: SKU do vínculo (TecidoSKU-CorSKU, ex: "T007-MA001")
- `imagemTingida`: URL da imagem PNG (resolução original, sem compressão)
- `ajustesReinhard`: Configuração do algoritmo Reinhard
- Campos denormalizados: corNome, corHex, corSku, tecidoNome, tecidoSku

Uma cor pode ter múltiplos vínculos com diferentes tecidos, cada um com seus próprios ajustes.

### Validação de Nomes de Cores

- **Bloqueio de duplicados**: Sistema impede criar/editar cor com nome já existente
- **Case-insensitive**: "Azul" e "azul" são considerados duplicados
- **Exceção**: Nomes genéricos como "Cor capturada" são ignorados na validação
- **Feedback**: Toast vermelho com mensagem clara sobre o conflito
- **Input permanece aberto**: Permite correção sem perder o texto digitado

### Geração Automática de SKU

**Para Cores:**
- SKU gerado baseado na família do nome (ex: "Azul Royal" → "AZ001")
- Gerado automaticamente ao renomear cor que não tinha SKU
- Não gera para nomes genéricos ("Cor capturada")
- Sequencial por família (AZ001, AZ002, AZ003...)

**Para Vínculos:**
- Formato: `TecidoSKU-CorSKU` (ex: "T007-AZ001")
- Gerado automaticamente quando cor e tecido têm SKU
- Botão "Gerar SKUs" processa em lote cores e vínculos pendentes

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

### Cores Migradas
- Cores antigas tinham campos de tecido diretamente (tecidoId, imagemTingida, etc.)
- Migração criou documentos CorTecido separados
- Campos de tecido nas cores foram limpos (setados para null)
