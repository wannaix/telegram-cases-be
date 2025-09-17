import { FastifyRequest } from "fastify";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { ImageService } from "../services/imageService.js";
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "cases");
export async function ensureUploadDir() {
  await ImageService.ensureUploadDirs();
}
export async function handleFileUpload(request: FastifyRequest) {
  console.log("Attempting to get file from request...");
  
  
  if (!request.isMultipart()) {
    console.error("Request is not multipart");
    throw new Error("Request must be multipart/form-data");
  }
  
  let data;
  try {
    data = await request.file();
    
    if (!data) {
      console.error("No file data received from request");
      throw new Error("No file uploaded");
    }
    
    console.log(`File received: ${data.filename}, mimetype: ${data.mimetype}`);
  } catch (error) {
    console.error("Error getting file from request:", error);
    throw new Error("No file uploaded");
  }
  console.log(`File upload started: ${data.filename}, type: ${data.mimetype}`);
  
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(data.mimetype)) {
    throw new Error("Invalid file type. Only JPEG, PNG, WebP and GIF are allowed");
  }
  
  const originalName = data.filename || 'image';
  const ext = path.extname(originalName);
  const safeName = ImageService.getSafeFileName(originalName.replace(ext, ''));
  const filename = `${safeName}_${randomUUID()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  
  try {
    const buffer = await data.toBuffer();
    console.log(`Buffer size: ${buffer.length} bytes`);
    
    await fs.writeFile(filepath, buffer);
    console.log(`File saved successfully: ${filepath}`);
    
    
    const stats = await fs.stat(filepath);
    if (buffer.length !== stats.size) {
      console.error(`SIZE MISMATCH! Buffer: ${buffer.length}, File: ${stats.size}`);
    }
  } catch (error) {
    console.error(`Error saving file:`, error);
    throw error;
  }
  
  return `/uploads/cases/${filename}`;
}
export async function deleteFile(relativePath: string) {
  return ImageService.deleteImage(relativePath);
}