# Image2PDF

A browser-only tool for converting images to PDF and extracting embedded images from PDF files.

## Features

- Merge multiple images into a single PDF.
- Reorder images by drag and drop, buttons, file name, or upload time.
- Choose A4, Letter, or image-fit page sizes.
- Configure orientation, margins, and image processing mode.
- Extract images from PDF files and download them individually or as a ZIP.
- Runs locally in the browser; selected files are not uploaded to a server.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- jsPDF
- PDF.js
- JSZip

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:3000`.

## Scripts

- `npm run dev`: start the local development server.
- `npm run build`: create a production build in `dist`.
- `npm run preview`: preview the production build.
- `npm run lint`: run TypeScript checks.
- `npm run clean`: remove the build output.

## Notes

PDF image extraction is best-effort and depends on how the source PDF stores image resources. Some PDFs may contain masks, vector graphics, or rendered page content that is not extractable as standalone image files.
