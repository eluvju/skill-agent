const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// Carregar configuração
const configPath = path.join(__dirname, 'references/config.json');
let config = {};

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (err) {
  console.error('Erro ao carregar config.json:', err.message);
  console.log('Copie references/config.example.json para references/config.json');
  process.exit(1);
}

const app = express();
const PORT = config.port || 3041;

// Middleware
app.use(express.json());

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: config.rateLimit?.windowMs || 60000,
  max: config.rateLimit?.maxRequests || 100
});
app.use(limiter);

// Auth middleware
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'API key required' });
  }
  
  const token = authHeader.substring(7);
  
  if (token !== config.apiKey) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid API key' });
  }
  
  next();
};

// Helper para executar comandos OpenClaw
function execOpenClaw(command) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(stdout);
    });
  });
}

// ========== ENDPOINTS ==========

// Health check (sem auth)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    instanceName: config.instanceName,
    timestamp: new Date().toISOString()
  });
});

// Status completo (com auth)
app.get('/api/status', requireAuth, async (req, res) => {
  try {
    const output = await execOpenClaw('openclaw status --json');
    const status = JSON.parse(output);
    
    res.json({
      instance: {
        name: config.instanceName,
        description: config.description,
        uptime: os.uptime(),
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch()
      },
      openclaw: status,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get status', details: err.message });
  }
});

// Métricas do sistema
app.get('/api/metrics', requireAuth, async (req, res) => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total * 100);
    }, 0) / cpus.length;
    
    // Disco
    const diskOutput = await execOpenClaw('df -h / | tail -1');
    const diskMatch = diskOutput.match(/(\S+)\s+(\S+)\s+(\S+)\s+(\S+)%\s+/);
    
    res.json({
      cpu: {
        cores: cpus.length,
        usage: Math.round(cpuUsage * 100) / 100
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: Math.round((usedMem / totalMem) * 10000) / 100
      },
      disk: diskMatch ? {
        total: diskMatch[1],
        used: diskMatch[2],
        available: diskMatch[3],
        usagePercent: parseInt(diskMatch[4])
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get metrics', details: err.message });
  }
});

// Lista de sessões
app.get('/api/sessions', requireAuth, async (req, res) => {
  try {
    const output = await execOpenClaw('openclaw status --json');
    const status = JSON.parse(output);
    
    const sessions = status.sessions?.recent || [];
    
    res.json({
      count: status.sessions?.count || 0,
      recent: sessions.slice(0, 20),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get sessions', details: err.message });
  }
});

// Cron jobs
app.get('/api/cron', requireAuth, async (req, res) => {
  try {
    const output = await execOpenClaw('openclaw cron list --json');
    const jobs = JSON.parse(output);
    
    res.json({
      jobs: jobs,
      count: jobs.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get cron jobs', details: err.message });
  }
});

// Ativar/desativar cron
app.post('/api/cron/:id/:action', requireAuth, async (req, res) => {
  const { id, action } = req.params;
  const cmd = action === 'enable' ? 'enable' : 'disable';
  
  try {
    await execOpenClaw(`openclaw cron ${cmd} ${id}`);
    res.json({ success: true, message: `Cron job ${action}ed` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle cron', details: err.message });
  }
});

// Logs
app.get('/api/logs', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logPath = '/root/.openclaw/logs/gateway.log';
    
    if (!fs.existsSync(logPath)) {
      return res.json({ logs: [], message: 'Log file not found' });
    }
    
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').slice(-limit);
    
    res.json({
      logs: lines.filter(l => l.trim()),
      count: lines.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get logs', details: err.message });
  }
});

// Executar comando
app.post('/api/command', requireAuth, async (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command required' });
  }
  
  // Lista de comandos permitidos
  const allowedCommands = [
    'openclaw status',
    'openclaw cron list',
    'openclaw cron enable',
    'openclaw cron disable',
    'openclaw health',
    'uptime',
    'free -h',
    'df -h'
  ];
  
  const isAllowed = allowedCommands.some(cmd => command.startsWith(cmd));
  
  if (!isAllowed) {
    return res.status(403).json({ error: 'Command not allowed' });
  }
  
  try {
    const output = await execOpenClaw(command);
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: 'Command failed', details: err.message });
  }
});

// Página de demonstração
app.get('/', (req, res) => {
  const demoHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Agent - ${config.instanceName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117; color: #f0f6fc; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: #161b22; border: 1px solid #30363d; border-radius: 8px;
      padding: 40px; max-width: 500px; width: 100%;
    }
    h1 { color: #58a6ff; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
    .badge { 
      background: #238636; color: #fff; padding: 4px 12px; border-radius: 12px;
      font-size: 0.75rem;
    }
    .info { margin-top: 24px; }
    .info p { margin: 8px 0; color: #8b949e; }
    .info strong { color: #f0f6fc; }
    .api-box {
      background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
      padding: 16px; margin-top: 24px; font-family: monospace; font-size: 0.85rem;
    }
    .api-box code { color: #7ee787; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🤖 OpenClaw Agent <span class="badge">Online</span></h1>
    <p style="color: #8b949e; margin-top: 8px;">${config.instanceName}</p>
    
    <div class="info">
      <p><strong>Instância:</strong> ${config.instanceName}</p>
      <p><strong>Hostname:</strong> ${os.hostname()}</p>
      <p><strong>Uptime:</strong> ${Math.floor(os.uptime() / 3600)}h</p>
      <p><strong>Plataforma:</strong> ${os.platform()} (${os.arch()})</p>
    </div>
    
    <div class="api-box">
      <p style="color: #8b949e; margin-bottom: 8px;">Para acessar a API:</p>
      <code>curl -H "Authorization: Bearer API_KEY" http://localhost:${PORT}/api/status</code>
    </div>
  </div>
</body>
</html>
  `;
  
  res.send(demoHtml);
});

// ========== INÍCIO ==========

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║         OpenClaw Agent                           ║
║         Instância: ${config.instanceName.padEnd(28)}║
║         Porta: ${PORT.toString().padEnd(33)}║
║         API Key: ${config.apiKey.substring(0, 8) + '...'.padEnd(27)}║
╚═══════════════════════════════════════════════════╝

Acesse: http://localhost:${PORT}
Docs:   http://localhost:${PORT}/health (sem auth)
  `);
});
