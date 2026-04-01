require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Ensure required directories exist
const dirs = ['./campaigns', './videos', './templates', './exports'];
dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Import routes
const campaignRoutes = require('./routes/campaigns');
const videoRoutes = require('./routes/videos');
const agentRoutes = require('./routes/agents');
const editorRoutes = require('./routes/editor');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const intelligenceRoutes = require('./routes/intelligence');

// Use routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/intelligence', intelligenceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'running', 
    timestamp: new Date().toISOString(),
    features: {
      campaigns: true,
      videoGeneration: true,
      multiAgent: true,
      editor: true,
      auth: true,
      intelligence: true
    }
  });
});

// Serve frontend for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    WhopRunner Server v2                        ║
║               http://localhost:${PORT}                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Auth:               /api/auth                                 ║
║  Campaign Browser:   /api/campaigns                            ║
║  Intelligence:       /api/intelligence                         ║
║  Video Generation:   /api/videos                               ║
║  Agent System:       /api/agents                               ║
║  Editor:             /api/editor                               ║
║  Dashboard:          /api/dashboard                            ║
╚═══════════════════════════════════════════════════════════════╝`);
});
