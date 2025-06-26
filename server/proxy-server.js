import express from 'express';
import cors from 'cors';
import { Client, handle_file } from '@gradio/client';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:8082', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Hugging Face Spaces API Proxy Server is running' });
});

// Style reference images for different transformation styles
const STYLE_IMAGES = {
  'ghibli': 'https://raw.githubusercontent.com/pytorch/examples/main/fast_neural_style/images/style-images/mosaic.jpg',
  'vintage': 'https://raw.githubusercontent.com/pytorch/examples/main/fast_neural_style/images/style-images/starry_night.jpg',
  'watercolor': 'https://raw.githubusercontent.com/pytorch/examples/main/fast_neural_style/images/style-images/wave.jpg',
  'oil': 'https://raw.githubusercontent.com/pytorch/examples/main/fast_neural_style/images/style-images/starry_night.jpg',
  'cyberpunk': 'https://raw.githubusercontent.com/pytorch/examples/main/fast_neural_style/images/style-images/mosaic.jpg',
  'comic': 'https://raw.githubusercontent.com/pytorch/examples/main/fast_neural_style/images/style-images/candy.jpg',
  'action': 'https://raw.githubusercontent.com/pytorch/examples/main/fast_neural_style/images/style-images/udnie.jpg',
  'bw': 'https://raw.githubusercontent.com/pytorch/examples/main/fast_neural_style/images/style-images/starry_night.jpg',
  'default': 'https://raw.githubusercontent.com/pytorch/examples/main/fast_neural_style/images/style-images/starry_night.jpg'
};

// Proxy endpoint for Hugging Face Spaces API
app.post('/api/transform-image', async (req, res) => {
  try {
    const { imageDataUrl, prompt } = req.body;

    if (!imageDataUrl || !prompt) {
      return res.status(400).json({
        error: 'Missing required fields: imageDataUrl and prompt'
      });
    }

    console.log('🤖 Processing AI transformation request with Hugging Face Spaces:', prompt);

    // Convert data URL to blob for Hugging Face Spaces API
    const base64Data = imageDataUrl.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

    // Connect to the Hugging Face Space
    const app_client = await Client.connect("Hexii/Neural-Style-Transfer");

    // Get style image URL based on prompt
    const styleImageUrl = getStyleImageForPrompt(prompt);

    // Fetch the style image
    const styleResponse = await fetch(styleImageUrl);
    const styleBuffer = await styleResponse.arrayBuffer();
    const styleBlob = new Blob([styleBuffer], { type: 'image/jpeg' });

    // Make the prediction with proper parameters
    const result = await app_client.predict("/predict", [
      handle_file(imageBlob),     // content_img
      handle_file(styleBlob),     // style_image
      1.0,                        // style_weight (0-2)
      1.0,                        // content_weight (1-5)
      false                       // style_blur
    ]);

    console.log('✅ Hugging Face Spaces transformation completed');

    if (result.data && result.data[0]) {
      // Extract the URL from the Gradio response
      const transformedImageData = result.data[0];
      let imageUrl;

      if (typeof transformedImageData === 'string') {
        imageUrl = transformedImageData;
      } else if (transformedImageData.url) {
        imageUrl = transformedImageData.url;
      } else if (transformedImageData.path) {
        // Construct the full URL from the path
        imageUrl = `https://hexii-neural-style-transfer.hf.space/file=${transformedImageData.path}`;
      } else {
        console.error('❌ Could not extract image URL from result:', transformedImageData);
        return res.status(500).json({
          error: 'Could not extract image URL from transformation result',
          details: transformedImageData
        });
      }

      return res.json({
        success: true,
        imageUrl: imageUrl
      });
    } else {
      console.error('❌ Unexpected result from Hugging Face Spaces:', result);
      return res.status(500).json({
        error: 'Unexpected result from Hugging Face Spaces service',
        details: result
      });
    }

  } catch (error) {
    console.error('Server error:', error);

    // Safely get error message
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';

    // Handle specific Hugging Face errors
    if (errorMessage.includes('Space is not running') || errorMessage.includes('not running')) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'The AI transformation service is currently starting up. Please try again in a moment.',
        details: errorMessage
      });
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('time')) {
      return res.status(504).json({
        error: 'Request timeout',
        message: 'The AI transformation is taking longer than expected. Please try again.',
        details: errorMessage
      });
    }

    // Handle Gradio-specific errors
    if (error?.type === 'status' && error?.stage === 'error') {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'The AI transformation service encountered an error. Please try again.',
        details: 'Space processing error - this is usually temporary'
      });
    }

    res.status(500).json({
      error: 'Internal server error: ' + errorMessage
    });
  }
});

// Helper function to get style image URL based on prompt
function getStyleImageForPrompt(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes('ghibli') || lowerPrompt.includes('anime')) {
    return STYLE_IMAGES.ghibli;
  } else if (lowerPrompt.includes('vintage') || lowerPrompt.includes('old')) {
    return STYLE_IMAGES.vintage;
  } else if (lowerPrompt.includes('watercolor')) {
    return STYLE_IMAGES.watercolor;
  } else if (lowerPrompt.includes('oil')) {
    return STYLE_IMAGES.oil;
  } else if (lowerPrompt.includes('cyberpunk')) {
    return STYLE_IMAGES.cyberpunk;
  } else if (lowerPrompt.includes('comic')) {
    return STYLE_IMAGES.comic;
  } else if (lowerPrompt.includes('action')) {
    return STYLE_IMAGES.action;
  } else if (lowerPrompt.includes('black') || lowerPrompt.includes('white')) {
    return STYLE_IMAGES.bw;
  } else {
    // Default to a general artistic style
    return STYLE_IMAGES.default;
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Hugging Face Spaces API Proxy Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🎨 Transform endpoint: POST http://localhost:${PORT}/api/transform-image`);
  console.log(`🤗 Using Hugging Face Space: Hexii/Neural-Style-Transfer`);
});
