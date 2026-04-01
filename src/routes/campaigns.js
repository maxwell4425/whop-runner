const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');

// In-memory campaign store (would be database in production)
let campaigns = [];
let campaignIdCounter = 1;

// Mock Whop campaigns for demo (would be fetched from Whop API in production)
const mockWhopCampaigns = [
  {
    id: 'whop-001',
    name: 'AI Productivity App UGC',
    brand: 'ProductivityPro',
    type: 'UGC',
    requiresRealHuman: false,
    payout: 150,
    deadline: '2026-04-15',
    requirements: '30-60 second UGC video showcasing app features',
    competition: 'medium',
    niche: 'tech productivity',
    createdAt: new Date().toISOString()
  },
  {
    id: 'whop-002',
    name: 'Fitness Supplement Review',
    brand: 'FitFuel',
    type: 'UGC',
    requiresRealHuman: true,
    payout: 200,
    deadline: '2026-04-10',
    requirements: 'On-camera review with product shown',
    competition: 'high',
    niche: 'fitness health',
    createdAt: new Date().toISOString()
  },
  {
    id: 'whop-003',
    name: 'Stream Highlights - Gaming',
    brand: 'TwitchGamer',
    type: 'Clipping',
    requiresRealHuman: false,
    payout: 75,
    deadline: '2026-04-07',
    requirements: '3-5 clips from stream, TikTok format with captions',
    competition: 'low',
    niche: 'gaming streaming',
    createdAt: new Date().toISOString()
  },
  {
    id: 'whop-004',
    name: 'Podcast Episode Clips',
    brand: 'MindsetMatters',
    type: 'Clipping',
    requiresRealHuman: false,
    payout: 100,
    deadline: '2026-04-12',
    requirements: 'Best moments from podcast episode, vertical format',
    competition: 'medium',
    niche: 'podcast business',
    createdAt: new Date().toISOString()
  },
  {
    id: 'whop-005',
    name: 'Crypto Trading Course UGC',
    brand: 'CryptoKing',
    type: 'UGC',
    requiresRealHuman: false,
    payout: 250,
    deadline: '2026-04-20',
    requirements: 'Faceless testimonial-style video with screen recordings',
    competition: 'low',
    niche: 'crypto finance',
    createdAt: new Date().toISOString()
  },
  {
    id: 'whop-006',
    name: 'Skincare Product Demo',
    brand: 'GlowSkin',
    type: 'UGC',
    requiresRealHuman: true,
    payout: 175,
    deadline: '2026-04-08',
    requirements: 'On-camera demonstration with before/after',
    competition: 'high',
    niche: 'beauty skincare',
    createdAt: new Date().toISOString()
  }
];

// GET /api/campaigns - List all campaigns
router.get('/', (req, res) => {
  const { type, search, minPayout, requiresRealHuman } = req.query;
  
  let filtered = [...mockWhopCampaigns, ...campaigns];
  
  if (type) {
    filtered = filtered.filter(c => c.type.toLowerCase() === type.toLowerCase());
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      c.brand.toLowerCase().includes(searchLower) ||
      c.niche.toLowerCase().includes(searchLower)
    );
  }
  
  if (minPayout) {
    filtered = filtered.filter(c => c.payout >= parseInt(minPayout));
  }
  
  if (requiresRealHuman !== undefined) {
    filtered = filtered.filter(c => c.requiresRealHuman === (requiresRealHuman === 'true'));
  }
  
  res.json({
    campaigns: filtered,
    total: filtered.length
  });
});

// GET /api/campaigns/:id - Get single campaign
router.get('/:id', (req, res) => {
  const campaign = [...mockWhopCampaigns, ...campaigns].find(c => c.id === req.params.id);
  
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }
  
  res.json(campaign);
});

// POST /api/campaigns - Create custom campaign (for testing)
router.post('/', (req, res) => {
  const { name, brand, type, payout, deadline, requirements, niche, requiresRealHuman } = req.body;
  
  const newCampaign = {
    id: `custom-${campaignIdCounter++}`,
    name,
    brand,
    type,
    payout: payout || 100,
    deadline,
    requirements,
    niche,
    requiresRealHuman: requiresRealHuman || false,
    competition: 'custom',
    createdAt: new Date().toISOString()
  };
  
  campaigns.push(newCampaign);
  
  res.status(201).json({
    message: 'Campaign created',
    campaign: newCampaign
  });
});

// POST /api/campaigns/join - Join a campaign (start running agent)
router.post('/join', (req, res) => {
  const { campaignId, userId } = req.body;
  
  const campaign = [...mockWhopCampaigns, ...campaigns].find(c => c.id === campaignId);
  
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }
  
  const activeCampaign = {
    id: `active-${uuidv4()}`,
    campaignId: campaign.id,
    name: campaign.name,
    brand: campaign.brand,
    type: campaign.type,
    payout: campaign.payout,
    deadline: campaign.deadline,
    requirements: campaign.requirements,
    niche: campaign.niche,
    requiresRealHuman: campaign.requiresRealHuman,
    status: 'active',
    userId,
    joinedAt: new Date().toISOString(),
    generatedVideos: [],
    preferences: {}
  };
  
  res.status(201).json({
    message: 'Campaign joined successfully',
    activeCampaign
  });
});

// GET /api/campaigns/recommendations/:userId - Smart Campaign Picker
router.get('/recommendations/:userId', (req, res) => {
  // In production, this would analyze user's past performance, preferences
  // For now, return ranked recommendations by earnings potential
  
  const ranked = [...mockWhopCampaigns].sort((a, b) => {
    const scoreA = a.payout / (a.competition === 'high' ? 3 : a.competition === 'medium' ? 2 : 1);
    const scoreB = b.payout / (b.competition === 'high' ? 3 : b.competition === 'medium' ? 2 : 1);
    return scoreB - scoreA;
  });
  
  const recommendations = ranked.map(c => ({
    ...c,
    estimatedEarnings: c.payout,
    recommendationReason: c.competition === 'low' 
      ? 'Low competition - high approval chances' 
      : c.payout > 150 
        ? 'High payout opportunity'
        : 'Good balance of payout and competition'
  }));
  
  res.json({
    recommendations,
    totalPotential: recommendations.reduce((sum, c) => sum + c.payout, 0)
  });
});

module.exports = router;