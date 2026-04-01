const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory earnings data
let userStats = {};
let transactionHistory = [];

// GET /api/dashboard/:userId - Get user dashboard data
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  const { period = 'week' } = req.query;
  
  // Initialize user if not exists
  if (!userStats[userId]) {
    userStats[userId] = {
      totalEarnings: 0,
      pendingPayments: 0,
      campaignsCompleted: 0,
      videosSubmitted: 0,
      videosApproved: 0,
      averageEarningPerVideo: 0,
      bestNiche: null,
      streak: 0,
      subscription: 'Starter',
      joinedAt: new Date().toISOString()
    };
  }
  
  const stats = userStats[userId];
  
  // Calculate period-based earnings
  const periodEarnings = calculatePeriodEarnings(userId, period);
  const periodVideos = calculatePeriodVideos(userId, period);
  
  res.json({
    overview: {
      totalEarnings: stats.totalEarnings,
      periodEarnings,
      pendingPayments: stats.pendingPayments,
      subscription: stats.subscription,
      streak: stats.streak
    },
    period,
    stats: {
      campaignsCompleted: stats.campaignsCompleted,
      videosSubmitted: stats.videosSubmitted,
      videosApproved: stats.videosApproved,
      approvalRate: stats.videosSubmitted > 0 
        ? Math.round((stats.videosApproved / stats.videosSubmitted) * 100) 
        : 0,
      periodVideos,
      averageEarningPerVideo: stats.averageEarningPerVideo
    },
    bestNiche: stats.bestNiche,
    recentActivity: getRecentActivity(userId),
    subscription: getSubscriptionDetails(stats.subscription)
  });
});

// GET /api/dashboard/:userId/earnings - Detailed earnings breakdown
router.get('/:userId/earnings', (req, res) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;
  
  let transactions = transactionHistory.filter(t => t.userId === userId);
  
  if (startDate) {
    transactions = transactions.filter(t => new Date(t.date) >= new Date(startDate));
  }
  
  if (endDate) {
    transactions = transactions.filter(t => new Date(t.date) <= new Date(endDate));
  }
  
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Group by campaign
  const byCampaign = {};
  transactions.forEach(t => {
    if (!byCampaign[t.campaignName]) {
      byCampaign[t.campaignName] = { count: 0, total: 0 };
    }
    byCampaign[t.campaignName].count += 1;
    byCampaign[t.campaignName].total += t.amount;
  });
  
  res.json({
    transactions: transactions.reverse(),
    total,
    count: transactions.length,
    byCampaign,
    averagePerTransaction: transactions.length > 0 ? total / transactions.length : 0
  });
});

// GET /api/dashboard/:userId/projected - Projected earnings
router.get('/:userId/projected', (req, res) => {
  const { userId } = req.params;
  
  const stats = userStats[userId] || {
    averageEarningPerVideo: 100,
    videosApproved: 0,
    videosSubmitted: 0
  };
  
  // Calculate based on submission rate
  const avgWeeklyVideos = stats.videosApproved > 0 
    ? stats.videosApproved / 4 
    : 2; // Assume 2 if no data
  
  const weeklyProjection = avgWeeklyVideos * stats.averageEarningPerVideo;
  const monthlyProjection = weeklyProjection * 4;
  
  const roi = stats.subscription 
    ? (monthlyProjection / getSubscriptionPrice(stats.subscription)) * 100 
    : 0;
  
  res.json({
    weekly: Math.round(weeklyProjection),
    monthly: Math.round(monthlyProjection),
    yearly: Math.round(monthlyProjection * 12),
    roi: Math.round(roi),
    basedOn: {
      avgWeeklyVideos: Math.round(avgWeeklyVideos * 10) / 10,
      avgEarningPerVideo: stats.averageEarningPerVideo
    }
  });
});

// GET /api/dashboard/:userId/niches - Performance by niche
router.get('/:userId/niches', (req, res) => {
  const { userId } = req.params;
  
  const nicheStats = {};
  
  transactionHistory
    .filter(t => t.userId === userId)
    .forEach(t => {
      if (!nicheStats[t.niche]) {
        nicheStats[t.niche] = {
          campaigns: 0,
          videos: 0,
          earnings: 0,
          approvalRate: 0
        };
      }
      nicheStats[t.niche].campaigns += 1;
      nicheStats[t.niche].videos += 1;
      nicheStats[t.niche].earnings += t.amount;
    });
  
  const result = Object.entries(nicheStats)
    .map(([niche, data]) => ({
      niche,
      ...data,
      avgPerVideo: Math.round(data.earnings / data.videos)
    }))
    .sort((a, b) => b.earnings - a.earnings);
  
  res.json({
    niches: result,
    bestPerforming: result[0] || null
  });
});

// POST /api/dashboard/:userId/update - Update stats (called by agents)
router.post('/:userId/update', (req, res) => {
  const { userId } = req.params;
  const { 
    earnings = 0, 
    videosSubmitted = 0, 
    videosApproved = 0, 
    campaignCompleted = false,
    niche,
    campaignName
  } = req.body;
  
  if (!userStats[userId]) {
    userStats[userId] = {
      totalEarnings: 0,
      pendingPayments: 0,
      campaignsCompleted: 0,
      videosSubmitted: 0,
      videosApproved: 0,
      averageEarningPerVideo: 100,
      bestNiche: null,
      streak: 0,
      subscription: 'Starter',
      joinedAt: new Date().toISOString()
    };
  }
  
  const stats = userStats[userId];
  
  if (earnings > 0) {
    stats.totalEarnings += earnings;
    stats.averageEarningPerVideo = Math.round(stats.totalEarnings / (stats.videosApproved || 1));
    
    // Record transaction
    const transaction = {
      id: `txn-${uuidv4()}`,
      userId,
      amount: earnings,
      campaignName,
      niche,
      status: 'completed',
      date: new Date().toISOString()
    };
    transactionHistory.push(transaction);
  }
  
  if (videosSubmitted > 0) {
    stats.videosSubmitted += videosSubmitted;
  }
  
  if (videosApproved > 0) {
    stats.videosApproved += videosApproved;
  }
  
  if (campaignCompleted) {
    stats.campaignsCompleted += 1;
  }
  
  if (niche) {
    if (!stats.bestNiche || stats.bestNiche.earnings < earnings) {
      stats.bestNiche = { niche, earnings };
    }
  }
  
  // Update streak
  stats.streak += 1;
  
  res.json({
    message: 'Stats updated',
    stats
  });
});

// POST /api/dashboard/:userId/subscription - Update subscription
router.post('/:userId/subscription', (req, res) => {
  const { userId } = req.params;
  const { tier } = req.body;
  
  if (!userStats[userId]) {
    userStats[userId] = {
      totalEarnings: 0,
      subscription: 'Starter'
    };
  }
  
  userStats[userId].subscription = tier;
  
  res.json({
    message: 'Subscription updated',
    subscription: tier,
    details: getSubscriptionDetails(tier)
  });
});

// Helper functions
function calculatePeriodEarnings(userId, period) {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'day':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    default:
      startDate = new Date(now.setDate(now.getDate() - 7));
  }
  
  return transactionHistory
    .filter(t => t.userId === userId && new Date(t.date) >= startDate)
    .reduce((sum, t) => sum + t.amount, 0);
}

function calculatePeriodVideos(userId, period) {
  // This would be more sophisticated in production
  const stats = userStats[userId];
  if (!stats) return 0;
  
  switch (period) {
    case 'day': return Math.round(stats.videosApproved / 30);
    case 'week': return Math.round(stats.videosApproved / 4);
    case 'month': return stats.videosApproved;
    default: return Math.round(stats.videosApproved / 4);
  }
}

function getRecentActivity(userId) {
  return transactionHistory
    .filter(t => t.userId === userId)
    .slice(-10)
    .reverse()
    .map(t => ({
      type: 'earnings',
      amount: t.amount,
      campaign: t.campaignName,
      date: t.date
    }));
}

function getSubscriptionDetails(tier) {
  const tiers = {
    Starter: {
      price: 29,
      campaigns: 2,
      videos: 10,
      features: ['Basic editor', 'Basic virality scanning']
    },
    Pro: {
      price: 79,
      campaigns: 5,
      videos: 50,
      features: ['Full editor', 'Smart Campaign Picker', 'Earnings Dashboard', 'Preference Learning']
    },
    Autopilot: {
      price: 199,
      campaigns: 10,
      videos: 'unlimited',
      features: ['Everything in Pro', 'Performance Feedback Loop', 'Template Library', 'Priority support']
    }
  };
  
  return tiers[tier] || tiers.Starter;
}

function getSubscriptionPrice(tier) {
  const prices = { Starter: 29, Pro: 79, Autopilot: 199 };
  return prices[tier] || 29;
}

module.exports = router;