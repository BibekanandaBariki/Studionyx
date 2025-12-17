import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { uploadToGemini } from './fileManager.js';

/**
 * Extract text from uploaded PDF file
 * (Legacy/Fallback if needed, or for debug)
 */
export async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting PDF:', error.message);
    throw new Error(`Failed to extract PDF: ${error.message}`);
  }
}

/**
 * Extract text from DOCX file
 */
export async function extractTextFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting DOCX:', error.message);
    throw new Error(`Failed to extract DOCX: ${error.message}`);
  }
}

/**
 * Extract text from plain text file (TXT, MD)
 */
export function extractTextFromPlainText(buffer) {
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('Error reading text file:', error.message);
    throw new Error(`Failed to read text file: ${error.message}`);
  }
}

/**
 * Upload local buffer to Gemini
 */
async function uploadBufferToGemini(buffer, filename, mimetype) {
  try {
    const tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${filename}`);
    fs.writeFileSync(tempFilePath, buffer);

    const uploadResult = await uploadToGemini(tempFilePath, mimetype);

    fs.unlinkSync(tempFilePath);

    return uploadResult;
  } catch (error) {
    console.error('Error uploading buffer to Gemini:', error.message);
    throw error;
  }
}

/**
 * Process uploaded file based on its type
 */
export async function processUploadedFile(file) {
  const { buffer, mimetype, originalname } = file;

  // Handled types
  // PDF -> Upload to Gemini
  // Image -> Upload to Gemini (future proofing)
  // DOCX -> Text Extract
  // TXT/MD -> Text Extract

  let result = {
    fileName: originalname,
    fileType: 'unknown',
    size: buffer.length,
    text: '',
  };

  if (mimetype === 'application/pdf') {
    // Upload to Gemini
    console.log(`Processing PDF: ${originalname} via Gemini File API...`);
    const upload = await uploadBufferToGemini(buffer, originalname, mimetype);
    result.fileType = 'pdf';
    result.fileUri = upload.uri;
    result.mimeType = upload.mimeType; // explicit mimeType for Gemini prompt
    result.text = ''; // No text extracted locally
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    originalname.endsWith('.docx')
  ) {
    result.text = await extractTextFromDocx(buffer);
    result.fileType = 'docx';
  } else if (
    mimetype === 'text/plain' ||
    mimetype === 'text/markdown' ||
    originalname.endsWith('.txt') ||
    originalname.endsWith('.md')
  ) {
    result.text = extractTextFromPlainText(buffer);
    result.fileType = originalname.endsWith('.md') ? 'markdown' : 'text';
  } else if (mimetype.startsWith('image/')) {
    // Attempt image upload
    console.log(`Processing Image: ${originalname} via Gemini File API...`);
    const upload = await uploadBufferToGemini(buffer, originalname, mimetype);
    result.fileType = 'image';
    result.fileUri = upload.uri;
    result.mimeType = upload.mimeType;
  } else {
    throw new Error(`Unsupported file type: ${mimetype}`);
  }

  return result;
}

/**
 * Validate file type
 */
export function isValidFileType(mimetype, filename) {
  const validMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  const validExtensions = ['.pdf', '.docx', '.txt', '.md', '.jpg', '.jpeg', '.png', '.webp'];

  const hasValidMime = validMimeTypes.includes(mimetype);
  const hasValidExt = validExtensions.some(ext => filename.toLowerCase().endsWith(ext));

  return hasValidMime || hasValidExt;
}

/**
 * Validate file size (max 10MB)
 */
export function isValidFileSize(size, maxSizeMB = 10) {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return size <= maxSizeBytes;
}

/**
 * Extract text from uploaded PDF file
 */
export async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting PDF:', error.message);
    throw new Error(`Failed to extract PDF: ${error.message}`);
  }
}

/**
 * Extract text from DOCX file
 */
export async function extractTextFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting DOCX:', error.message);
    throw new Error(`Failed to extract DOCX: ${error.message}`);
  }
}

/**
 * Extract text from plain text file (TXT, MD)
 */
export function extractTextFromPlainText(buffer) {
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('Error reading text file:', error.message);
    throw new Error(`Failed to read text file: ${error.message}`);
  }
}

/**
 * Process uploaded file based on its type
 */
export async function processUploadedFile(file) {
  const { buffer, mimetype, originalname } = file;

  // Determine file type and extract text
  let text = '';
  let fileType = 'unknown';

  if (mimetype === 'application/pdf') {
    text = await extractTextFromPDF(buffer);
    fileType = 'pdf';
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    originalname.endsWith('.docx')
  ) {
    text = await extractTextFromDocx(buffer);
    fileType = 'docx';
  } else if (
    mimetype === 'text/plain' ||
    mimetype === 'text/markdown' ||
    originalname.endsWith('.txt') ||
    originalname.endsWith('.md')
  ) {
    text = extractTextFromPlainText(buffer);
    fileType = originalname.endsWith('.md') ? 'markdown' : 'text';
  } else {
    throw new Error(`Unsupported file type: ${mimetype}`);
  }

  return {
    text,
    fileType,
    fileName: originalname,
    size: buffer.length,
  };
}

/**
 * Validate file type
 */
export function isValidFileType(mimetype, filename) {
  const validMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
  ];

  const validExtensions = ['.pdf', '.docx', '.txt', '.md'];

  const hasValidMime = validMimeTypes.includes(mimetype);
  const hasValidExt = validExtensions.some(ext => filename.toLowerCase().endsWith(ext));

  return hasValidMime || hasValidExt;
}

/**
 * Validate file size (max 10MB)
 */
export function isValidFileSize(size, maxSizeMB = 10) {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return size <= maxSizeBytes;
}
