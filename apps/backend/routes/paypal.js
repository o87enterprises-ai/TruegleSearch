const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../config/env');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');

// Allowed redirect URL origins for PayPal
const ALLOWED_REDIRECT_HOSTS = [
  'localhost',
  '127.0.0.1',
];

const isAllowedRedirectUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    return (
      ALLOWED_REDIRECT_HOSTS.some((host) => url.hostname === host) ||
      url.hostname.endsWith('.ngrok-free.app') ||
      url.hostname.endsWith('.ngrok.io') ||
      url.hostname.endsWith('.vercel.app')
    );
  } catch {
    return false;
  }
};

// PayPal OAuth token endpoint
const getPayPalToken = async () => {
  try {
    if (!config.paypal.clientId || !config.paypal.secret) {
      throw new Error('PayPal credentials are not configured');
    }

    const response = await axios.post(
      `${process.env.NODE_ENV === 'production' 
        ? 'https://api.paypal.com' 
        : 'https://api.sandbox.paypal.com'}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${config.paypal.clientId}:${config.paypal.secret}`
          ).toString('base64')}`
        }
      }
    );

    return response.data.access_token;
  } catch (error) {
    logger.error('Error getting PayPal token:', error);
    throw error;
  }
};

// Create PayPal payment
router.post('/create-payment', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'USD', description, returnUrl, cancelUrl } = req.body;

    // Validate required parameters
    if (!amount || !returnUrl || !cancelUrl) {
      return res.status(400).json({
        error: 'Amount, returnUrl, and cancelUrl parameters are required'
      });
    }

    // Validate redirect URLs belong to allowed domains
    if (!isAllowedRedirectUrl(returnUrl) || !isAllowedRedirectUrl(cancelUrl)) {
      return res.status(400).json({
        error: 'Redirect URLs must belong to an allowed domain'
      });
    }

    // Get PayPal access token
    const accessToken = await getPayPalToken();

    // Prepare payment data
    const paymentData = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      transactions: [{
        amount: {
          total: parseFloat(amount).toFixed(2),
          currency: currency.toUpperCase()
        },
        description: description || 'Payment transaction'
      }],
      redirect_urls: {
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    };

    // Create payment with PayPal
    const response = await axios.post(
      `${process.env.NODE_ENV === 'production' 
        ? 'https://api.paypal.com' 
        : 'https://api.sandbox.paypal.com'}/v1/payments/payment`,
      paymentData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    res.status(200).json({
      success: true,
      payment: response.data
    });

  } catch (error) {
    logger.error('Error creating PayPal payment:', error);
    
    res.status(500).json({
      error: 'Failed to create PayPal payment',
      details: 'Service unavailable'
    });
  }
});

// Execute PayPal payment after approval
router.post('/execute-payment', authenticate, async (req, res) => {
  try {
    const { paymentId, payerId } = req.body;

    // Validate required parameters
    if (!paymentId || !payerId) {
      return res.status(400).json({
        error: 'Payment ID and Payer ID are required'
      });
    }

    // Get PayPal access token
    const accessToken = await getPayPalToken();

    // Prepare execution data
    const executionData = {
      payer_id: payerId
    };

    // Execute the payment
    const response = await axios.post(
      `${process.env.NODE_ENV === 'production' 
        ? 'https://api.paypal.com' 
        : 'https://api.sandbox.paypal.com'}/v1/payments/payment/${paymentId}/execute`,
      executionData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    res.status(200).json({
      success: true,
      payment: response.data
    });

  } catch (error) {
    logger.error('Error executing PayPal payment:', error);
    
    res.status(500).json({
      error: 'Failed to execute PayPal payment',
      details: 'Service unavailable'
    });
  }
});

// Get PayPal payment details
router.get('/payment/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Validate payment ID
    if (!paymentId) {
      return res.status(400).json({
        error: 'Payment ID is required'
      });
    }

    // Get PayPal access token
    const accessToken = await getPayPalToken();

    // Get payment details
    const response = await axios.get(
      `${process.env.NODE_ENV === 'production' 
        ? 'https://api.paypal.com' 
        : 'https://api.sandbox.paypal.com'}/v1/payments/payment/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    res.status(200).json({
      success: true,
      payment: response.data
    });

  } catch (error) {
    logger.error('Error getting PayPal payment details:', error);
    
    res.status(500).json({
      error: 'Failed to get PayPal payment details',
      details: 'Service unavailable'
    });
  }
});

// Create PayPal subscription
router.post('/create-subscription', authenticate, async (req, res) => {
  try {
    const { 
      name, 
      description, 
      startDate, 
      planId, 
      payer 
    } = req.body;

    // Validate required parameters
    if (!name || !description || !startDate || !planId || !payer) {
      return res.status(400).json({
        error: 'Name, description, startDate, planId, and payer are required'
      });
    }

    // Get PayPal access token
    const accessToken = await getPayPalToken();

    // Prepare subscription data
    const subscriptionData = {
      name,
      description,
      start_time: new Date(startDate).toISOString(),
      plan_id: planId,
      subscriber: payer,
      auto_renewal: true,
      quantity: 1,
      shipping_amount: {
        currency_code: 'USD',
        value: '0.00'
      }
    };

    // Create subscription with PayPal
    const response = await axios.post(
      `${process.env.NODE_ENV === 'production' 
        ? 'https://api.paypal.com' 
        : 'https://api.sandbox.paypal.com'}/v1/billing/subscriptions`,
      subscriptionData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    res.status(200).json({
      success: true,
      subscription: response.data
    });

  } catch (error) {
    logger.error('Error creating PayPal subscription:', error);
    
    res.status(500).json({
      error: 'Failed to create PayPal subscription',
      details: 'Service unavailable'
    });
  }
});

// Get PayPal subscription details
router.get('/subscription/:subscriptionId', authenticate, async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    // Validate subscription ID
    if (!subscriptionId) {
      return res.status(400).json({
        error: 'Subscription ID is required'
      });
    }

    // Get PayPal access token
    const accessToken = await getPayPalToken();

    // Get subscription details
    const response = await axios.get(
      `${process.env.NODE_ENV === 'production' 
        ? 'https://api.paypal.com' 
        : 'https://api.sandbox.paypal.com'}/v1/billing/subscriptions/${subscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    res.status(200).json({
      success: true,
      subscription: response.data
    });

  } catch (error) {
    logger.error('Error getting PayPal subscription details:', error);
    
    res.status(500).json({
      error: 'Failed to get PayPal subscription details',
      details: 'Service unavailable'
    });
  }
});

module.exports = router;