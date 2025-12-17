import { GoogleAIFileManager } from '@google/generative-ai/server';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

/**
 * Uploads a file to Gemini and waits for it to be active.
 * @param {string} filePath - Local path to the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<Object>} - The upload response containing the file URI
 */
export async function uploadToGemini(filePath, mimeType) {
    try {
        console.log(`Uploading ${filePath} to Gemini...`);

        const uploadResponse = await fileManager.uploadFile(filePath, {
            mimeType,
            displayName: filePath.split('/').pop(),
        });

        console.log(`Upload complete. File URI: ${uploadResponse.file.uri}`);

        // Wait for the file to be processed
        let file = await fileManager.getFile(uploadResponse.file.name);
        while (file.state === 'PROCESSING') {
            console.log('File is processing...');
            await new Promise((resolve) => setTimeout(resolve, 2000));
            file = await fileManager.getFile(uploadResponse.file.name);
        }

        if (file.state === 'FAILED') {
            throw new Error('Video processing failed.');
        }

        console.log(`File is active. URI: ${file.uri}`);
        return file;
    } catch (error) {
        console.error('Error uploading to Gemini:', error);
        throw error;
    }
}

/**
 * List all uploaded files (useful for debugging/cleanup)
 */
export async function listUploadedFiles() {
    try {
        const response = await fileManager.listFiles();
        return response.files;
    } catch (error) {
        console.error('Error listing files:', error);
        return [];
    }
}
