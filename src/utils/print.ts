/**
 * Utility to print a target DOM element by opening a high-fidelity print window
 * that inherits the app's exact Tailwind v4 styles and Sarabun typography,
 * and paginates multi-page reports into discrete A4 pages with repeating
 * hospital letterhead & watermark footer on every page.
 */
export function printElementByNewWindow(elementId: string, pageTitle: string = 'Print_Document'): boolean {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[Print Utility] Target element with ID "${elementId}" not found in current DOM.`);
    return false;
  }

  const originalTitle = document.title;
  if (pageTitle) {
    document.title = pageTitle;
  }

  const printWindow = window.open('', '_blank', 'width=1000,height=1200,scrollbars=yes,resizable=yes');

  if (printWindow) {
    const origin = window.location.origin;
    const collectedHeadStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => {
        if (node.tagName === 'LINK') {
          const link = node as HTMLLinkElement;
          const href = link.getAttribute('href') || '';
          const absoluteHref = href.startsWith('http') || href.startsWith('//')
            ? href
            : `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
          return `<link rel="stylesheet" href="${absoluteHref}">`;
        }
        return `<style>${node.innerHTML}</style>`;
      })
      .join('\n');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${pageTitle}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet">
          ${collectedHeadStyles}
          <style>
            @page {
              size: A4 portrait;
              margin: 7mm 8mm;
            }
            html {
              font-size: 16px !important;
              -webkit-text-size-adjust: 100%;
              text-size-adjust: 100%;
              background-color: #ffffff !important;
            }
            body {
              font-family: "Sarabun", sans-serif !important;
              font-variant-numeric: tabular-nums;
              font-feature-settings: "tnum" 1;
              background-color: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              -webkit-font-smoothing: antialiased;
            }
            body *, .font-mono, .font-serif, .font-sans, .font-sarabun, code, pre {
              font-family: "Sarabun", sans-serif !important;
              font-variant-numeric: tabular-nums;
              font-feature-settings: "tnum" 1;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-root-sheet,
            .print-root-sheet *,
            div[id="printable-area"],
            div[id="printable-area"] * {
              overflow: visible !important;
            }
            table:not(.print-layout-shell) {
              width: 100% !important;
              max-width: 100% !important;
              border-collapse: collapse;
            }
            table:not(.print-layout-shell) > thead {
              display: table-header-group !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            table:not(.print-layout-shell) > thead > tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            table:not(.print-layout-shell) > tbody > tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: auto !important;
              break-after: auto !important;
            }
            th, td {
              overflow-wrap: anywhere;
              word-break: normal;
            }
            .print-root-sheet,
            div[id="printable-area"],
            .w-\\[210mm\\],
            .max-w-\\[210mm\\] {
              display: block !important;
              width: 194mm !important;
              max-width: 194mm !important;
              min-width: 0 !important;
              min-height: 0 !important;
              padding: 0 !important;
              margin: 0 auto !important;
              border: none !important;
              box-shadow: none !important;
            }
            /* Discrete A4 sheet pages generated by paginatePrintShell */
            .a4-print-page {
              width: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              background: #ffffff;
            }
            .a4-print-page.has-page-break {
              page-break-after: always;
              break-after: page;
            }
            .a4-print-page-body {
              flex: 1 1 auto;
            }
            .a4-print-page-header {
              flex: 0 0 auto;
              padding-bottom: 12px;
            }
            .a4-print-page-footer {
              flex: 0 0 auto;
              padding-top: 12px;
            }
            .no-break, .page-break-inside-avoid {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            @media print {
              .print-root-sheet,
              div[id="printable-area"],
              .w-\\[210mm\\],
              .max-w-\\[210mm\\] {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
              }
              .print\\:hidden,
              .print-hidden,
              .print-hidden-element,
              button {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-root-sheet w-full">
            ${element.innerHTML}
          </div>
          <script>
            /**
             * Splits .print-layout-shell into explicit A4 pages with an identical
             * hospital letterhead at the top and watermark footer at the bottom of EVERY page,
             * while splitting long tables cleanly at <tr> boundaries with repeating table <thead>s.
             */
            function paginatePrintShell() {
              const rootSheet = document.querySelector('.print-root-sheet');
              const shell = rootSheet ? rootSheet.querySelector('.print-layout-shell') : null;
              if (!rootSheet || !shell) return;

              const headerTd = shell.querySelector(':scope > thead > tr > td');
              const bodyTd = shell.querySelector(':scope > tbody > tr > td');
              const footerTd = shell.querySelector(':scope > tfoot > tr > td');
              if (!headerTd || !bodyTd) return;

              const headerNodes = Array.from(headerTd.children).map((n) => n.cloneNode(true));
              const footerNodes = footerTd ? Array.from(footerTd.children).map((n) => n.cloneNode(true)) : [];

              // Unwrap the single top-level wrapper div inside bodyTd (e.g. .space-y-4 or .space-y-6)
              const bodyRoot = bodyTd.firstElementChild;
              if (!bodyRoot) return;
              const bodyRootClass = bodyRoot.className || 'space-y-4';
              const topBlocks = Array.from(bodyRoot.children).map((n) => n.cloneNode(true));

              // Measure exact A4 printable body height (264mm inside 283mm printable box leaves 19mm safety margin)
              const ruler = document.createElement('div');
              ruler.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:264mm;visibility:hidden;pointer-events:none;';
              document.body.appendChild(ruler);
              const maxPageHeight = ruler.getBoundingClientRect().height || 997;
              document.body.removeChild(ruler);

              const pagesContainer = document.createElement('div');
              pagesContainer.className = 'w-full';
              rootSheet.innerHTML = '';
              rootSheet.appendChild(pagesContainer);

              const pages = [];

              function createPage() {
                const page = document.createElement('div');
                page.className = 'a4-print-page';

                const headerWrap = document.createElement('div');
                headerWrap.className = 'a4-print-page-header';
                headerNodes.forEach((n) => headerWrap.appendChild(n.cloneNode(true)));

                const bodyWrap = document.createElement('div');
                bodyWrap.className = 'a4-print-page-body';

                const stack = document.createElement('div');
                stack.className = bodyRootClass;
                bodyWrap.appendChild(stack);

                const footerWrap = document.createElement('div');
                footerWrap.className = 'a4-print-page-footer';
                footerNodes.forEach((n) => footerWrap.appendChild(n.cloneNode(true)));

                page.appendChild(headerWrap);
                page.appendChild(bodyWrap);
                if (footerNodes.length > 0) {
                  page.appendChild(footerWrap);
                }
                pagesContainer.appendChild(page);
                pages.push({ page, stack });
                return pages[pages.length - 1];
              }

              function pageFits(pageObj) {
                const rectH = pageObj.page.getBoundingClientRect().height;
                const scrollH = pageObj.page.scrollHeight;
                return Math.max(rectH, scrollH) <= maxPageHeight;
              }

              let current = createPage();

              function startNewPage() {
                current = createPage();
                return current;
              }

              function appendTableSection({
                origSection,
                targetParent,
                isInsideCard,
                createCardOnNewPage
              }) {
                const origTable = origSection.querySelector('table');
                if (!origTable) {
                  targetParent.appendChild(origSection);
                  if (!pageFits(current) && current.stack.children.length > 0) {
                    targetParent.removeChild(origSection);
                    const nextParent = createCardOnNewPage ? createCardOnNewPage(true) : startNewPage().stack;
                    nextParent.appendChild(origSection);
                  }
                  return targetParent;
                }

                const origTbody = origTable.querySelector('tbody');
                const origRows = origTbody ? Array.from(origTbody.querySelectorAll(':scope > tr')) : [];
                if (origRows.length === 0) {
                  targetParent.appendChild(origSection);
                  return targetParent;
                }

                function buildTableShell(isContinuation) {
                  const sectionClone = origSection.cloneNode(true);
                  const cloneTbody = sectionClone.querySelector('tbody');
                  if (cloneTbody) cloneTbody.innerHTML = '';
                  if (isContinuation) {
                    const titleEl = sectionClone.querySelector('p, div');
                    if (titleEl) {
                      if (titleEl.firstElementChild === null && titleEl.textContent) {
                        titleEl.textContent = titleEl.textContent.trim() + ' (ต่อ)';
                      } else if (titleEl.firstElementChild && titleEl.firstElementChild.textContent) {
                        titleEl.firstElementChild.textContent = titleEl.firstElementChild.textContent.trim() + ' (ต่อ)';
                      }
                    }
                  }
                  return {
                    sectionClone,
                    cloneTbody: sectionClone.querySelector('tbody')
                  };
                }

                let activeParent = targetParent;
                let { sectionClone, cloneTbody } = buildTableShell(false);
                activeParent.appendChild(sectionClone);

                for (let i = 0; i < origRows.length; i++) {
                  const rowClone = origRows[i].cloneNode(true);
                  cloneTbody.appendChild(rowClone);

                  if (!pageFits(current)) {
                    cloneTbody.removeChild(rowClone);

                    if (cloneTbody.children.length === 0) {
                      if (sectionClone.parentElement === activeParent) {
                        activeParent.removeChild(sectionClone);
                      }
                      let cardHadContent = true;
                      if (isInsideCard && activeParent.children.length <= 1) {
                        cardHadContent = false;
                        const parentStack = activeParent.parentElement;
                        if (parentStack) parentStack.removeChild(activeParent);
                      }
                      activeParent = createCardOnNewPage ? createCardOnNewPage(cardHadContent) : startNewPage().stack;
                      const rebuilt = buildTableShell(false);
                      sectionClone = rebuilt.sectionClone;
                      cloneTbody = rebuilt.cloneTbody;
                      activeParent.appendChild(sectionClone);
                    } else {
                      activeParent = createCardOnNewPage ? createCardOnNewPage(true) : startNewPage().stack;
                      const rebuilt = buildTableShell(true);
                      sectionClone = rebuilt.sectionClone;
                      cloneTbody = rebuilt.cloneTbody;
                      activeParent.appendChild(sectionClone);
                    }

                    cloneTbody.appendChild(rowClone);
                  }
                }

                return activeParent;
              }

              for (const block of topBlocks) {
                current.stack.appendChild(block);
                if (pageFits(current)) {
                  continue;
                }
                current.stack.removeChild(block);

                const isLocationCard = block.classList.contains('border') && block.querySelector('.bg-slate-800');
                if (isLocationCard) {
                  const cardHeader = block.querySelector(':scope > .bg-slate-800');
                  const cardChildren = Array.from(block.children);

                  function makeCardShell(isContinuation) {
                    const cardShell = block.cloneNode(false);
                    if (cardHeader) {
                      const hdr = cardHeader.cloneNode(true);
                      if (isContinuation) {
                        const labelSpans = hdr.querySelectorAll('span');
                        if (labelSpans.length >= 3) {
                          labelSpans[2].textContent = labelSpans[2].textContent + ' (ต่อ)';
                        }
                      }
                      cardShell.appendChild(hdr);
                    }
                    return cardShell;
                  }

                  let activeCard = makeCardShell(false);
                  current.stack.appendChild(activeCard);

                  if (!pageFits(current) && current.stack.children.length > 1) {
                    current.stack.removeChild(activeCard);
                    startNewPage();
                    activeCard = makeCardShell(false);
                    current.stack.appendChild(activeCard);
                  }

                  for (const sub of cardChildren) {
                    if (sub === cardHeader) continue;

                    if (sub.querySelector('table')) {
                      activeCard = appendTableSection({
                        origSection: sub,
                        targetParent: activeCard,
                        isInsideCard: true,
                        createCardOnNewPage: (isCont) => {
                          startNewPage();
                          const nextCard = makeCardShell(isCont);
                          current.stack.appendChild(nextCard);
                          return nextCard;
                        }
                      });
                    } else {
                      activeCard.appendChild(sub);
                      if (!pageFits(current)) {
                        activeCard.removeChild(sub);
                        startNewPage();
                        activeCard = makeCardShell(true);
                        current.stack.appendChild(activeCard);
                        activeCard.appendChild(sub);
                      }
                    }
                  }
                  continue;
                }

                if (block.querySelector('table')) {
                  appendTableSection({
                    origSection: block,
                    targetParent: current.stack,
                    isInsideCard: false,
                    createCardOnNewPage: null
                  });
                  continue;
                }

                if (current.stack.children.length > 0) {
                  startNewPage();
                }
                current.stack.appendChild(block);
              }

              // Apply uniform A4 height (264mm safely inside 283mm printable height) and page-breaks
              pages.forEach((p, idx) => {
                p.page.style.minHeight = '264mm';
                if (idx < pages.length - 1) {
                  p.page.classList.add('has-page-break');
                }
              });
            }

            async function waitAndPrint() {
              try {
                if (document.fonts && document.fonts.ready) {
                  await document.fonts.ready;
                }
                const imgs = Array.from(document.images || []);
                await Promise.all(
                  imgs.map((img) =>
                    img.complete
                      ? Promise.resolve()
                      : new Promise((resolve) => {
                          img.onload = resolve;
                          img.onerror = resolve;
                          setTimeout(resolve, 1500);
                        })
                  )
                );
                paginatePrintShell();
              } catch (e) {
                console.warn('Print pagination warning:', e);
              }
              setTimeout(() => {
                window.focus();
                window.print();
                setTimeout(() => {
                  window.close();
                }, 1000);
              }, 250);
            }
            if (document.readyState === 'complete') {
              waitAndPrint();
            } else {
              window.addEventListener('load', waitAndPrint);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    return true;
  }

  // Fallback to in-page print if popup window is blocked by browser security
  console.warn('[Print Utility] Popup window was blocked. Falling back to same-window print rendering.');

  try {
    window.print();
  } catch (err) {
    console.error('In-page print trigger failed:', err);
    return false;
  } finally {
    if (pageTitle) {
      document.title = originalTitle;
    }
  }

  return true;
}
