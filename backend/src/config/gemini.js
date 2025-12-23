import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
  throw new Error(
    'GEMINI_API_KEY is not set or is using placeholder value. ' +
    'Please set a valid API key in your .env file. ' +
    'Get your key from: https://makersuite.google.com/app/apikey'
  );
}

const genAI = new GoogleGenerativeAI(apiKey);

// Model name - using gemini-2.5-flash (gemini-1.5-flash is no longer available)
// Available models: gemini-2.5-flash, gemini-2.0-flash, gemini-2.5-pro
const MODEL_NAME = 'gemini-2.5-flash';

// Q&A Mode: Maximum accuracy (temperature 0.1)
export const getQAModel = () => {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      topK: 20,
      maxOutputTokens: 2048,
    },
  });
};

// Dialogue Mode: Slightly more natural (temperature 0.3)
export const getDialogueModel = () => {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.3,
      topP: 0.8,
      topK: 20,
      maxOutputTokens: 2048,
    },
  });
};

// Summary Mode: Balanced (temperature 0.2)
export const getSummaryModel = () => {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.0,
      topP: 0.8,
      topK: 20,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });
};

// Suggestion Mode: JSON output (temperature 0.2)
export const getSuggestModel = () => {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      topK: 20,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });
};

export default genAI;
