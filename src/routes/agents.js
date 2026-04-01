const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory agent store
let activeAgents = [];
let agentIdCounter = 1;

// Agent states
const AGENT_STATES = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  GENERATING: 'generating',
  REVIEWING: 'reviewing',
  SUBMITTING: 'submitting',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// GET /api/agents - List all active agents
router.get('/', (req, res) => {
  const { userId, status } = req.query;
  
  let filtered = [...activeAgents];
  
  if (userId) {
    filtered = filtered.filter(a => a.userId === userId);
  }
  
  if (status) {
    filtered = filtered.filter(a => a.status === status);
  }
  
  res.json({
    agents: filtered,
    total: activeAgents.length,
    running: activeAgents.filter(a => a.status !== 'idle' && a.status !== 'completed').length
  });
});

// POST /api/agents/start - Start agent for a campaign
router.post('/start', (req, res) => {
  const { campaignId, campaignName, type, niche, userId, preferences = {} } = req.body;
  
  const agent = {
    id: `agent-${agentIdCounter++}`,
    campaignId,
    campaignName,
    type, // 'UGC' or 'Clipping'
    niche,
    userId,
    status: AGENT_STATES.SCANNING,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    preferences,
    stats: {
      scansCompleted: 0,
      videosGenerated: 0,
      videosSubmitted: 0,
      earnings: 0
    },
    currentTask: 'Scanning for viral trends...',
    progress: 0,
    logs: [{
      timestamp: new Date().toISOString(),
      message: 'Agent started - Initializing...'
    }]
  };
  
  activeAgents.push(agent);
  
  // Simulate agent workflow
  simulateAgentWork(agent.id);
  
  res.status(201).json({
    message: 'Agent started successfully',
    agent
  });
});

// POST /api/agents/:id/feedback - Send feedback to agent (chatbox)
router.post('/:id/feedback', (req, res) => {
  const { feedback, type } = req.body; // type: 'sound', 'subtitle', 'style', 'voice'
  
  const agent = activeAgents.find(a => a.id === req.params.id);
  
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  // Store preference
  if (!agent.preferences.history) {
    agent.preferences.history = [];
  }
  
  agent.preferences.history.push({
    type,
    feedback,
    timestamp: new Date().toISOString()
  });
  
  // Update specific preferences
  if (type === 'sound') {
    agent.preferences.avoidSounds = agent.preferences.avoidSounds || [];
    if (feedback.includes('dont') || feedback.includes('no') || feedback.includes('avoid')) {
      agent.preferences.avoidSounds.push(feedback);
    }
  }
  
  if (type === 'subtitle') {
    agent.preferences.subtitleStyle = agent.preferences.subtitleStyle || {};
    if (feedback.includes('color')) {
      // Extract color preference
      if (feedback.includes('black')) agent.preferences.subtitleStyle.color = 'black';
      if (feedback.includes('white')) agent.preferences.subtitleStyle.color = 'white';
    }
    if (feedback.includes('font')) {
      agent.preferences.subtitleStyle.font = 'preferred';
    }
  }
  
  agent.lastActivity = new Date().toISOString();
  agent.logs.push({
    timestamp: new Date().toISOString(),
    message: `Preference learned: ${type} - "${feedback}"`
  });
  
  res.json({
    message: 'Feedback received',
    preferences: agent.preferences
  });
});

// GET /api/agents/:id - Get agent status
router.get('/:id', (req, res) => {
  const agent = activeAgents.find(a => a.id === req.params.id);
  
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  res.json(agent);
});

// POST /api/agents/:id/stop - Stop an agent
router.post('/:id/stop', (req, res) => {
  const agent = activeAgents.find(a => a.id === req.params.id);
  
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  agent.status = AGENT_STATES.IDLE;
  agent.currentTask = 'Stopped by user';
  agent.logs.push({
    timestamp: new Date().toISOString(),
    message: 'Agent stopped by user'
  });
  
  res.json({
    message: 'Agent stopped',
    agent
  });
});

// DELETE /api/agents/:id - Remove an agent
router.delete('/:id', (req, res) => {
  const index = activeAgents.findIndex(a => a.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  activeAgents.splice(index, 1);
  
  res.json({ message: 'Agent removed' });
});

// GET /api/agents/:id/logs - Get agent logs
router.get('/:id/logs', (req, res) => {
  const agent = activeAgents.find(a => a.id === req.params.id);
  
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  res.json({
    logs: agent.logs
  });
});

// POST /api/agents/:id/submit - Submit generated video to campaign
router.post('/:id/submit', (req, res) => {
  const { videoId, title, thumbnail } = req.body;
  
  const agent = activeAgents.find(a => a.id === req.params.id);
  
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  agent.status = AGENT_STATES.SUBMITTING;
  agent.stats.videosSubmitted += 1;
  agent.currentTask = 'Submitting to Whop...';
  agent.logs.push({
    timestamp: new Date().toISOString(),
    message: `Submitting video to campaign: ${title}`
  });
  
  setTimeout(() => {
    agent.status = AGENT_STATES.IDLE;
    agent.currentTask = 'Waiting for review';
    agent.logs.push({
      timestamp: new Date().toISOString(),
      message: 'Video submitted successfully'
    });
  }, 2000);
  
  res.json({
    message: 'Video submitted to campaign',
    agent
  });
});

// Simulate agent workflow
function simulateAgentWork(agentId) {
  const agent = activeAgents.find(a => a.id === agentId);
  if (!agent) return;
  
  // Phase 1: Scanning
  setTimeout(() => {
    agent.status = AGENT_STATES.SCANNING;
    agent.currentTask = 'Scanning for viral trends...';
    agent.progress = 20;
    agent.logs.push({
      timestamp: new Date().toISOString(),
      message: 'Analyzing market trends for ' + agent.niche
    });
  }, 2000);
  
  // Phase 2: Generating
  setTimeout(() => {
    agent.status = AGENT_STATES.GENERATING;
    agent.currentTask = 'Generating video content...';
    agent.progress = 50;
    agent.stats.scansCompleted += 1;
    agent.logs.push({
      timestamp: new Date().toISOString(),
      message: 'Found 3 viral patterns in ' + agent.niche
    });
  }, 5000);
  
  // Phase 3: Review
  setTimeout(() => {
    agent.status = AGENT_STATES.REVIEWING;
    agent.currentTask = 'Ready for your review';
    agent.progress = 80;
    agent.stats.videosGenerated += 1;
    agent.logs.push({
      timestamp: new Date().toISOString(),
      message: 'Generated video ready for review'
    });
  }, 8000);
}

module.exports = router;