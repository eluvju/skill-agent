# OpenClaw Agent

Skill para monitoramento e controle remoto de instâncias OpenClaw. Permite que um dashboard central gerencie múltiplas instâncias.

## Uso

```bash
cd /root/.openclaw/workspace/skills/skill-agent
npm install
cp references/config.example.json references/config.json
# Editar config.json com suas configurações
node agent.js
```

## Configuração

Editar `references/config.json`:

```json
{
  "port": 3041,
  "apiKey": "sua-api-key-secreta",
  "instanceName": "nome-da-instancia",
  "openclaw": {
    "workspace": "/root/.openclaw/workspace",
    "gatewayPort": 18789
  }
}
```

## API Endpoints

### Autenticação

Todas as requisições devem incluir o header:
```
Authorization: Bearer <apiKey>
```

### Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/status` | Status completo da instância |
| GET | `/api/metrics` | Métricas do sistema |
| GET | `/api/sessions` | Lista de sessões |
| GET | `/api/cron` | Lista de cron jobs |
| GET | `/api/logs` | Logs recentes |
| POST | `/api/cron/:id/:action` | Ativar/desativar cron |
| POST | `/api/command` | Executar comando |

## Integração com Dashboard

No dashboard central, adicionar a instância:

```json
{
  "name": "Cliente A",
  "url": "https://cliente-a.com:3041",
  "apiKey": "sua-api-key"
}
```

## Instalação em Cliente

```bash
# 1. Clone ou copie a skill para o diretório de skills
cd /root/.openclaw/workspace/skills
git clone https://github.com/seu-repo/skill-agent

# 2. Instale as dependências
cd skill-agent
npm install

# 3. Configure
cp references/config.example.json references/config.json
nano references/config.json

# 4. Inicie
node agent.js

# 5. (Opcional) Configure para iniciar automaticamente
sudo systemctl enable openclaw-agent
```

## Demonstração

A skill inclui uma página de demonstração em `/` que mostra o status visual.

## Segurança

- Sempre use HTTPS em produção
- Mantenha a API key segura
- Recomenda-se usar firewall para limitar acesso
- Altere a porta padrão (3041)

## Troubleshooting

### Agent não inicia
```bash
# Verificar se a porta está em uso
netstat -tulpn | grep 3041

# Ver logs
node agent.js
```

### Não consegue conectar
```bash
# Verificar firewall
sudo ufw status

# Abrir porta
sudo ufw allow 3041/tcp
```

## Licença

MIT
