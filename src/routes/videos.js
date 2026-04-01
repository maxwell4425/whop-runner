const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Video generation queue
let videoQueue = [];
let videoIdCounter = 1;

// GET /api/videos/health - Check video service status
router.get('/health', async (req, res) => {
  res.json({
    status: 'ready',
    engine: 'The Director',
    models: ['Seedance 2.0', 'Veo3', 'Sora2'],
    queueLength: videoQueue.length
  });
});

// POST /api/videos/generate - Generate video using The Director
router.post('/generate', async (req, res) => {
  const { 
    campaignId, 
    type, // 'UGC' or 'Clipping'
    prompt, 
    productName,
    niche,
    length, // 15, 30, 60 seconds
    aspectRatio, // '9:16' or '16:9'
    voice,
    customInstructions
  } = req.body;
  
  if (!prompt && !campaignId) {
    return res.status(400).json({ error: 'Prompt or campaignId required' });
  }
  
  const videoJob = {
    id: `video-${videoIdCounter++}`,
    campaignId,
    type,
    status: 'queued',
    createdAt: new Date().toISOString(),
    prompt: prompt || `Create a ${length || 30} second ${type || 'UGC'} video about ${productName || 'product'}`,
    settings: {
      length: length || 30,
      aspectRatio: aspectRatio || '9:16',
      voice: voice || 'default',
      customInstructions
    },
    progress: 0
  };
  
  videoQueue.push(videoJob);
  
  // In production, this would call The Director API
  // For demo, simulate generation process
  setTimeout(() => {
    videoJob.status = 'processing';
    videoJob.progress = 50;
  }, 2000);
  
  setTimeout(() => {
    videoJob.status = 'completed';
    videoJob.progress = 100;
    videoJob.outputUrl = `/videos/demo-${videoJob.id}.mp4`;
    videoJob.thumbnail = `/thumbnails/demo-${videoJob.id}.jpg`;
    videoJob.completedAt = new Date().toISOString();
  }, 5000);
  
  res.status(202).json({
    message: 'Video generation started',
    job: videoJob
  });
});

// GET /api/videos/:id - Get video status
router.get('/:id', (req, res) => {
  const video = videoQueue.find(v => v.id === req.params.id);
  
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }
  
  res.json(video);
});

// GET /api/videos - List all videos
router.get('/', (req, res) => {
  const { campaignId, status } = req.query;
  
  let filtered = [...videoQueue];
  
  if (campaignId) {
    filtered = filtered.filter(v => v.campaignId === campaignId);
  }
  
  if (status) {
    filtered = filtered.filter(v => v.status === status);
  }
  
  res.json({
    videos: filtered,
    total: filtered.length
  });
});

// POST /api/videos/batch - Generate multiple variations
router.post('/batch', async (req, res) => {
  const { campaignId, type, prompt, variations = 3, settings } = req.body;
  
  const batchJobs = [];
  
  for (let i = 0; i < variations; i++) {
    const videoJob = {
      id: `video-${videoIdCounter++}-${i}`,
      campaignId,
      type,
      status: 'queued',
      createdAt: new Date().toISOString(),
      prompt: `${prompt} (variation ${i + 1})`,
      settings: settings || {},
      variationIndex: i,
      progress: 0
    };
    
    videoQueue.push(videoJob);
    batchJobs.push(videoJob);
    
    // Simulate staggered completion
    setTimeout(() => {
      videoJob.status = 'completed';
      videoJob.progress = 100;
      videoJob.outputUrl = `/videos/demo-${videoJob.id}.mp4`;
      videoJob.completedAt = new Date().toISOString();
    }, 5000 + (i * 2000));
  }
  
  res.status(202).json({
    message: `${variations} video variations queued`,
    jobs: batchJobs
  });
});

// POST /api/videos/trends - Search viral trends for UGC
router.post('/trends', async (req, res) => {
  const { niche, platform = 'tiktok' } = req.body;
  
  // Mock viral trend data
  // In production, this would call TikTok/Instagram APIs
  const trends = [
    {
      id: 'trend-1',
      title: 'Productivity morning routine',
      viralScore: 92,
      platform: 'tiktok',
      views: '2.4M',
      engagement: '8.2%',
      hookType: 'day in the life',
      sound: 'Original Sound - @productivityguru',
      hashtags: ['#productivity', '#morningroutine', '#fyp'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'trend-2',
      title: 'App feature showcase',
      viralScore: 87,
      platform: 'tiktok',
      views: '1.8M',
      engagement: '7.5%',
      hookType: 'this changed everything',
      sound: 'Trending Sound #45',
      hashtags: ['#app', '#tech', '#fyp'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'trend-3',
      title: 'Before and after',
      viralScore: 95,
      platform: 'tiktok',
      views: '5.2M',
      engagement: '12.3%',
      hookType: 'wait for it',
      sound: 'Dramatic Sound Effect',
      hashtags: ['#transformation', '#fyp', '#viral'],
      createdAt: new Date().toISOString()
    }
  ];
  
  // Filter by niche if provided
  let filtered = trends;
  if (niche) {
    filtered = trends.filter(t => 
      t.hashtags.some(h => h.toLowerCase().includes(niche.toLowerCase()))
    );
  }
  
  res.json({
    trends: filtered,
    count: filtered.length
  });
});

// GET /api/videos/models - List available AI models
router.get('/models', (req, res) => {
  res.json({
    models: [
      { id: 'seedance', name: 'Seedance 2.0', bestFor: 'general UGC', quality: 'high' },
      { id: 'veo3', name: 'Veo3', bestFor: 'cinematic', quality: 'highest' },
      { id: 'sora2', name: 'Sora2', bestFor: 'stylized', quality: 'high' },
      { id: 'higgsfield', name: 'Higgsfield', bestFor: 'action/ sports', quality: 'high' }
    ],
    default: 'seedance'
  });
});

module.exports = router;