/**
 * Utility function to download a PDF blob as a file
 * Ensures proper PDF download with correct MIME type and filename
 * @param blob - The PDF blob to download
 * @param filename - The filename for the downloaded file (should end with .pdf)
 */
export const downloadPdfBlob = (blob: Blob, filename: string): void => {
  if (!blob || blob.size === 0) {
    throw new Error("Downloaded PDF is empty.");
  }

  // Ensure filename ends with .pdf
  const pdfFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  
  // Ensure blob has correct MIME type
  const pdfBlob = blob.type === 'application/pdf' 
    ? blob 
    : new Blob([blob], { type: 'application/pdf' });
  
  // Create object URL
  const url = URL.createObjectURL(pdfBlob);
  
  // Create temporary anchor element
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfFilename;
  link.rel = "noopener";
  link.style.display = "none";
  
  // Append to body, trigger download, then remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Keep the URL alive long enough for Chrome to start the download reliably
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 5000);
};


