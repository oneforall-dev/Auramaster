import JSZip from 'jszip';

export interface ExportableFile {
  name: string;
  blob: Blob;
}

export async function createMasteredZip(files: ExportableFile[]): Promise<Blob> {
  const zip = new JSZip();
  files.forEach((file) => {
    zip.file(file.name, file.blob);
  });
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
