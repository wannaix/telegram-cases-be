import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
export class LocalUploadService {
  private uploadDir = 'uploads/cases';
  private publicPath = '/uploads/cases';
  constructor() {
    this.ensureUploadDir();
  }
  private async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
  }
  async uploadImage(buffer: Buffer, originalFileName: string): Promise<string> {
    try {
      const fileExtension = path.extname(originalFileName).toLowerCase();
      const fileName = `${randomUUID()}${fileExtension}`;
      const filePath = path.join(this.uploadDir, fileName);
      await fs.writeFile(filePath, buffer);
      const publicUrl = `${this.publicPath}/${fileName}`;
      console.log(`Local upload completed: ${originalFileName} -> ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error('Local upload error:', error);
      throw new Error(`Local upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      const fileName = path.basename(imageUrl);
      const filePath = path.join(this.uploadDir, fileName);
      await fs.unlink(filePath);
      console.log('Local file deleted:', filePath);
      return true;
    } catch (error) {
      console.error('Local delete error:', error);
      return false;
    }
  }
  async fileExists(imageUrl: string): Promise<boolean> {
    try {
      const fileName = path.basename(imageUrl);
      const filePath = path.join(this.uploadDir, fileName);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
export const localUploadService = new LocalUploadService();