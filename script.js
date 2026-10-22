(() => {
  'use strict';
  const PDF_URL = 'assets/nikha-invitation-original.pdf';
  const form = document.getElementById('guest-form');
  const nameInput = document.getElementById('guest-name');
  const nameInput2 = document.getElementById('guest-name-2');
  const status = document.getElementById('status');
  const confirmButton = document.getElementById('confirm-button');
  const downloadButton = document.getElementById('download-button');
  const preview = document.getElementById('pdf-preview');
  const loading = document.getElementById('loading');
  let originalBytes = null;
  let personalizedBytes = null;
  let confirmedName = '';
  let confirmedName2 = '';

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `status${type ? ` ${type}` : ''}`;
  }

  function showLoading(message) {
    loading.hidden = false;
    loading.innerHTML = '<span class="spinner" aria-hidden="true"></span><span></span>';
    loading.querySelector('span:last-child').textContent = message;
  }

  async function renderPdf(bytes) {
    if (!window.pdfjsLib) throw new Error('PDF preview library did not load. Check internet connection and refresh the page.');
    preview.replaceChildren();
    preview.hidden = false;
    loading.hidden = false;
    showLoading('Rendering invitation preview…');
    // Disable worker to avoid mobile/CSP worker restrictions; PDF.js still renders the pages.
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(bytes), disableWorker: true }).promise;
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const availableWidth = Math.max(240, preview.clientWidth || preview.parentElement.clientWidth - 20);
      const baseViewport = page.getViewport({ scale: 1 });
      const cssScale = Math.min(1.5, availableWidth / baseViewport.width);
      const viewport = page.getViewport({ scale: cssScale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      canvas.setAttribute('aria-label', `Invitation page ${pageNo} of ${pdf.numPages}`);
      preview.appendChild(canvas);
      await page.render({ canvasContext: context, viewport, transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null }).promise;
    }
    loading.hidden = true;
  }

  async function loadOriginal() {
    try {
      if (location.protocol === 'file:') throw new Error('Please deploy this folder to Netlify or run it through a local web server. Do not open index.html directly.');
      const response = await fetch(new URL(PDF_URL, document.baseURI), { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Could not load original PDF (HTTP ${response.status}). Ensure assets/nikha-invitation-original.pdf is deployed.`);
      originalBytes = await response.arrayBuffer();
      await renderPdf(originalBytes.slice(0));
      setStatus('Original invitation loaded. Enter guest names and confirm to create your personalized PDF.');
    } catch (error) {
      loading.hidden = false;
      loading.textContent = 'Unable to load invitation preview.';
      setStatus(error.message || 'Could not load the original invitation PDF.', 'error');
    }
  }

  async function createPersonalizedPdf(name, name2) {
    if (!window.PDFLib) throw new Error('PDF editor library did not load. Check your internet connection and refresh.');
    if (!originalBytes) throw new Error('Original PDF is not ready yet. Wait for the preview to load and try again.');
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(originalBytes.slice(0));
    const firstPage = pdfDoc.getPages()[0];
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const pageHeight = firstPage.getHeight();
    function drawGuestName(text, yFromTop) {
      if (!text) return;
      let size = 10;
      const maxWidth = 184;
      while (font.widthOfTextAtSize(text, size) > maxWidth && size > 6) size -= 0.25;
      firstPage.drawText(text, { x: 78, y: pageHeight - yFromTop, size, font, color: rgb(0.08, 0.09, 0.12), maxWidth });
    }
    // Fine-tune these two values if the names need slight vertical adjustment on the original artwork.
    drawGuestName(name, 207);
    drawGuestName(name2, 233);
    return await pdfDoc.save();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim().replace(/\s+/g, ' ');
    const name2 = nameInput2.value.trim().replace(/\s+/g, ' ');
    if (!name) { setStatus('Please enter the first guest name.', 'error'); nameInput.focus(); return; }
    if (name.length > 35 || name2.length > 35) { setStatus('Please keep each guest name under 35 characters.', 'error'); return; }
    confirmButton.disabled = true;
    downloadButton.disabled = true;
    confirmButton.querySelector('span').textContent = 'Preparing preview…';
    setStatus('Adding the guest names and rendering the preview. Please wait.');
    try {
      const bytes = await createPersonalizedPdf(name, name2);
      await renderPdf(bytes);
      personalizedBytes = bytes;
      confirmedName = name;
      confirmedName2 = name2;
      downloadButton.disabled = false;
      setStatus(`Confirmed for ${name}${name2 ? ' and ' + name2 : ''}. Your personalized 3-page invitation is ready.`, 'success');
    } catch (error) {
      setStatus(error.message || 'Something went wrong while creating the invitation.', 'error');
    } finally {
      confirmButton.disabled = false;
      confirmButton.querySelector('span').textContent = 'Confirm & Preview';
    }
  });

  function invalidateConfirmedPdf() {
    const current1 = nameInput.value.trim().replace(/\s+/g, ' ');
    const current2 = nameInput2.value.trim().replace(/\s+/g, ' ');
    if (confirmedName && (current1 !== confirmedName || current2 !== confirmedName2)) {
      personalizedBytes = null;
      confirmedName = '';
      confirmedName2 = '';
      downloadButton.disabled = true;
      setStatus('Name changed. Confirm again to prepare the updated PDF.');
    }
  }
  nameInput.addEventListener('input', invalidateConfirmedPdf);
  nameInput2.addEventListener('input', invalidateConfirmedPdf);

  downloadButton.addEventListener('click', () => {
    if (!personalizedBytes || !confirmedName) return;
    const safeName = [confirmedName, confirmedName2].filter(Boolean).join('-').normalize('NFKD').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/[ _]+/g, '-').slice(0, 55) || 'Guest';
    const blob = new Blob([personalizedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nikha-Invitation-${safeName}.pdf`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    setStatus(`Download requested for ${confirmedName}${confirmedName2 ? ' and ' + confirmedName2 : ''}.`, 'success');
  });

  loadOriginal();
})();
