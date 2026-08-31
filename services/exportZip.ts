import JSZip from 'jszip';

export interface ExportableFile {
  name: string;
  blob: Blob;
}

export async function createMasteredZip(files: ExportableFile[]): Promise<Blob> {
  const ZipConstructor = (JSZip as any).default || JSZip;
  const zip = new ZipConstructor();
  
  files.forEach((file) => {
    zip.file(file.name, file.blob);
  });

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}
