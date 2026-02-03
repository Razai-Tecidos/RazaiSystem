---
name: frontend-development
description: Guia para desenvolvimento frontend no RazaiSystem. Use quando trabalhar em arquivos do frontend/, criar componentes React, adicionar páginas, ou trabalhar com Firebase Client SDK, shadcn/ui ou Tailwind CSS.
---

# Desenvolvimento Frontend - RazaiSystem

## Stack

- **Framework**: React 18 + Vite + TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **Firebase**: Client SDK (Auth, Firestore, Storage, Analytics)
- **Ícones**: lucide-react

## Estrutura de Pastas

```
frontend/src/
├── components/     # Componentes reutilizáveis
│   └── ui/        # Componentes shadcn/ui
├── pages/         # Páginas da aplicação
├── hooks/          # Custom hooks
├── context/       # Context API (AuthContext, etc)
├── lib/           # Utilitários (utils.ts)
└── config/        # Configurações (firebase.ts)
```

## Convenções

### Componentes

- Use componentes funcionais com hooks
- Prefira TypeScript com tipos explícitos
- Use shadcn/ui para componentes de UI quando possível
- Componentes customizados em `components/`, não em `components/ui/`
- Componentes shadcn em `components/ui/` (gerados via CLI)

### Imports

Use paths/aliases TypeScript:
```typescript
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { auth, db } from '@/config/firebase';
```

### Estilização

- Use Tailwind CSS para estilos
- Use a função `cn()` para combinar classes condicionalmente
- Siga o sistema de design do shadcn/ui (variáveis CSS em `index.css`)

### Firebase Client SDK

```typescript
import { auth, db, storage } from '@/config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
```

## Workflows Comuns

### Adicionar Componente shadcn/ui

```bash
cd frontend
npx shadcn-ui@latest add [nome-do-componente]
```

Exemplo: `npx shadcn-ui@latest add button card input`

### Criar Novo Componente

1. Criar arquivo em `components/[NomeComponente].tsx`
2. Usar TypeScript com props tipadas
3. Usar `cn()` para classes condicionais
4. Exportar como default ou named export

### Criar Nova Página

1. Criar arquivo em `pages/[NomePage].tsx`
2. Usar componentes de `components/` e `components/ui/`
3. Implementar roteamento se necessário

### Criar Custom Hook

1. Criar arquivo em `hooks/use[NomeHook].ts`
2. Nome começar com `use`
3. Retornar objeto ou array com valores/funções

### Usar Context API

1. Criar arquivo em `context/[NomeContext].tsx`
2. Criar Provider component
3. Criar hook customizado `use[NomeContext]()` para consumir
4. Envolver app no Provider no `main.tsx` ou `App.tsx`

## Exemplos

### Componente com shadcn/ui

```typescript
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  className?: string;
}

export function MyComponent({ className }: MyComponentProps) {
  return (
    <Card className={cn("p-4", className)}>
      <Button variant="default">Clique aqui</Button>
    </Card>
  );
}
```

### Hook com Firebase

```typescript
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

export function useCollection(collectionName: string) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const snapshot = await getDocs(collection(db, collectionName));
      setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchData();
  }, [collectionName]);

  return { data, loading };
}
```

### Context de Autenticação

```typescript
import { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```
