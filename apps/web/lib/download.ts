/** Hand text (a CSV, JSON …) to the browser as a file download. Client only. */
export function downloadText(filename: string, text: string, contentType = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: `${contentType};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before the blob goes away.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
