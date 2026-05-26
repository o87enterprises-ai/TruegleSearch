// Vercel Serverless Function Entry Point
// This wraps the Express backend for Vercel deployment

const app = require('../apps/backend/server');

module.exports = app;
