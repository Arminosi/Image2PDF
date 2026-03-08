import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { UploadCloud, FileImage, Trash2, ArrowUp, ArrowDown, Download, Settings2, GripVertical, Languages, ArrowDownAZ, ArrowUpZA, Clock, FileText, Image as ImageIcon } from 'lucide-react';
import PdfExtractor from './PdfExtractor';

type ImageItem = {
  id: string;
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
};

type PageSize = 'A4' | 'Letter' | 'Fit';
type Orientation = 'Portrait' | 'Landscape' | 'Auto';
type Language = 'en' | 'zh';
type ImageMode = 'PassThrough' | 'ForceJPG' | 'Compress';
type AppMode = 'img2pdf' | 'pdf2img';

const compressImage = (dataUrl: string, quality: number, scale: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      
      // Fill white background in case of transparent PNGs converted to JPEG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
};

const translations = {
  en: {
    title: 'Image to PDF Converter',
    subtitle: 'Merge multiple images into a single PDF document securely in your browser. No files are uploaded to any server.',
    dropzoneTitle: 'Click or drag images here',
    dropzoneSubtitle: 'Supports JPG, PNG, WebP, etc.',
    selectedImages: 'Selected Images',
    clearAll: 'Clear All',
    pdfSettings: 'PDF Settings',
    pageSize: 'Page Size',
    orientation: 'Orientation',
    margin: 'Margin',
    autoOrientationNote: 'Orientation is automatic when fitting to image.',
    marginDisabledNote: 'Margin will be added around the image.',
    generatePdf: 'Generate PDF',
    generatingPdf: 'Generating PDF...',
    errorGenerating: 'An error occurred while generating the PDF.',
    moveUp: 'Move Up',
    moveDown: 'Move Down',
    remove: 'Remove',
    fit: 'Fit',
    auto: 'Auto',
    portrait: 'Portrait',
    landscape: 'Landscape',
    imageMode: 'Image Processing',
    modePassThrough: 'Pass-through (Keep original JPG/PNG)',
    modeForceJPG: 'Convert to JPG (Prevent PNG bloat)',
    modeCompress: 'Compress (Reduce resolution & quality)',
    sortNameAsc: 'Sort by Name (A-Z)',
    sortNameDesc: 'Sort by Name (Z-A)',
    sortTime: 'Sort by Upload Time',
    tabImg2Pdf: 'Image to PDF',
    tabPdf2Img: 'Extract Images',
    extractorTitle: 'PDF Image Extractor',
    extractorSubtitle: 'Extract all images from a PDF document securely in your browser.',
    dropPdfTitle: 'Click or drag PDF here',
    dropPdfSubtitle: 'Only PDF files are supported',
    onlyPdfAllowed: 'Only PDF files are allowed.',
    extracting: 'Extracting images...',
    errorExtracting: 'Error extracting images from PDF.',
    foundImages: 'Found images',
    downloadAll: 'Download All',
    download: 'Download',
    page: 'Page',
    noImagesFound: 'No images found in this PDF.',
    uploadPdfToExtract: 'Upload a PDF to extract images.'
  },
  zh: {
    title: '图片转 PDF 工具',
    subtitle: '在浏览器中安全地将多张图片合并为一个 PDF 文件。所有操作均在本地完成，不会上传任何文件到服务器。',
    dropzoneTitle: '点击或拖拽图片到此处',
    dropzoneSubtitle: '支持 JPG、PNG、WebP 等格式',
    selectedImages: '已选图片',
    clearAll: '清空全部',
    pdfSettings: 'PDF 设置',
    pageSize: '页面尺寸',
    orientation: '页面方向',
    margin: '页面边距',
    autoOrientationNote: '当选择"适应图片"时，页面方向将自动设置。',
    marginDisabledNote: '边距将添加在图片周围，页面尺寸会自动扩大。',
    generatePdf: '生成 PDF',
    generatingPdf: '正在生成 PDF...',
    errorGenerating: '生成 PDF 时发生错误。',
    moveUp: '上移',
    moveDown: '下移',
    remove: '移除',
    fit: '适应图片',
    auto: '自动',
    portrait: '纵向',
    landscape: '横向',
    imageMode: '图片处理模式',
    modePassThrough: '原图透传 (JPG直接封装，不重编码)',
    modeForceJPG: '转为JPG (防止PNG导致PDF体积暴增)',
    modeCompress: '强力压缩 (缩小分辨率，适合网络传输)',
    sortNameAsc: '按文件名正序 (A-Z)',
    sortNameDesc: '按文件名倒序 (Z-A)',
    sortTime: '按上传顺序',
    tabImg2Pdf: '图片转 PDF',
    tabPdf2Img: '提取 PDF 图片',
    extractorTitle: 'PDF 图片提取工具',
    extractorSubtitle: '在浏览器中安全地提取 PDF 文档中的所有图片。',
    dropPdfTitle: '点击或拖拽 PDF 到此处',
    dropPdfSubtitle: '仅支持 PDF 文件',
    onlyPdfAllowed: '仅允许上传 PDF 文件。',
    extracting: '正在提取图片...',
    errorExtracting: '提取 PDF 图片时发生错误。',
    foundImages: '找到图片',
    downloadAll: '下载全部',
    download: '下载',
    page: '第',
    noImagesFound: '此 PDF 中未找到图片。',
    uploadPdfToExtract: '上传 PDF 以提取图片。'
  }
};

export default function App() {
  const [lang, setLang] = useState<Language>('zh');
  const t = translations[lang];

  const [appMode, setAppMode] = useState<AppMode>('img2pdf');

  useEffect(() => {
    // Auto-detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('en')) {
      setLang('en');
    } else {
      setLang('zh'); // Default to Chinese for other languages or if zh
    }
  }, []);

  const toggleLanguage = () => {
    setLang(prev => prev === 'zh' ? 'en' : 'zh');
  };

  const [images, setImages] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pageSize, setPageSize] = useState<PageSize>('Fit');
  const [orientation, setOrientation] = useState<Orientation>('Auto');
  const [margin, setMargin] = useState<number>(0);
  const [imageMode, setImageMode] = useState<ImageMode>('PassThrough');

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
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
    // Reset input so the same files can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFiles = async (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    const newImages = await Promise.all(
      imageFiles.map((file, index) => {
        return new Promise<ImageItem>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const img = new Image();
            img.onload = () => {
              resolve({
                id: Math.random().toString(36).substring(2, 9),
                file,
                dataUrl,
                width: img.width,
                height: img.height,
                timestamp: Date.now() + index, // Ensure unique timestamps
              });
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        });
      })
    );

    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === images.length - 1)
    ) {
      return;
    }

    const newImages = [...images];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    setImages(newImages);
  };

  const sortImages = (type: 'nameAsc' | 'nameDesc' | 'time') => {
    const sorted = [...images].sort((a, b) => {
      if (type === 'nameAsc') {
        return a.file.name.localeCompare(b.file.name);
      } else if (type === 'nameDesc') {
        return b.file.name.localeCompare(a.file.name);
      } else {
        return a.timestamp - b.timestamp;
      }
    });
    setImages(sorted);
  };

  const handleSortDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSortDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSortDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newImages = [...images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedItem);
    setImages(newImages);
    setDraggedIndex(null);
  };

  const handleSortDragEnd = () => {
    setDraggedIndex(null);
  };

  const generatePDF = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);
    setProgress(0);

    try {
      // Create a new jsPDF instance
      // We will initialize it with the first page's settings
      let doc: jsPDF | null = null;

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        // Determine page dimensions and orientation
        let pageW = 210; // A4 width in mm
        let pageH = 297; // A4 height in mm
        let currentOrientation: 'p' | 'l' = 'p';

        if (pageSize === 'A4') {
          pageW = 210;
          pageH = 297;
        } else if (pageSize === 'Letter') {
          pageW = 215.9;
          pageH = 279.4;
        }

        if (pageSize === 'Fit') {
          // Convert pixels to pt (1 px = 0.75 pt at 96dpi)
          let imgW_pt = img.width * 0.75;
          let imgH_pt = img.height * 0.75;
          
          // Add margin (convert mm to pt: 1 mm = 2.83465 pt)
          const marginPt = margin * 2.83465;
          
          pageW = imgW_pt + (marginPt * 2);
          pageH = imgH_pt + (marginPt * 2);
          
          currentOrientation = pageW > pageH ? 'l' : 'p';
        } else {
          if (orientation === 'Auto') {
            currentOrientation = img.width > img.height ? 'l' : 'p';
          } else {
            currentOrientation = orientation === 'Landscape' ? 'l' : 'p';
          }
          
          // Swap dimensions if landscape
          if (currentOrientation === 'l' && pageW < pageH) {
            const temp = pageW;
            pageW = pageH;
            pageH = temp;
          } else if (currentOrientation === 'p' && pageW > pageH) {
            const temp = pageW;
            pageW = pageH;
            pageH = temp;
          }
        }

        const unit = pageSize === 'Fit' ? 'pt' : 'mm';

        if (i === 0) {
          doc = new jsPDF({
            orientation: currentOrientation,
            unit: unit,
            format: [pageW, pageH]
          });
        } else {
          doc!.addPage([pageW, pageH], currentOrientation);
        }

        // Calculate image rendering dimensions
        let renderW = pageW;
        let renderH = pageH;
        let renderX = 0;
        let renderY = 0;

        if (pageSize !== 'Fit') {
          // Apply margins
          const availableW = pageW - (margin * 2);
          const availableH = pageH - (margin * 2);

          // Calculate aspect ratios
          const imgRatio = img.width / img.height;
          const pageRatio = availableW / availableH;

          if (imgRatio > pageRatio) {
            // Image is wider than page
            renderW = availableW;
            renderH = availableW / imgRatio;
          } else {
            // Image is taller than page
            renderH = availableH;
            renderW = availableH * imgRatio;
          }

          // Center image
          renderX = margin + (availableW - renderW) / 2;
          renderY = margin + (availableH - renderH) / 2;
        } else {
          // Fit exactly with margins
          const marginPt = margin * 2.83465;
          renderX = marginPt;
          renderY = marginPt;
          renderW = img.width * 0.75;
          renderH = img.height * 0.75;
        }
        
        let finalDataUrl = img.dataUrl;
        let finalFormat = 'JPEG';

        if (img.file.type === 'image/jpeg') {
          if (imageMode === 'Compress') {
            finalDataUrl = await compressImage(img.dataUrl, 0.6, 0.75);
          } else {
            // PassThrough or ForceJPG: JPG is ALWAYS passed through natively by jsPDF
            finalDataUrl = img.dataUrl;
          }
          finalFormat = 'JPEG';
        } else if (img.file.type === 'image/png') {
          if (imageMode === 'PassThrough') {
            finalDataUrl = img.dataUrl;
            finalFormat = 'PNG'; // jsPDF will decode and re-encode to Flate (may bloat)
          } else if (imageMode === 'ForceJPG') {
            finalDataUrl = await compressImage(img.dataUrl, 0.9, 1); // Convert to JPG to prevent bloat
            finalFormat = 'JPEG';
          } else if (imageMode === 'Compress') {
            finalDataUrl = await compressImage(img.dataUrl, 0.6, 0.75);
            finalFormat = 'JPEG';
          }
        } else {
          // WebP, GIF, etc. MUST be converted to JPG because standard PDF doesn't support them
          if (imageMode === 'Compress') {
            finalDataUrl = await compressImage(img.dataUrl, 0.6, 0.75);
          } else {
            finalDataUrl = await compressImage(img.dataUrl, 0.9, 1);
          }
          finalFormat = 'JPEG';
        }

        doc!.addImage(
          finalDataUrl,
          finalFormat,
          renderX,
          renderY,
          renderW,
          renderH,
          undefined,
          'FAST'
        );

        setProgress(Math.round(((i + 1) / images.length) * 100));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      if (doc) {
        doc.save('merged-images.pdf');
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(t.errorGenerating);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans p-4 md:p-8">
      {/* Header & Navigation */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-neutral-200">
          <button
            onClick={() => setAppMode('img2pdf')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              appMode === 'img2pdf'
                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <FileImage className="w-4 h-4" />
            {t.tabImg2Pdf}
          </button>
          <button
            onClick={() => setAppMode('pdf2img')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              appMode === 'pdf2img'
                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            {t.tabPdf2Img}
          </button>
        </div>

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-lg shadow-sm hover:bg-neutral-50 transition-colors text-sm font-medium text-neutral-700"
        >
          <Languages className="w-4 h-4" />
          {lang === 'zh' ? 'English' : '中文'}
        </button>
      </div>

      {appMode === 'img2pdf' ? (
        <div className="max-w-5xl mx-auto space-y-8 mt-8 md:mt-0">
          
          {/* Header */}
          <header className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900">
              {t.title}
            </h1>
            <p className="text-neutral-500 max-w-xl mx-auto">
              {t.subtitle}
            </p>
          </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content - Left/Center */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Dropzone */}
            <div
              className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition-colors duration-200 ease-in-out cursor-pointer flex flex-col items-center justify-center min-h-[240px]
                ${isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-neutral-300 bg-white hover:border-indigo-400 hover:bg-neutral-50'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInput}
                className="hidden"
                multiple
                accept="image/*"
              />
              <div className="bg-indigo-100 text-indigo-600 p-4 rounded-full mb-4">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t.dropzoneTitle}</h3>
              <p className="text-sm text-neutral-500">{t.dropzoneSubtitle}</p>
            </div>

            {/* Image List */}
            {images.length > 0 && (
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex flex-wrap gap-3 justify-between items-center">
                  <h3 className="font-medium text-neutral-700">
                    {t.selectedImages} ({images.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm mr-2">
                      <button 
                        onClick={() => sortImages('nameAsc')}
                        className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 border-r border-neutral-200 transition-colors"
                        title={t.sortNameAsc}
                      >
                        <ArrowDownAZ className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => sortImages('nameDesc')}
                        className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 border-r border-neutral-200 transition-colors"
                        title={t.sortNameDesc}
                      >
                        <ArrowUpZA className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => sortImages('time')}
                        className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title={t.sortTime}
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    </div>
                    <button 
                      onClick={() => setImages([])}
                      className="text-sm text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                    >
                      {t.clearAll}
                    </button>
                  </div>
                </div>
                <ul className="divide-y divide-neutral-100 max-h-[500px] overflow-y-auto">
                  {images.map((img, index) => (
                    <li 
                      key={img.id} 
                      draggable
                      onDragStart={(e) => {
                        setDraggedIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverIndex(index);
                      }}
                      onDragLeave={() => setDragOverIndex(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedIndex !== null && draggedIndex !== index) {
                          const newImages = [...images];
                          const [draggedItem] = newImages.splice(draggedIndex, 1);
                          newImages.splice(index, 0, draggedItem);
                          setImages(newImages);
                        }
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`p-4 flex items-center gap-4 transition-colors group cursor-move
                        ${dragOverIndex === index ? 'bg-indigo-50 border-t-2 border-t-indigo-500' : 'hover:bg-neutral-50'}
                        ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}
                      `}
                    >
                      <div className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 flex items-center justify-center">
                        <img src={img.dataUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {img.file.name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {(img.file.size / 1024 / 1024).toFixed(2)} MB • {img.width}x{img.height}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => moveImage(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                          title={t.moveUp}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveImage(index, 'down')}
                          disabled={index === images.length - 1}
                          className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                          title={t.moveDown}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-neutral-200 mx-1"></div>
                        <button
                          onClick={() => removeImage(img.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                          title={t.remove}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar - Settings */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 space-y-6">
              <div className="flex items-center gap-2 border-b border-neutral-100 pb-4">
                <Settings2 className="w-5 h-5 text-neutral-500" />
                <h2 className="text-lg font-semibold text-neutral-800">{t.pdfSettings}</h2>
              </div>

              <div className="space-y-4">
                {/* Page Size */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">{t.pageSize}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['A4', 'Letter', 'Fit'] as PageSize[]).map((size) => (
                      <button
                        key={size}
                        onClick={() => setPageSize(size)}
                        className={`py-2 px-3 text-sm rounded-lg border font-medium transition-colors
                          ${pageSize === size 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                      >
                        {size === 'Fit' ? t.fit : size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orientation */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">{t.orientation}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Auto', 'Portrait', 'Landscape'] as Orientation[]).map((ori) => (
                      <button
                        key={ori}
                        onClick={() => setOrientation(ori)}
                        disabled={pageSize === 'Fit'}
                        className={`py-2 px-3 text-sm rounded-lg border font-medium transition-colors
                          ${pageSize === 'Fit' ? 'opacity-50 cursor-not-allowed bg-neutral-50 border-neutral-200 text-neutral-400' :
                            orientation === ori 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                      >
                        {ori === 'Auto' ? t.auto : ori === 'Portrait' ? t.portrait : t.landscape}
                      </button>
                    ))}
                  </div>
                  {pageSize === 'Fit' && (
                    <p className="text-xs text-neutral-500 mt-1">{t.autoOrientationNote}</p>
                  )}
                </div>

                {/* Margin */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    {t.margin} <span className="text-neutral-400 font-normal">({margin}mm)</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  {pageSize === 'Fit' && (
                    <p className="text-xs text-neutral-500 mt-1">{t.marginDisabledNote}</p>
                  )}
                </div>

                {/* Image Mode */}
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  <label className="block text-sm font-medium text-neutral-700">{t.imageMode}</label>
                  <div className="flex flex-col gap-2">
                    {(['PassThrough', 'ForceJPG', 'Compress'] as ImageMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setImageMode(mode)}
                        className={`py-2 px-3 text-sm rounded-lg border font-medium transition-colors text-left
                          ${imageMode === mode 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                      >
                        {mode === 'PassThrough' ? t.modePassThrough : mode === 'ForceJPG' ? t.modeForceJPG : t.modeCompress}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="space-y-3">
              <button
                onClick={generatePDF}
                disabled={images.length === 0 || isGenerating}
                className={`w-full py-4 px-6 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-sm
                  ${images.length === 0 
                    ? 'bg-neutral-300 cursor-not-allowed' 
                    : isGenerating
                      ? 'bg-indigo-400 cursor-wait'
                      : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]'}`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t.generatingPdf} {progress}%
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    {t.generatePdf}
                  </>
                )}
              </button>

              {isGenerating && (
                <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      ) : (
        <PdfExtractor t={t} />
      )}
    </div>
  );
}
