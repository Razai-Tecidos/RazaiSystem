# Documentação do RazaiSystem

Bem-vindo à documentação completa do projeto RazaiSystem. Esta documentação cobre todos os aspectos do projeto, desde a arquitetura até detalhes de implementação.

## Índice

### Documentação Principal

1. **[README.md](../README.md)** - Visão geral do projeto, instalação e configuração
2. **[CONTEXT.md](../CONTEXT.md)** - Contexto técnico e padrões do projeto
3. **[ARCHITECTURE.md](ARCHITECTURE.md)** - Arquitetura detalhada e fluxos de dados

### Documentação Técnica

4. **[COMPONENTS.md](COMPONENTS.md)** - Documentação de componentes React
5. **[HOOKS.md](HOOKS.md)** - Documentação de custom hooks
6. **[SHOPEE.md](SHOPEE.md)** - Documentação da integração Shopee
7. **[SHOPEE_WEBHOOK_SETUP.md](SHOPEE_WEBHOOK_SETUP.md)** - Guia de configuração do webhook Shopee
8. **[SHOPEE_PRICING.md](SHOPEE_PRICING.md)** - Módulo de gestão de preços e margens
9. **[TECIDOS.md](../frontend/src/docs/TECIDOS.md)** - Documentação completa do módulo de Tecidos
10. **[ESTAMPAS.md](../frontend/src/docs/ESTAMPAS.md)** - Documentação do módulo de Estampas
11. **[CAPTURA_COR.md](../frontend/src/docs/CAPTURA_COR.md)** - Documentação do módulo de Captura de Cor com Colorímetro

## Guia Rápido

### Para Desenvolvedores Novos

1. Comece pelo [README.md](../README.md) para entender a estrutura e instalação
2. Leia [ARCHITECTURE.md](ARCHITECTURE.md) para entender a arquitetura
3. Consulte [CONTEXT.md](../CONTEXT.md) para padrões e convenções
4. Explore [COMPONENTS.md](COMPONENTS.md) e [HOOKS.md](HOOKS.md) para entender os componentes

### Para Trabalhar em Features

1. Consulte [CONTEXT.md](../CONTEXT.md) para padrões do projeto
2. Veja exemplos em [COMPONENTS.md](COMPONENTS.md) e [HOOKS.md](HOOKS.md)
3. Siga os padrões de UI otimista documentados em [ARCHITECTURE.md](ARCHITECTURE.md)
4. Documente novas features seguindo o formato existente

### Para Entender um Módulo Específico

- **Módulo de Tecidos**: [TECIDOS.md](../frontend/src/docs/TECIDOS.md)
- **Módulo de Estampas**: [ESTAMPAS.md](../frontend/src/docs/ESTAMPAS.md)
  - Cadastro individual e em lote
  - SKU automático por família
  - Vinculação com tecidos estampados
- **Módulo de Captura de Cor**: [CAPTURA_COR.md](../frontend/src/docs/CAPTURA_COR.md)
- **Módulo Shopee Preços**: [SHOPEE_PRICING.md](SHOPEE_PRICING.md)
  - Gestão de custos por SKU
  - Cálculo de margens considerando taxas Shopee (20% + R$4)
  - Dashboard de performance financeira
  - Regras de automação de preços
  - Fluxo completo de captura com lista
  - Validação de conflitos com Delta E 2000
  - Visualização com algoritmo de Reinhart
- **Componentes de Layout**: [COMPONENTS.md](COMPONENTS.md) - Seção "Componentes de Layout"
- **Autenticação**: [HOOKS.md](HOOKS.md) - Seção "useAuth"
- **Utilitários de Cor**: [HOOKS.md](HOOKS.md) - Seção "Utilitários de Cor" e "Utilitários de DeltaE"

## Estrutura de Documentação

```
docs/
├── README.md              # Este arquivo (índice)
├── ARCHITECTURE.md        # Arquitetura e fluxos
├── COMPONENTS.md          # Componentes React
├── HOOKS.md               # Custom hooks
├── DEPLOY_FIREBASE.md     # Guia de deploy
├── SHOPEE.md              # Integração Shopee
├── SHOPEE_WEBHOOK_SETUP.md # Configuração webhook Shopee
└── SHOPEE_PRICING.md      # Módulo de preços e margens

frontend/src/docs/
├── TECIDOS.md         # Documentação do módulo Tecidos
├── ESTAMPAS.md        # Documentação do módulo Estampas
├── CAPTURA_COR.md     # Documentação do módulo Captura de Cor
└── REINHARD.md        # Documentação do algoritmo Reinhard

CONTEXT.md             # Contexto técnico e padrões
README.md              # Documentação principal
```

## Convenções de Documentação

- **Código**: Sempre em blocos de código com syntax highlighting
- **Exemplos**: Sempre incluir exemplos práticos de uso
- **Tipos**: Sempre documentar interfaces TypeScript
- **Props**: Listar todas as props com tipos e descrições
- **Fluxos**: Usar diagramas ASCII quando útil

## Atualização da Documentação

A documentação deve ser atualizada sempre que:
- Novos componentes são criados
- Novos hooks são adicionados
- Padrões mudam
- Arquitetura evolui
- Novos módulos são implementados
- Constantes globais são adicionadas (ex: `DELTA_E_LIMIAR_CONFLITO`)

Consulte [CONTEXT.md](../CONTEXT.md) para mais detalhes sobre quando atualizar documentação.

## Constantes Globais Importantes

### Delta E Limiar de Conflito

**Localização**: `frontend/src/lib/deltaE.ts`

```typescript
export const DELTA_E_LIMIAR_CONFLITO = 3;
```

Esta constante define o limiar usado em todo o projeto para detectar conflitos de cores. Valores abaixo de 3 indicam cores muito próximas que podem causar confusão.

**Uso**: Sempre importe e use esta constante ao invés de valores hardcoded:

```typescript
import { DELTA_E_LIMIAR_CONFLITO } from '@/lib/deltaE';

// ✅ Correto
if (deltaE < DELTA_E_LIMIAR_CONFLITO) { ... }

// ❌ Incorreto
if (deltaE < 3) { ... }
```

## Contribuindo

Ao adicionar novas funcionalidades:
1. Documente no arquivo apropriado
2. Atualize este índice se necessário
3. Siga os padrões estabelecidos
4. Inclua exemplos práticos
