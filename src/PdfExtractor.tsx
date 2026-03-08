import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { UploadCloud, FileImage, Download, Trash2, Image as ImageIcon } from 'lucide-react';
import JSZip from 'jszip';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type ExtractedImage = {
  id: string;
  dataUrl: string;
  pageNumber: number;
  width: number;
  height: number;
  imageIndex: number;
};

export default function PdfExtractor({ t }: { t: any }) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        processPdf(file);
      } else {
        alert(t.onlyPdfAllowed || 'Only PDF files are allowed.');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        processPdf(file);
      } else {
        alert(t.onlyPdfAllowed || 'Only PDF files are allowed.');
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processPdf = async (file: File) => {
    setPdfFile(file);
    setImages([]);
    setIsExtracting(true);
    setProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      
      const extractedImages: ExtractedImage[] = [];
      let globalImageIndex = 0;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const operatorList = await page.getOperatorList();
        
        // Find image objects
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i];
          
          // pdfjsLib.OPS.paintImageXObject or pdfjsLib.OPS.paintInlineImageXObject
          if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
            const args = operatorList.argsArray[i];
            const imageName = args[0];
            
            try {
              const imgData = await page.objs.get(imageName);
              if (imgData) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                  let width = imgData.width;
                  let height = imgData.height;
                  
                  if (imgData.bitmap) {
                    width = imgData.bitmap.width;
                    height = imgData.bitmap.height;
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(imgData.bitmap, 0, 0);
                  } else if (imgData.data) {
                    canvas.width = width;
                    canvas.height = height;
                    let rgbaData: Uint8ClampedArray;
                    if (imgData.data.length === width * height * 3) {
                      rgbaData = new Uint8ClampedArray(width * height * 4);
                      for (let j = 0, k = 0; j < imgData.data.length; j += 3, k += 4) {
                        rgbaData[k] = imgData.data[j];
                        rgbaData[k + 1] = imgData.data[j + 1];
                        rgbaData[k + 2] = imgData.data[j + 2];
                        rgbaData[k + 3] = 255;
                      }
                    } else if (imgData.data.length === width * height) {
                      rgbaData = new Uint8ClampedArray(width * height * 4);
                      for (let j = 0, k = 0; j < imgData.data.length; j += 1, k += 4) {
                        const val = imgData.data[j];
                        rgbaData[k] = val;
                        rgbaData[k + 1] = val;
                        rgbaData[k + 2] = val;
                        rgbaData[k + 3] = 255;
                      }
                    } else {
                      rgbaData = new Uint8ClampedArray(imgData.data);
                    }

                    const imageData = new ImageData(
                      rgbaData,
                      width,
                      height
                    );
                    ctx.putImageData(imageData, 0, 0);
                  } else {
                    continue;
                  }
                  
                  const newImage = {
                    id: Math.random().toString(36).substring(2, 9),
                    dataUrl: canvas.toDataURL('image/png'),
                    pageNumber: pageNum,
                    width: width,
                    height: height,
                    imageIndex: ++globalImageIndex
                  };
                  extractedImages.push(newImage);
                  
                  // Update state incrementally
                  setImages([...extractedImages]);
                  
                  // Yield to main thread to allow UI to update
                  await new Promise(resolve => setTimeout(resolve, 0));
                }
              }
            } catch (err) {
              console.warn(`Failed to extract image ${imageName} on page ${pageNum}`, err);
            }
          }
        }
        
        setProgress(Math.round((pageNum / totalPages) * 100));
      }
      
    } catch (error) {
      console.error("Error extracting PDF:", error);
      alert(t.errorExtracting || 'Error extracting images from PDF.');
    } finally {
      setIsExtracting(false);
      setProgress(100);
    }
  };

  const downloadImage = (img: ExtractedImage) => {
    const a = document.createElement('a');
    a.href = img.dataUrl;
    a.download = `extracted_page${img.pageNumber}_img${img.imageIndex}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAll = async () => {
    if (images.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      images.forEach((img) => {
        const base64Data = img.dataUrl.split(',')[1];
        zip.file(`extracted_page${img.pageNumber}_img${img.imageIndex}.png`, base64Data, { base64: true });
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'extracted_images.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (error) {
      console.error("Error creating zip:", error);
      alert(t.errorExtracting || 'Error creating zip file.');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4 tracking-tight">
          {t.extractorTitle || 'PDF Image Extractor'}
        </h1>
        <p className="text-neutral-500 max-w-2xl mx-auto text-lg">
          {t.extractorSubtitle || 'Extract all images from a PDF document securely in your browser.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Upload & Status */}
        <div className="lg:col-span-1 space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all cursor-pointer group
              ${isDragging 
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' 
                : 'border-neutral-300 bg-white hover:border-indigo-400 hover:bg-neutral-50'}
              ${isExtracting ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <div className="p-10 flex flex-col items-center justify-center text-center min-h-[240px]">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors
                ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-neutral-100 text-neutral-500 group-hover:bg-indigo-50 group-hover:text-indigo-500'}
              `}>
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                {t.dropPdfTitle || 'Click or drag PDF here'}
              </h3>
              <p className="text-sm text-neutral-500">
                {t.dropPdfSubtitle || 'Only PDF files are supported'}
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInput}
              accept="application/pdf"
              className="hidden"
            />
          </div>

          {isExtracting && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 space-y-4">
              <div className="flex justify-between items-center text-sm font-medium text-neutral-700">
                <span>{t.extracting || 'Extracting images...'}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {pdfFile && !isExtracting && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <FileImage className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{pdfFile.name}</p>
                  <p className="text-xs text-neutral-500">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                  onClick={() => { setPdfFile(null); setImages([]); }}
                  className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="pt-4 border-t border-neutral-100 flex justify-between items-center">
                <span className="text-sm text-neutral-600">
                  {t.foundImages || 'Found images'}: <strong className="text-neutral-900">{images.length}</strong>
                </span>
                {images.length > 0 && (
                  <button
                    onClick={downloadAll}
                    disabled={isZipping}
                    className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      isZipping
                        ? 'text-indigo-400 bg-indigo-50/50 cursor-wait'
                        : 'text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                    }`}
                  >
                    {isZipping ? '...' : (t.downloadAll || 'Download All')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Image Grid */}
        <div className="lg:col-span-2">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((img) => (
                <div key={img.id} className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden group">
                  <div className="aspect-square bg-neutral-100 relative flex items-center justify-center p-2">
                    <img 
                      src={img.dataUrl} 
                      alt={`Page ${img.pageNumber}`} 
                      className="max-w-full max-h-full object-contain drop-shadow-sm"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => downloadImage(img)}
                        className="bg-white text-neutral-900 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        {t.download || 'Download'}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-white border-t border-neutral-100 flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                      <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
                      {t.page || 'Page'} {img.pageNumber}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono">
                      {img.width}x{img.height}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full min-h-[300px] bg-white rounded-2xl border border-neutral-200 border-dashed flex flex-col items-center justify-center text-neutral-400 p-8 text-center">
              <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
              <p>{pdfFile ? (isExtracting ? (t.extracting || 'Extracting...') : (t.noImagesFound || 'No images found in this PDF.')) : (t.uploadPdfToExtract || 'Upload a PDF to extract images.')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
