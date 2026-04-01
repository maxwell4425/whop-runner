const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');

// Editor state
let editorProjects = [];
let projectIdCounter = 1;

// Available styles and assets
const CAPTION_STYLES = [
  { id: 'default', name: 'Default', font: 'Inter', color: '#FFFFFF', bg: 'transparent' },
  { id: 'viral-white', name: 'Viral White', font: 'Poppins Bold', color: '#FFFFFF', bg: 'rgba(0,0,0,0.3)', stroke: '#000000' },
  { id: 'viral-black', name: 'Viral Black', font: 'Poppins Bold', color: '#000000', bg: 'rgba(255,255,255,0.8)', stroke: '#FFFFFF' },
  { id: 'neon', name: 'Neon Glow', font: 'Orbitron', color: '#00FF00', bg: 'transparent', glow: true },
  { id: 'minimal', name: 'Minimal', font: 'Helvetica', color: '#FFFFFF', bg: 'transparent', underline: true },
  { id: 'youtube', name: 'YouTube Style', font: 'Roboto', color: '#FFFFFF', bg: '#FF0000', position: 'top' }
];

const SOUNDS = [
  { id: 'upbeat-1', name: 'Upbeat Loop 1', duration: 30, genre: 'upbeat', royaltyFree: true },
  { id: 'upbeat-2', name: 'Upbeat Loop 2', duration: 30, genre: 'upbeat', royaltyFree: true },
  { id: 'chill-1', name: 'Chill Beat', duration: 45, genre: 'chill', royaltyFree: true },
  { id: 'cinematic-1', name: 'Cinematic Stinger', duration: 5, genre: 'cinematic', royaltyFree: true },
  { id: 'comedy-1', name: 'Comedy SFX', duration: 2, genre: 'sfx', royaltyFree: true },
  { id: 'transition-1', name: 'Whoosh Transition', duration: 1, genre: 'sfx', royaltyFree: true },
  { id: 'drum-roll', name: 'Drum Roll', duration: 5, genre: 'sfx', royaltyFree: true },
  { id: 'applause', name: 'Applause', duration: 3, genre: 'sfx', royaltyFree: true }
];

const TEMPLATES = [
  { id: 'intro-outro', name: 'Intro + Outro', duration: 5, elements: ['intro', 'outro'] },
  { id: 'caption-overlay', name: 'Caption Overlay', duration: 0, elements: ['captions'] },
  { id: 'zoom-pan', name: 'Zoom & Pan', duration: 0, elements: ['zoom', 'pan'] },
  { id: 'split-screen', name: 'Split Screen', duration: 0, elements: ['split'] },
  { id: 'text-overlay', name: 'Text Overlay', duration: 0, elements: ['text'] }
];

// GET /api/editor/styles - Get caption styles
router.get('/styles', (req, res) => {
  res.json({ styles: CAPTION_STYLES });
});

// GET /api/editor/sounds - Get sound library
router.get('/sounds', (req, res) => {
  const { genre } = req.query;
  
  let filtered = SOUNDS;
  if (genre) {
    filtered = SOUNDS.filter(s => s.genre === genre);
  }
  
  res.json({ sounds: filtered });
});

// GET /api/editor/templates - Get editor templates
router.get('/templates', (req, res) => {
  res.json({ templates: TEMPLATES });
});

// POST /api/editor/project - Create new editor project
router.post('/project', (req, res) => {
  const { videoId, videoUrl, campaignId, campaignName } = req.body;
  
  const project = {
    id: `project-${projectIdCounter++}`,
    videoId,
    videoUrl,
    campaignId,
    campaignName,
    createdAt: new Date().toISOString(),
    modifications: {
      captions: [],
      sounds: [],
      effects: [],
      trim: { start: 0, end: null },
      subtitles: {
        style: 'viral-white',
        position: 'bottom',
        fontSize: 'medium'
      },
      watermark: { removed: false },
      zoom: { enabled: false }
    },
    previewUrl: videoUrl,
    status: 'editing'
  };
  
  editorProjects.push(project);
  
  res.status(201).json({
    message: 'Editor project created',
    project
  });
});

// GET /api/editor/project/:id - Get project
router.get('/project/:id', (req, res) => {
  const project = editorProjects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});

// PUT /api/editor/project/:id/captions - Update caption style
router.put('/project/:id/captions', (req, res) => {
  const { style, position, fontSize, customText } = req.body;
  
  const project = editorProjects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  project.modifications.subtitles = {
    style: style || project.modifications.subtitles.style,
    position: position || project.modifications.subtitles.position,
    fontSize: fontSize || project.modifications.subtitles.fontSize,
    customText
  };
  
  res.json({
    message: 'Caption style updated',
    subtitles: project.modifications.subtitles
  });
});

// PUT /api/editor/project/:id/trim - Trim video
router.put('/project/:id/trim', (req, res) => {
  const { start, end } = req.body;
  
  const project = editorProjects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  project.modifications.trim = { start, end };
  
  res.json({
    message: 'Trim updated',
    trim: project.modifications.trim
  });
});

// POST /api/editor/project/:id/sounds - Add sound to project
router.post('/project/:id/sounds', (req, res) => {
  const { soundId, type, volume = 1.0 } = req.body;
  
  const project = editorProjects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const sound = SOUNDS.find(s => s.id === soundId);
  if (!sound) {
    return res.status(404).json({ error: 'Sound not found' });
  }
  
  const appliedSound = {
    soundId,
    name: sound.name,
    type, // 'background', 'effect', 'transition'
    volume,
    addedAt: new Date().toISOString()
  };
  
  project.modifications.sounds.push(appliedSound);
  
  res.json({
    message: 'Sound added',
    sounds: project.modifications.sounds
  });
});

// PUT /api/editor/project/:id/zoom - Enable/disable zoom effect
router.put('/project/:id/zoom', (req, res) => {
  const { enabled, speed = 1.0, target = 'speaker' } = req.body;
  
  const project = editorProjects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  project.modifications.zoom = { enabled, speed, target };
  
  res.json({
    message: 'Zoom effect updated',
    zoom: project.modifications.zoom
  });
});

// POST /api/editor/project/:id/watermark - Remove watermark
router.post('/project/:id/watermark', (req, res) => {
  const { remove = true } = req.body;
  
  const project = editorProjects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  project.modifications.watermark = { removed: remove };
  
  res.json({
    message: remove ? 'Watermark removal applied' : 'Watermark removal cancelled',
    watermark: project.modifications.watermark
  });
});

// POST /api/editor/project/:id/preview - Generate preview
router.post('/project/:id/preview', (req, res) => {
  const project = editorProjects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  project.status = 'rendering';
  
  // Simulate rendering
  setTimeout(() => {
    project.status = 'editing';
    project.previewUrl = `/exports/rendered-${project.id}.mp4`;
    project.lastRendered = new Date().toISOString();
  }, 3000);
  
  res.json({
    message: 'Generating preview...',
    status: 'rendering'
  });
});

// POST /api/editor/project/:id/export - Export final video
router.post('/project/:id/export', (req, res) => {
  const { format = 'mp4', quality = 'high' } = req.body;
  
  const project = editorProjects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  project.status = 'exporting';
  
  setTimeout(() => {
    const exportData = {
      projectId: project.id,
      format,
      quality,
      url: `/exports/final-${project.id}.${format}`,
      exportedAt: new Date().toISOString(),
      modifications: project.modifications
    };
    
    project.status = 'completed';
    project.exportHistory = project.exportHistory || [];
    project.exportHistory.push(exportData);
    
    res.json({
      message: 'Video exported successfully',
      export: exportData
    });
  }, 5000);
});

module.exports = router;