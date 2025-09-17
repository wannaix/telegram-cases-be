import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/index.js';
export class ImageService {
  private static uploadsDir = path.join(process.cwd(), 'uploads');
  private static casesDir = path.join(ImageService.uploadsDir, 'cases');
  static getImageUrl(relativePath: string | null | undefined): string {
    if (!relativePath) {
      return ImageService.getDefaultCaseImage();
    }
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }
    const baseUrl = process.env.BASE_URL || `http://localhost:${config.PORT}`;
    const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    return `${baseUrl}${path}`;
  }
  static getDefaultCaseImage(): string {
    const baseUrl = process.env.BASE_URL || `http://localhost:${config.PORT}`;
    return `${baseUrl}/temporary-case-image.png`;
  }
  static async imageExists(relativePath: string): Promise<boolean> {
    try {
      if (!relativePath) return false;
      const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      const fullPath = path.join(process.cwd(), cleanPath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
  static async getImageInfo(relativePath: string | null | undefined) {
    if (!relativePath) {
      return {
        exists: false,
        url: ImageService.getDefaultCaseImage(),
        path: null
      };
    }
    const exists = await ImageService.imageExists(relativePath);
    return {
      exists,
      url: exists ? ImageService.getImageUrl(relativePath) : ImageService.getDefaultCaseImage(),
      path: relativePath
    };
  }
  static async ensureUploadDirs(): Promise<void> {
    try {
      await fs.mkdir(ImageService.uploadsDir, { recursive: true });
      await fs.mkdir(ImageService.casesDir, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directories:', error);
    }
  }
  static async deleteImage(relativePath: string): Promise<boolean> {
    try {
      if (!relativePath) return false;
      const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
      const fullPath = path.join(process.cwd(), cleanPath);
      await fs.unlink(fullPath);
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }
  static getSafeFileName(originalName: string): string {
    return originalName
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}