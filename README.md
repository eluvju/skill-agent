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
  "description": "Descrição opcional da instância",
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
| GET | `/health` | Health check (sem auth) |
| GET | `/api/status` | Status completo da instância |
| GET | `/api/metrics` | Métricas do sistema (CPU, memória, disco) |
| GET | `/api/sessions` | Lista de sessões |
| GET | `/api/cron` | Lista de cron jobs |
| GET | `/api/logs` | Logs recentes |
| POST | `/api/cron/:id/:action` | Ativar/desativar cron |
| POST | `/api/command` | Executar comando |

## Instalação em Cliente

```bash
# 1. Clone ou copie a skill para o diretório de skills
cd /root/.openclaw/workspace/skills
git clone https://github.com/eluvju/skill-agent

# 2. Instale as dependências
cd skill-agent
npm install

# 3. Configure
cp references/config.example.json references/config.json
nano references/config.json

# 4. Inicie
node agent.js

# 5. (Opcional) Configure para iniciar automaticamente com systemd
sudo tee /etc/systemd/system/openclaw-agent.service > /dev/null <<EOF
[Unit]
Description=OpenClaw Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/.openclaw/workspace/skills/skill-agent
ExecStart=/usr/bin/node agent.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable openclaw-agent
sudo systemctl start openclaw-agent
```

## Demonstração

A skill inclui uma página de demonstração em `/` que mostra o status visual.

## Exemplos de Uso

```bash
# Health check
curl http://localhost:3041/health

# Status completo
curl -H "Authorization: Bearer SUA_API_KEY" http://localhost:3041/api/status

# Métricas
curl -H "Authorization: Bearer SUA_API_KEY" http://localhost:3041/api/metrics

# Lista de sessões
curl -H "Authorization: Bearer SUA_API_KEY" http://localhost:3041/api/sessions

# Cron jobs
curl -H "Authorization: Bearer SUA_API_KEY" http://localhost:3041/api/cron

# Logs
curl -H "Authorization: Bearer SUA_API_KEY" "http://localhost:3041/api/logs?limit=100"
```

## Segurança

- Sempre use HTTPS em produção (configure Nginx ou similar)
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
