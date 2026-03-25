import { NextRequest, NextResponse } from 'next/server';
import { parseForm } from '@/lib/parseForm';
import { uploadToCloudinary } from '@/lib/cloudinary';
import formidable from 'formidable';

export const maxDuration = 60;

// POST /api/upload/image — accepts multiple images in one batch, uploads to Cloudinary in order, returns URLs
export async function POST(req: NextRequest) {
  try {
    const { files, fields } = await parseForm(req);
    const imageType = Array.isArray(fields.imageType) ? fields.imageType[0] : (fields.imageType ?? 'question');

    // Collect all files in order (images[0], images[1], ...)
    const orderedFiles: formidable.File[] = [];
    let i = 0;
    while (true) {
      const entry = files[`images[${i}]`];
      if (!entry) break;
      orderedFiles.push(Array.isArray(entry) ? entry[0] : entry);
      i++;
    }

    if (orderedFiles.length === 0) return NextResponse.json({ error: 'No images provided' }, { status: 400 });

    // Upload in order, preserve index mapping
    const urls = await Promise.all(
      orderedFiles.map((file) => uploadToCloudinary(file.filepath, imageType as string))
    );

    return NextResponse.json({ urls });
  } catch (error) {
    console.error('POST /api/upload/image error:', error);
    return NextResponse.json({ error: 'Failed to upload images' }, { status: 500 });
  }
}
