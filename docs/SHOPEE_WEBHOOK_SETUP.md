# Configuração do Webhook Shopee - Guia Completo

Guia passo a passo para configurar o webhook `reserved_stock_change_push` no Shopee Partner Center.

## ✅ Pré-requisitos Verificados

- ✅ Endpoint deployado e funcionando
- ✅ URL: `https://us-central1-razaisystem.cloudfunctions.net/api/api/shopee/webhook`
- ✅ Método: `POST`
- ✅ Verificação de assinatura HMAC-SHA256 implementada

## 📋 Passo 1: Acessar o Shopee Partner Center

1. Abra seu navegador e acesse: **https://open.shopee.com/**
2. Faça login com suas credenciais do Shopee Partner
3. Você será redirecionado para o dashboard

## 📋 Passo 2: Navegar até Webhooks

1. No menu superior ou lateral, procure por:
   - **"Webhooks"**
   - **"Push Notifications"** 
   - **"Event Subscriptions"**
   - **"API Settings"** → **"Webhooks"**

2. Se não encontrar diretamente, tente:
   - **"Settings"** → **"Webhooks"**
   - **"Developer"** → **"Webhooks"**
   - **"Integration"** → **"Webhooks"**

## 📋 Passo 3: Adicionar Novo Webhook

1. Clique no botão **"Add Webhook"** ou **"Create Webhook"** ou **"Configure"**
2. Você verá um formulário para configurar o webhook

## 📋 Passo 4: Preencher Configurações

### Campo: Webhook URL
```
https://us-central1-razaisystem.cloudfunctions.net/api/api/shopee/webhook
```

**⚠️ IMPORTANTE**: Copie exatamente esta URL, incluindo o protocolo `https://`

### Campo: Event Type / Event Code
- **Código do Evento**: `8`
- **Nome do Evento**: `reserved_stock_change_push`
- **Descrição**: Get the reserved stock change log

**Alternativamente**, se houver uma lista de eventos:
- Procure por `reserved_stock_change_push`
- Ou selecione o evento com código `8`
- Ou marque a opção "Reserved Stock Change"

### Campo: Status
- Marque como **"Active"** ou **"Enabled"**

### Outros Campos (se disponíveis)
- **Timeout**: Deixe padrão (3 segundos)
- **Retry Policy**: Deixe padrão (300s, 1800s, 10800s)
- **Description**: "Monitora alterações de estoque reservado para manter cores desativadas com estoque zerado"

## 📋 Passo 5: Salvar Configuração

1. Revise todas as informações
2. Clique em **"Save"**, **"Create"** ou **"Submit"**
3. Anote o **Webhook ID** se fornecido (útil para referência futura)

## 📋 Passo 6: Verificar Configuração

Após salvar, você deve ver:
- ✅ Status: **Active** ou **Enabled**
- ✅ URL configurada corretamente
- ✅ Evento `reserved_stock_change_push` listado

## 🧪 Passo 7: Testar o Webhook

### Opção A: Teste via Shopee (Recomendado)

1. **Desative uma cor** no sistema RazaiSystem:
   - Acesse a página Shopee
   - Encontre um produto com cores
   - Desative o toggle de uma cor
   - Verifique o toast: "Cor desativada na Shopee. O estoque será mantido zerado automaticamente."

2. **Verifique no Firestore**:
   - Firebase Console → Firestore Database
   - Coleção: `disabled_colors`
   - Deve aparecer um documento com formato: `{shop_id}_{item_sku}_{color_option}`

3. **Crie um pedido de teste** na Shopee:
   - Use a cor que você desativou
   - Adicione ao carrinho
   - **NÃO finalize o pagamento**

4. **Cancele o pedido**:
   - Na Shopee, cancele o pedido antes do pagamento
   - Isso deve disparar o webhook `reserved_stock_change_push` com `action: "cancel_order"`

5. **Aguarde alguns segundos** e verifique:
   - Firebase Console → Functions → Logs
   - Filtre por `[Webhook]`
   - Deve aparecer: `[Webhook] Recebido evento reserved_stock_change_push`
   - Deve aparecer: `[Webhook] Estoque zerado novamente para item...`

### Opção B: Teste Manual (Avançado)

Se você tiver acesso a gerar assinaturas HMAC-SHA256:

```bash
# Exemplo de teste (requer gerar assinatura correta)
curl -X POST https://us-central1-razaisystem.cloudfunctions.net/api/api/shopee/webhook \
  -H "Content-Type: application/json" \
  -H "x-shopee-signature: <HMAC-SHA256 do body>" \
  -d '{
    "code": 8,
    "data": {
      "shop_id": 803215808,
      "item_id": 123456,
      "variation_id": 789,
      "action": "cancel_order",
      "changed_values": [{
        "name": "reserved_stock",
        "old": 10,
        "new": 11
      }]
    },
    "timestamp": 1660124246
  }'
```

## 📊 Monitoramento

### Logs do Firebase Functions

1. Acesse: **Firebase Console** → **Functions** → **Logs**
2. Filtre por `[Webhook]` para ver eventos recebidos
3. Logs esperados:
   - `[Webhook] Recebido evento reserved_stock_change_push`
   - `[Webhook] Processando cancel_order para item X, variation Y`
   - `[Webhook] Cor desativada encontrada: SKU X, cor Y`
   - `[Webhook] Estoque zerado novamente para item X, variation Y`

### Firestore - Estado das Cores Desativadas

1. Acesse: **Firebase Console** → **Firestore Database**
2. Coleção: `disabled_colors`
3. Verifique campos:
   - `last_maintained`: Última vez que o estoque foi verificado/zerado
   - `disabled_at`: Quando a cor foi desativada
   - `item_ids`: Lista de anúncios afetados
   - `model_ids`: Lista de modelos (variações) afetados

### Função Agendada

A função `maintainDisabledColors` executa a cada 1 hora e verifica todas as cores desativadas:
- Logs: Filtrar por `[Scheduled]`
- Verifica estoque e zera se necessário
- Atualiza `last_maintained` no Firestore

## 🔧 Troubleshooting

### Problema: Webhook não está sendo recebido

**Sintomas**: Nenhum log `[Webhook]` aparece no Firebase

**Soluções**:
1. ✅ Verifique se a URL está correta e acessível
2. ✅ Confirme que o evento está configurado (code: 8)
3. ✅ Verifique se o webhook está **Active** no Partner Center
4. ✅ Teste a URL manualmente (deve retornar 401 sem assinatura, não 404)
5. ✅ Verifique se há firewall bloqueando requisições da Shopee

### Problema: Erro "Assinatura inválida"

**Sintomas**: Logs mostram `[Webhook] Assinatura inválida`

**Soluções**:
1. ✅ Verifique se `SHOPEE_PARTNER_KEY` está configurado nas variáveis de ambiente do Firebase
2. ✅ Confirme que a chave está correta (sem espaços extras)
3. ✅ A Shopee deve estar enviando o header `x-shopee-signature`
4. ✅ Verifique se não há problemas de encoding no body

**Como verificar variáveis de ambiente**:
```bash
# No diretório functions/
firebase functions:config:get
```

Ou no Firebase Console:
- Functions → Configurações → Variáveis de ambiente

### Problema: Webhook recebido mas não processa

**Sintomas**: Logs mostram `[Webhook] Recebido evento` mas não processa

**Possíveis causas**:
1. **Action diferente**: O webhook só processa `action: "cancel_order"`
   - Logs mostrarão: `[Webhook] Ignorando evento com action=place_order`
   - ✅ Isso é normal para pedidos novos

2. **Nenhuma cor desativada**: Não há cor desativada para esse item/variation
   - Logs mostrarão: `[Webhook] Nenhuma cor desativada encontrada`
   - ✅ Isso é normal se a cor não foi desativada no sistema

3. **Erro ao zerar estoque**: Problema na API da Shopee
   - Logs mostrarão: `[Webhook] Erro ao zerar estoque`
   - ✅ Verifique se o `access_token` está válido
   - ✅ Verifique se há permissões na API da Shopee

### Problema: Estoque não está sendo zerado

**Sintomas**: Webhook processa mas estoque não muda na Shopee

**Soluções**:
1. ✅ Verifique logs para erros específicos
2. ✅ Confirme que o `access_token` está válido
3. ✅ Verifique se a API `/api/v2/product/update_stock` está funcionando
4. ✅ Teste manualmente zerar estoque via API
5. ✅ Verifique se há limites de rate na API da Shopee

## 📝 Estrutura do Evento Esperado

Quando um pedido é cancelado, a Shopee envia:

```json
{
  "code": 8,
  "data": {
    "shop_id": 803215808,
    "item_id": 123456,
    "variation_id": 789,
    "action": "cancel_order",
    "changed_values": [
      {
        "name": "reserved_stock",
        "old": 10,
        "new": 11
      }
    ],
    "promotion_type": "flash_sale",
    "promotion_id": 137899002020202,
    "ordersn": "220810QXVJM3EX",
    "update_time": 1660124246
  },
  "shop_id": 803215808,
  "timestamp": 1660124246
}
```

**Header obrigatório**:
```
x-shopee-signature: <HMAC-SHA256 do body usando partnerKey>
```

## 🔗 Referências

- [Shopee Open Platform - Webhooks](https://open.shopee.com/documents?module=2&type=1&id=365)
- [reserved_stock_change_push - Documentação Oficial](https://open.shopee.com/documents?module=2&type=1&id=365&subtype=8)
- [Firebase Functions - Logs](https://console.firebase.google.com/project/razaisystem/functions/logs)

## ✅ Checklist Final

Antes de considerar completo, verifique:

- [ ] Webhook configurado no Shopee Partner Center
- [ ] URL está correta e acessível
- [ ] Evento `reserved_stock_change_push` (code: 8) está selecionado
- [ ] Webhook está **Active/Enabled**
- [ ] `SHOPEE_PARTNER_KEY` configurado nas variáveis de ambiente
- [ ] Teste realizado: desativar cor → cancelar pedido → verificar logs
- [ ] Logs do Firebase mostram processamento correto
- [ ] Estoque foi zerado na Shopee após cancelamento

## 🎯 Próximos Passos Após Configuração

1. **Monitorar por 24-48 horas** para garantir funcionamento estável
2. **Verificar função agendada** executando corretamente (a cada 1 hora)
3. **Documentar** qualquer comportamento inesperado
4. **Ajustar** timeout/retry se necessário baseado nos logs

---

**Última atualização**: 2026-02-04  
**Versão do sistema**: 1.0.0
