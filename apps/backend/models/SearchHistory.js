const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    filters: {
      category: {
        type: String,
        enum: ['web', 'news', 'videos', 'social', 'shopping', 'all'],
        default: 'web',
      },
      dateRange: {
        type: String,
        enum: ['hour', 'day', 'week', 'month', 'year', 'all'],
        default: 'all',
      },
      safeSearch: {
        type: Boolean,
        default: true,
      },
      biasFilter: {
        type: String,
        enum: ['all', 'left', 'right', 'center', 'unbiased'],
        default: 'all',
      },
    },
    results: {
      totalCount: {
        type: Number,
        default: 0,
      },
      sources: {
        google: { type: Number, default: 0 },
        bing: { type: Number, default: 0 },
        news: { type: Number, default: 0 },
        youtube: { type: Number, default: 0 },
      },
      biasDistribution: {
        left: { type: Number, default: 0 },
        right: { type: Number, default: 0 },
        center: { type: Number, default: 0 },
        unbiased: { type: Number, default: 0 },
        unknown: { type: Number, default: 0 },
      },
    },
    performance: {
      responseTime: {
        type: Number, // milliseconds
        required: true,
      },
      success: {
        type: Boolean,
        default: true,
      },
      error: {
        type: String,
        default: null,
      },
    },
    userAgent: {
      type: String,
      maxlength: 500,
    },
    ipAddress: {
      type: String,
      maxlength: 45,
    },
    location: {
      country: String,
      region: String,
      city: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for efficient querying
searchHistorySchema.index({ userId: 1, createdAt: -1 });
searchHistorySchema.index({ query: 'text' });
searchHistorySchema.index({ 'filters.category': 1, createdAt: -1 });
searchHistorySchema.index({ createdAt: -1 });

// Static method to get search statistics
searchHistorySchema.statics.getSearchStats = function (
  userId,
  timeframe = '30d'
) {
  const dateFilter = {};
  const now = new Date();

  switch (timeframe) {
    case '7d':
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
      break;
    case '30d':
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 30));
      break;
    case '90d':
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 90));
      break;
    default:
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 30));
  }

  const matchStage = { createdAt: dateFilter };
  if (userId) {
    matchStage.userId = userId;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSearches: { $sum: 1 },
        successfulSearches: {
          $sum: { $cond: [{ $eq: ['$performance.success', true] }, 1, 0] },
        },
        averageResponseTime: { $avg: '$performance.responseTime' },
        uniqueQueries: { $addToSet: '$query' },
      },
    },
    {
      $project: {
        totalSearches: 1,
        successfulSearches: 1,
        averageResponseTime: { $round: ['$averageResponseTime', 2] },
        uniqueQueryCount: { $size: '$uniqueQueries' },
      },
    },
  ]);
};

// Static method to get popular searches
searchHistorySchema.statics.getPopularSearches = function (
  limit = 10,
  timeframe = '30d'
) {
  const dateFilter = {};
  const now = new Date();

  switch (timeframe) {
    case '7d':
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
      break;
    case '30d':
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 30));
      break;
    case '90d':
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 90));
      break;
    default:
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 30));
  }

  return this.aggregate([
    { $match: { createdAt: dateFilter } },
    {
      $group: {
        _id: '$query',
        count: { $sum: 1 },
        lastSearched: { $max: '$createdAt' },
      },
    },
    { $sort: { count: -1, lastSearched: -1 } },
    { $limit: limit },
  ]);
};

// Method to log search result details
searchHistorySchema.methods.logResults = function (resultData) {
  this.results.totalCount = resultData.length;

  // Count results by source
  const sourceCounts = {};
  const biasCounts = {
    left: 0,
    right: 0,
    center: 0,
    unbiased: 0,
    unknown: 0,
  };

  resultData.forEach((result) => {
    if (result.source) {
      sourceCounts[result.source] = (sourceCounts[result.source] || 0) + 1;
    }

    if (result.bias) {
      biasCounts[result.bias] = (biasCounts[result.bias] || 0) + 1;
    }
  });

  this.results.sources = { ...this.results.sources, ...sourceCounts };
  this.results.biasDistribution = biasCounts;

  return this.save();
};

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
