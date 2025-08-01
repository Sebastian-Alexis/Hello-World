import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

//upload media files
export const POST: APIRoute = async ({ request }) => {
  try {
    //TODO: Add proper authentication when auth system is ready
    /*
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    */

    //parse form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const uploadedFiles = [];
    
    //create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }
    
    //create date-based subdirectory
    const now = new Date();
    const dateDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const fullUploadDir = path.join(uploadsDir, dateDir);
    try {
      await fs.mkdir(fullUploadDir, { recursive: true });
    } catch (error) {
      //directory might already exist
    }

    for (const file of files) {
      //validate file type (images only for now)
      if (!file.type.startsWith('image/')) {
        return new Response(JSON.stringify({ 
          error: `Invalid file type: ${file.type}. Only images are allowed.` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      //validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return new Response(JSON.stringify({ 
          error: `File too large: ${file.name}. Maximum size is 5MB.` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      //generate unique filename
      const ext = path.extname(file.name);
      const filename = `${randomUUID()}${ext}`;
      const filePath = path.join(fullUploadDir, filename);
      
      //save file
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filePath, buffer);
      
      //create URL for the uploaded file
      const fileUrl = `/uploads/${dateDir}/${filename}`;
      
      uploadedFiles.push({
        name: file.name,
        url: fileUrl,
        size: file.size,
        type: file.type,
        filename: filename,
        path: filePath
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      files: uploadedFiles,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Media upload error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to upload files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};