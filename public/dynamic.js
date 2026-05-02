window.sheetTotals = window.sheetTotals || { material: 0, shipping: 0, investment: 0 };
const MAT_ROOT = '#sheet-gts-material';
const DETAIL_SEL = '.mat-detail-row, .detail-row';

const IS_CLOSED = !!window.__SET_IS_CLOSED;

window._autoSizeTA = window._autoSizeTA || function (el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

window.__matAttCache = window.__matAttCache || {};

function renderExistingList(data, rowId) {
  const items = [
    { key: 'invoice', label: 'Invoice', url: normalizeAttUrl(data.invoice) },
    { key: 'receipt', label: 'Bank Receipt', url: normalizeAttUrl(data.receipt) },
    { key: 'note', label: 'Delivery Note', url: normalizeAttUrl(data.note) },
  ];

  const $list = $('#matExistingList').empty();

  items.forEach(it => {
    const has = !!it.url;

    const row = $(`
      <div class="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2">
        <div class="min-w-0 pr-3">
          <div class="text-sm font-semibold">${it.label}</div>
          <div class="text-xs pm-subtext pm-existing-name">${has ? getFileName(it.url) : 'Not uploaded'}</div>
        </div>

        <div class="flex items-center gap-2">
          ${has ? `
            <button type="button"
              class="mat-att-del-btn relative group h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center"
              data-id="${rowId}" data-type="${it.key}">
              <i class="bi bi-trash text-red-600"></i>

              <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                scale-0 group-hover:scale-100 transition
                bg-black text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
                Delete
              </span>
            </button>
          ` : `<span class="text-xs text-slate-400">—</span>`}
        </div>
      </div>
    `);

    $list.append(row);
  });
}

function countAttachments(data) {
  // accepts entry OR attachments object
  const inv = data.invoice || data.invoice_path || data.invoice_url;
  const rec = data.receipt || data.receipt_path || data.receipt_url;
  const note = data.note || data.note_path || data.note_url;
  return [inv, rec, note].filter(Boolean).length;
}

function updateRowAttachmentBadge(id, attObj) {
  const n = [attObj?.invoice, attObj?.receipt, attObj?.note].filter(Boolean).length;

  // find the view button for that row id
  const $viewBtn = $(`.view-btn[data-id="${id}"]`);
  if (!$viewBtn.length) return;

  // remove existing badge
  $viewBtn.find('.mat-att-dot').remove();

  // add badge if >0
  if (n > 0) {
    $viewBtn.append(`
      <span class="mat-att-dot absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
        rounded-full bg-red-600 text-white text-[11px] font-bold
        flex items-center justify-center leading-none">${n}</span>
    `);
  }
}

function showExistingLoading(on) {
  $('#matExistingLoading').toggleClass('hidden', !on);
}

function setUploadLabels(data) {
  const inv = data?.invoice ? getFileName(data.invoice) : 'No file selected yet.';
  const rec = data?.receipt ? getFileName(data.receipt) : 'No file selected yet.';
  const note = data?.note ? getFileName(data.note) : 'No file selected yet.';

  $('#matInvoiceLabel').text(inv);
  $('#matReceiptLabel').text(rec);
  $('#matNoteLabel').text(note);
}

function fastLoadAttachments(id) {
  showExistingLoading(true);
  $('#matExistingList').empty();

  // if cached, paint instantly and hide loading (because user sees data now)
  if (window.__matAttCache?.[id]) {
    const cached = window.__matAttCache[id];
    setUploadLabels(cached);
    renderExistingList(cached, id);
    showExistingLoading(false); // hide after cached render
  }

  return $.get(withCycle(`/gts-materials/get-attachments/${id}`))
    .done(data => {
      window.__matAttCache = window.__matAttCache || {};
      window.__matAttCache[id] = data || {};

      setUploadLabels(data || {});
      renderExistingList(data || {}, id);
      updateRowAttachmentBadge(id, data || {});
    })
    .fail(() => {
      $('#matExistingList').html(`
        <div class="text-sm text-red-600 border border-red-200 bg-red-50 rounded-xl p-3">
          Failed to load attachments.
        </div>
      `);
    })
    .always(() => {
      showExistingLoading(false); // always hide when request completes
    });
}

function showModal($m) {
  $m.removeClass('hidden').addClass('flex').css('display', 'flex');
}
function hideModal($m) {
  $m.addClass('hidden').removeClass('flex').css('display', '');
}

function normalizeAttUrl(u) {
  if (!u) return null;
  const s = String(u).trim();

  // already absolute
  if (/^https?:\/\//i.test(s)) return s;

  // protocol-relative
  if (s.startsWith('//')) return window.location.protocol + s;

  // make it absolute from site root
  if (s.startsWith('/')) return s;

  return '/' + s.replace(/^\/+/, '');
}

function _compactReceiptResize(scope) {
  const rec = $(scope).find('textarea.receipt-no-textarea')[0];
  const rem = $(scope).find('textarea.remarks-textarea')[0];
  if (!rec || !rem) return;

  const v = (rec.value || '').trim();
  const short = v.length === 0 || (v.length <= 20 && !v.includes('\n'));

  if (short) {
    // collapse receipt to a single row
    rec.style.minHeight = '36px';
    rec.style.height = '36px';
    // give more space to remarks
    rem.style.minHeight = '180px';
  } else {
    rec.style.minHeight = '0px';
    rec.style.height = 'auto';
    rem.style.minHeight = '120px';
  }

  // autosize both after min-heights are set
  window._autoSizeTA?.(rec);
  window._autoSizeTA?.(rem);
}

function updateCombinedCard() {
  const st = window.sheetTotals || { material: 0, shipping: 0, investment: 0 };
  const combined = (Number(st.material) || 0) + (Number(st.investment) || 0);

  const $el = $("#materialPlusInvestment");
  if ($el.length) {
    $el.text(`AED ${combined.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    })}`);
  }
}

// 3) One-time listener + initial paint
if (!window.__gtsCombinedHooked) {
  window.__gtsCombinedHooked = true;

  document.addEventListener('gts:totals-changed', () => {
    if (typeof updateCombinedCard === 'function') updateCombinedCard();
  });

  if (typeof updateCombinedCard === 'function') updateCombinedCard();
}

function formatLongDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00'); // avoid timezone shift
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

$(function () {
  // already there
  if (typeof fetchAndUpdateMaterialTotals === 'function') fetchAndUpdateMaterialTotals();
  fetchAndUpdateInvestmentTotal();

  // init + load (guarded by element presence so other pages don’t run this)
  if ($('#sheet-gts-material').length) {
    initMaterialLogic();
    loadGtsMaterials();
  }
  if ($('#investmentTableBody').length) {
    initInvestmentLogic();
    loadGtsInvestments();
  }
});

function initMaterialLogic() {
  $.ajaxSetup({
    headers: {
      'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
    }
  });

  if (window.materialLogicInitialized) return;
  window.materialLogicInitialized = true;

  const $tableBody = $("#materialTableBody");
  const $modal = $("#addRowModal");
  const $modalInvoiceDate = $("#modalInvoiceDate");
  const $modalSupplierName = $("#modalSupplierName");
  const $modalDescription = $("#modalDescription");

  $("#addRowBtn").on("click", function () {
    if (IS_CLOSED) return;
    $("#typeSelectModal").removeClass("hidden").addClass("flex");
  });

  // Cancel the type modal safely
  $("#cancelTypeSelectBtn").on("click", function () {
    $("#typeSelectModal").addClass("hidden").removeClass("flex");
  });

  // Open Add Row modal manually when Material Layout is clicked
  $("#selectMaterialBtn").on("click", function () {
    $("#typeSelectModal").addClass("hidden").removeClass("flex");

    // Clear all input fields
    $("#modalInvoiceDate").val("");
    $("#modalInvoiceNo").val("");
    $("#modalSupplierName").val("");
    $("#modalDescription").val("");

    // Ensure buttons are correct
    $("#submitMaterialBtn").show();      // Show submit for new row
    $("#saveMaterialBtn").hide();        // Hide save button for new
    $("#deleteMaterialBtn").hide();      // Hide delete on new add

    // Just show modal — don't add any row automatically
    $("#addRowModal").removeClass("hidden").addClass("flex");
  });

  // Cancel Add Row modal
  $("#modalCancelBtn").on("click", function () {
    $("#addRowModal").addClass("hidden").removeClass("flex");
  });

  $("#addRowForm").on("submit", function (e) {
    e.preventDefault();

    // Extract input values
    const rawDate = $modalInvoiceDate.val().trim();
    const invoiceNo = $("#modalInvoiceNo").val().trim();
    const supplierName = $modalSupplierName.val().trim();
    const description = $modalDescription.val().trim();
    const serialNumber = $("#materialTableBody .header-row").length + 1;

    // Hide modal
    $("#addRowModal").addClass("hidden").removeClass("flex");

    const COLS = IS_CLOSED ? 7 : 8; // header columns without Action vs with Action

    const actionCellHtml = IS_CLOSED
      ? '' // no action cell when closed
      : `<td class="border p-2 text-center">
          <div class="flex items-center justify-center gap-1">
            <button class="materials-submit-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded">Submit</button>
            <button class="remove-row bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded">Delete</button>
          </div>
        </td>`;

    const rawDateISO = rawDate || ''; // YYYY-MM-DD from <input type="date">

    const draftHeaderCells = `
      <td class="border p-2">
          <span class="mh-date-text block ${IS_CLOSED ? '' : 'cursor-pointer'}">
            ${formatLongDate(rawDateISO)}
          </span>
          <input type="date"
                class="mh-invoice-date w-full bg-transparent outline-none hidden"
                value="${rawDateISO}" ${IS_CLOSED ? 'disabled' : ''}>
      </td>
      <td class="border p-2">
        <input type="text" class="draft-invoice-no w-full bg-transparent outline-none" value="${escapeHtml(invoiceNo)}">
      </td>
      <td class="border p-2">
        <input type="text" class="draft-supplier-name w-full bg-transparent outline-none" value="${escapeHtml(supplierName)}">
      </td>
      <td class="border p-2">
        <input type="text" class="draft-brief-description w-full bg-transparent outline-none" value="${escapeHtml(description)}">
      </td>
    `;

    // Create header row
    const $headerRow = $(`
      <tr class="header-row cursor-pointer hover:bg-gray-100" data-brief="${description}" data-submitted="false" data-new="true">
        <td class="border p-2 text-center">${serialNumber}</td>
        ${draftHeaderCells}
        <td class="border p-2 header-total-material">AED 0</td>
        <td class="border p-2 header-total-shipping">AED 0</td>
        ${actionCellHtml}
      </tr>
    `);

    // Create detail row
    const $detailRow = $(`
      <tr class="mat-detail-row detail-row relative hidden" data-new="true">
        <td colspan="${COLS}" class="p-2 bg-gray-50">
        <div class="supplier-title text-center font-bold text-xl mb-4 bg-blue-200 p-2">${supplierName}</div>

          <div class="flex justify-center">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-16 w-full max-w-5xl mx-auto">
              <!-- Left Section -->
              <div class="space-y-2 border-4 border-zinc-500 p-5 bg-white">
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Invoice No:</span> <div class="invoice-no-label flex-1 text-gray-700">${invoiceNo}</div></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Total Weight (KG):</span> <div class="flex-1 text-gray-700 total-weight-kg">0</div></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Total No. of Units:</span> <div class="flex-1 text-gray-700 total-units">0</div></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">DGD:</span> <div class="flex-1 text-gray-700 dgd-value">AED</div></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Labour Charges:</span> <div class="flex-1 text-gray-700 labour-value">AED</div></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Shipping Cost:</span> <div class="flex-1 text-gray-700 shipping-cost-value">0</div></div>
              </div>
              <!-- Right Section -->
              <div class="space-y-2 border-4 border-zinc-500 p-5 bg-white">
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Mode of Transaction:</span> <input type="text" placeholder="Enter Transaction Method" class="flex-1 editable-input w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none" /></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Receipt No:</span> <textarea placeholder="Enter receipt numbers" class="gts-area receipt-no-textarea flex-1 dynamic-textarea w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none resize-none overflow-hidden whitespace-pre-wrap break-words leading-snug text-[13px] md:text-[14px]"></textarea></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Remarks:</span> <textarea placeholder="Enter Remarks" class="gts-area dynamic-textarea flex-1 w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none resize-none overflow-hidden whitespace-pre-wrap break-words leading-snug text-[13px] md:text-[14px]"></textarea></div>
              </div>
            </div>
          </div>

          <!-- Item Table -->
          <div class="mt-4">
            <table class="min-w-full border-4 border-zinc-500 p-5 bg-white">
              <thead>
                <tr>
                  <th class="border p-1 w-5">S.No</th>
                  <th class="border p-1 w-64">Description</th>
                  <th class="border p-1 w-24">No. of Units</th>
                  <th class="border p-1 w-40">Unit Material w/out VAT</th>
                  <th class="border p-1 w-20">VAT 5%</th>
                  <th class="border p-1 w-40">Total material buy</th>
                  <th class="border p-1 w-32">Weight / ctn</th>
                  <th class="border p-1 w-24">No. of CTNS</th>
                  <th class="border p-1 w-32">Total Weight</th>
                </tr>
              </thead>
              <tbody class="item-table-body">
                <!-- Rows added here -->
              </tbody>
            </table>

            <button type="button" class="add-item-row-btn mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">+ Add More Items</button>
          </div>

          <!-- Summary Footer -->
          <div class="mt-4 border-4 border-zinc-700 bg-white">
            <div class="grid grid-cols-2 divide-x divide-gray-300">

              <!-- Total Material Without VAT -->
              <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">Total Material w/out VAT:</div>
              <div class="flex items-center border-b border-gray-300 p-2 w-full bg-yellow-100 total-material-without-vat">AED 0</div>

              <!-- Total VAT -->
              <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">Total VAT:</div>
              <div class="flex items-center border-b border-gray-300 p-2 w-full bg-yellow-100 total-vat">AED 0</div>

              <!-- Total Material Buy -->
              <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">Total Material Buy:</div>
              <div class="flex items-center border-b border-gray-300 p-2 w-full bg-yellow-100 total-material-buy">AED 0</div>

              <!-- Shipping Cost -->
              <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">Shipping Cost:</div>
              <div class="flex items-center gap-1 border-b border-gray-300 p-2 w-full bg-yellow-100">
                <span class="font-medium">AED</span>
                <input
                  type="number"
                  value="0"
                  min="0"
                  data-field="shippingCost"
                  step="0.0000001"
                  inputmode="decimal"
                  class="shipping-input w-full bg-yellow-100 border-0 focus:outline-none"
                />
              </div>

              <!-- DGD -->
              <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">DGD:</div>
              <div class="flex items-center gap-1 border-b border-gray-300 p-2 w-full bg-yellow-100">
                <span class="font-medium">AED</span>
                <input
                  type="number"
                  value="0"
                  min="0"
                  data-field="dgd"
                  step="0.0000001"
                  inputmode="decimal"
                  class="shipping-input flex-1 bg-yellow-100 border-0 focus:outline-none"
                />
              </div>

              <!-- Labour -->
              <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">Labour:</div>
              <div class="flex items-center gap-1 border-b border-gray-300 p-2 w-full bg-yellow-100">
                <span class="font-medium">AED</span>
                <input
                  type="number"
                  value="0"
                  min="0"
                  data-field="labour"
                  step="0.0000001"
                  inputmode="decimal"
                  class="shipping-input flex-1 bg-yellow-100 border-0 focus:outline-none"
                />
              </div>

              <!-- Total Shipping Cost -->
              <div class="flex items-center p-2 font-semibold w-full">Total Shipping Cost:</div>
              <div class="flex items-center p-2 w-full bg-yellow-100 total-shipping-cost">
                AED 0
              </div>
            </div>
          </div>
        </td>
      </tr>
    `);

    // Append rows
    const $tableBody = $("#materialTableBody");
    $tableBody.append($headerRow, $detailRow);

    // Setup correct S.NO for item row
    const $itemTableBody = $detailRow.find(".item-table-body");
    const nextSerial = 1;
    const firstRow = $("#itemRowTemplate").html().replace(/__SNO__/g, nextSerial);
    $itemTableBody.append(firstRow);

    // Reset & initialize all values inside this detail row
    $detailRow.find("input, textarea").val("");

    $detailRow.find('textarea.dynamic-textarea').each(function () { window._autoSizeTA?.(this); });
    _compactReceiptResize($detailRow);

    $detailRow.find(".total-vat, .total-material-buy, .total-material-without-vat, .total-shipping-cost").text("AED 0");
    $detailRow.find(".total-weight-kg").text("0");

    $detailRow.find(".dgd-value, .labour-value, .shipping-cost-value").text("AED 0");

    // Add dynamic input listeners to this row
    $detailRow.find("input[data-field], textarea").on("input", function () {
      calculateRowTotals($detailRow, $headerRow);
    });

    // Trigger initial calculation
    calculateRowTotals($detailRow, $headerRow);

    // create initial snapshot for new draft row
    $detailRow.data('snapshot', buildMaterialSnapshot($detailRow));

    // drafts are not submitted/loaded -> icon stays hidden (fine)
    toggleUpdateButtonForDetail($detailRow);
  });

  // On blur or input: adjust based on content
  $(document).on("blur input", ".editable-input", function () {
    if ($(this).val().trim() === "") {
      // EMPTY: white background + border
      $(this)
        .removeClass("border-0")
        .addClass("border border-gray-300 bg-white");
    } else {
      // FILLED: gray background + no border
      $(this)
        .removeClass("border border-gray-300")
        .addClass("border-0 bg-white");
    }
  });

  // Auto-resize on input for <textarea>
  $(document).on("input", ".dynamic-textarea", function () {
    const $textarea = $(this);

    // Auto-resize
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";

    // While typing, make it visually editable
    $textarea.css({
      "border": "1px solid #ccc",
      "background": "#fff",
      "outline": "none",
      "box-shadow": "none",
      "resize": "none",
      "overflow": "hidden"
    });
  });

  // Grow as you type
  $(document)
    .off('input.dynamicTA')
    .on('input.dynamicTA', '.dynamic-textarea', function () {
      window._autoSizeTA(this);
    });

  // Keep full height after blur; keep borders intact
  $(document)
    .off('blur.dynamicTA')
    .on('blur.dynamicTA', '.dynamic-textarea', function () {
      this.value = this.value.trim();
      window._autoSizeTA(this);
    });

  // when typing in Receipt No, re-evaluate the layout
  $(document)
    .off('input.receiptCompact')
    .on('input.receiptCompact', 'textarea.receipt-no-textarea', function () {
      _compactReceiptResize($(this).closest('.detail-row, .mat-detail-row'));
    });

  // Live typing: recalc only the current row
  $(document).on(
    'input.gtsmat',
    `${MAT_ROOT} ${DETAIL_SEL} .material-input, ${MAT_ROOT} ${DETAIL_SEL} .shipping-input`,
    function () {
      const $detailRow = $(this).closest(DETAIL_SEL);
      const $headerRow = $detailRow.prev('.header-row');
      calculateRowTotals($detailRow, $headerRow);
      updateGtsTotalsFromDOM();
      document.dispatchEvent(new CustomEvent('gts:totals-changed'));
    }
  );

  // Ensure summary-footer inputs (shipping/dgd/labour) also toggle the Update button
  $(document).on('input change', `${MAT_ROOT} ${DETAIL_SEL} .shipping-input`, function () {
    const $detailRow = $(this).closest('.detail-row');
    const $headerRow = $detailRow.prev('.header-row');

    // keep totals right while typing
    calculateRowTotals($detailRow, $headerRow);

    // show/hide Update Row button based on diff
    toggleUpdateButtonForDetail($detailRow);
  });

  // auto-grow the description textarea
  $(document).on("input", ".material-input[data-field='description']", function () {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
  });

  // “Add item row” (id → class, and scoped)
  $(document).on('click', `${MAT_ROOT} .add-item-row-btn`, function () {
    const $detailRow = $(this).closest(DETAIL_SEL);
    const $headerRow = $detailRow.prev('.header-row');
    const $tbody = $detailRow.find('.item-table-body');

    let nextSerial = 1;
    const lastRow = $tbody.find('tr:last-child');
    if (lastRow.length) {
      const lastSno = parseInt(lastRow.find('td:first').text(), 10);
      if (!isNaN(lastSno)) nextSerial = lastSno + 1;
    }

    const $newRow = $($('#itemRowTemplate').html().replace(/__SNO__/g, nextSerial));
    $newRow.attr('data-new', 'true');
    $tbody.append($newRow);

    calculateRowTotals($detailRow, $headerRow);
    updateGtsTotalsFromDOM();
    toggleUpdateButtonForDetail($detailRow);
  });

  $(document).on("click.gtsmat", `${MAT_ROOT} .remove-row`, function () {
    const $row = $(this).closest("tr");
    const $detailRow = $row.next(DETAIL_SEL); // header's sibling before removal
    $row.remove();

    // Recalculate all detail rows
    $(`${MAT_ROOT} ${DETAIL_SEL}`).each(function () {
      const $detailRow = $(this);
      const $headerRow = $detailRow.prev(".header-row");
      calculateRowTotals($detailRow, $headerRow);
    });

    updateGtsTotalsFromDOM();
    renumberRows($(MAT_ROOT));
  });

  // Renumber (scoped + class-based)
  function renumberRows($scope = $(MAT_ROOT)) {
    $scope.find('.item-table-body tr').each(function (i) {
      $(this).find('td:first').text(i + 1);
    });
  }

  $(document).on("click", `${MAT_ROOT} .header-row`, function (e) {
    // ignore clicks on buttons/links inside the row
    if ($(e.target).is("button") || $(e.target).closest("button").length || $(e.target).is("a")) return;

    const $detail = $(this).next(DETAIL_SEL);

    // hide other open detail rows
    $(`${MAT_ROOT} ${DETAIL_SEL}`).not($detail).hide();

    // toggle this one
    $detail.toggle();

    // if now visible, autosize textareas + compact receipt immediately after paint
    if ($detail.is(':visible')) {
      requestAnimationFrame(() => {
        $detail.find('textarea.dynamic-textarea').each((_, el) => window._autoSizeTA?.(el));
        _compactReceiptResize($detail);

        // one more pass after layout settles
        queueMicrotask(() => {
          $detail.find('textarea.dynamic-textarea').each((_, el) => window._autoSizeTA?.(el));
          _compactReceiptResize($detail);
        });
      });
    }
  });

  // click long text -> open date input
  $(document).on('click', '.mh-date-text', function (e) {
    if (IS_CLOSED) return;
    const $td = $(this).closest('td');
    $td.find('.mh-date-text').addClass('hidden');
    const $inp = $td.find('.mh-invoice-date');
    $inp.removeClass('hidden').focus().trigger('click');
  });

  // when date picked or user leaves -> convert back to long text
  $(document).on('change blur', '.mh-invoice-date', function () {
    const $inp = $(this);
    const iso = ($inp.val() || '').slice(0, 10);
    const $td = $inp.closest('td');
    $td.find('.mh-date-text').text(formatLongDate(iso)).removeClass('hidden');
    $inp.addClass('hidden');
  });

  $(document).on("click.gtsmat", `${MAT_ROOT} .materials-submit-btn`, function () {
    const $headerRow = $(this).closest("tr");
    const $detailRow = $headerRow.next(DETAIL_SEL);

    // Extract header fields
    const invoiceDateISO = ($headerRow.find('.mh-invoice-date').val() || '').slice(0, 10);
    const invoiceNo = ($headerRow.find('.draft-invoice-no').val() || '').trim();
    const supplierName = ($headerRow.find('.draft-supplier-name').val() || '').trim();
    const briefDescription = ($headerRow.find('.draft-brief-description').val() || '').trim();
    const totalMaterial = $headerRow.find(".header-total-material").text().replace(/[^\d.]/g, "");
    const totalShipping = $headerRow.find(".header-total-shipping").text().replace(/[^\d.]/g, "");

    const shippingCost = $detailRow.find('[data-field="shippingCost"]').val() || 0;
    const dgd = $detailRow.find('[data-field="dgd"]').val() || 0;
    const labour = $detailRow.find('[data-field="labour"]').val() || 0;
    const modeOfTransaction = $detailRow.find('input[placeholder="Enter Transaction Method"]').val();
    const receiptNo = $detailRow.find('textarea[placeholder="Enter receipt numbers"]').val();
    const remarks = $detailRow.find('textarea[placeholder="Enter Remarks"]').val();

    // Build the payload
    const data = {
      invoice_date: invoiceDateISO,
      invoice_no: invoiceNo,
      supplier_name: supplierName,
      brief_description: briefDescription,
      shipping_cost: shippingCost,
      dgd: dgd,
      labour: labour,
      total_material: parseFloat(totalMaterial),
      total_vat: parseFloat($detailRow.find('.total-vat').text().replace(/[^\d.]/g, "")) || 0,
      total_material_buy: parseFloat($detailRow.find('.total-material-buy').text().replace(/[^\d.]/g, "")) || 0,
      total_weight: parseFloat($detailRow.find('.total-weight-kg').text().replace(/[^\d.]/g, "")) || 0,
      mode_of_transaction: modeOfTransaction,
      receipt_no: receiptNo,
      remarks: remarks,
      items: []
    };

    // THIS LOOP RIGHT HERE to collect item rows
    $detailRow.find(".item-row").each(function () {
      const $row = $(this);
      const item = {
        description: $row.find('[data-field="description"]').val(),
        units: parseFloat($row.find('[data-field="units"]').val()) || 0,
        unit_price: parseFloat($row.find('[data-field="unitPrice"]').val()) || 0,
        vat: parseFloat($row.find('[data-field="vat"]').val()) || 0,
        weight_per_ctn: parseFloat($row.find('[data-field="weightPerCtn"]').val()) || 0,
        ctns: parseFloat($row.find('[data-field="ctns"]').val()) || 0,
      };
      data.items.push(item);
    });

    // Send to backend
    $.ajax({
      url: withCycle("/gts-materials"),
      method: "POST",
      data: data,
      headers: {
        "X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr("content")
      },
      success: function (response) {
        // 1) persist ids on both rows
        const materialId = response.id;
        // mark BOTH rows clearly
        $headerRow.attr("data-id", materialId).attr("data-loaded", "true");
        $detailRow
          .attr("data-id", materialId)
          .addClass("submitted")
          .attr("data-loaded", "true");

        // create snapshot immediately
        $detailRow.data("snapshot", buildMaterialSnapshot($detailRow));
        toggleUpdateButtonForDetail($detailRow);

        // 2) ensure header totals reflect what we just typed
        calculateRowTotals($detailRow, $headerRow);

        // 3) rebuild the full action button cluster (upload / view / delete)
        const fullActions = `
        <div class="action-buttons flex justify-center gap-1">
          ${createMaterialIcon('upload-btn', 'bi-cloud-arrow-up-fill', 'Upload Attachments',
          'bg-blue-500 hover:bg-blue-600 text-white', materialId)}
          ${createMaterialIcon('view-btn', 'bi-paperclip', 'View Attachments',
            'bg-gray-700 hover:bg-gray-800 text-white', materialId)}
          ${createMaterialIcon('delete-material-btn', 'bi-trash-fill', 'Delete Row',
              'bg-red-500 hover:bg-red-600 text-white', materialId)}
        </div>`;
        $headerRow.find('td:last').html(fullActions);

        // 4) make sure cards repaint AFTER header cells are updated
        paintCardsFromDOM('save');

        // optional: if you have server-side fetchers, keep them
        if (typeof fetchAndUpdateMaterialTotals === 'function') fetchAndUpdateMaterialTotals(); // optional server re-sync
        if (typeof fetchAndUpdateInvestmentTotal === 'function') fetchAndUpdateInvestmentTotal();

        // 5) UX: show saved state
        const $cell = $headerRow.find('td:last').addClass('bg-green-50');
        setTimeout(() => $cell.removeClass('bg-green-50'), 600);
      },
      error: function (xhr) {
        console.error("Error saving material:", xhr.responseText);
        alert("Failed to save. See console for details.");
      }
    });
  });

  let deleteTargetHeader = null;
  let deleteTargetDetail = null;
  let deleteTargetId = null;

  $(document).on("click.gtsmat", `${MAT_ROOT} .delete-material-btn`, function () {
    deleteTargetHeader = $(this).closest("tr");
    deleteTargetDetail = deleteTargetHeader.next(DETAIL_SEL);
    deleteTargetId = deleteTargetHeader.data("id");

    $("#deleteConfirmModal").removeClass("hidden").addClass("flex");
  });

  $("#cancelDeleteBtn").on("click", function () {
    $("#deleteConfirmModal").addClass("hidden").removeClass("flex");
    deleteTargetHeader = null;
    deleteTargetDetail = null;
    deleteTargetId = null;
  });

  $("#confirmDeleteBtn").on("click", function () {
    if (!deleteTargetId) return;

    $.ajax({
      url: withCycle("/gts-materials/" + deleteTargetId),
      method: "DELETE",
      headers: { "X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr("content") },
      success: function () {
        // Find by id at the moment of success (avoids stale refs)
        const selector = `#materialTableBody tr.header-row[data-id="${deleteTargetId}"]`;
        const $header = $(selector);
        const $detail = $(`tr${DETAIL_SEL}[data-id="${deleteTargetId}"]`);

        // Remove both rows safely (detail may or may not be adjacent)
        $detail.remove();
        $header.remove();

        // Renumber & repaint cards
        reindexSerialNumbers();
        paintCardsFromDOM('delete');

        // Also refresh totals from server so other tabs & dashboard match
        if (typeof fetchAndUpdateMaterialTotals === 'function') fetchAndUpdateMaterialTotals();

        // Close modal and clear targets
        $("#deleteConfirmModal").addClass("hidden").removeClass("flex");
        deleteTargetHeader = deleteTargetDetail = deleteTargetId = null;
      },
      error: function (xhr) {
        console.error(xhr.responseText);
        alert("Failed to delete. See console for details.");
      }
    });
  });

  let $rowToDelete = null; // temp store clicked row

  $(document).on("click", `${MAT_ROOT} .delete-item-btn`, function () {
    $rowToDelete = $(this).closest("tr");
    const itemId = $rowToDelete.data("item-id");

    if (itemId) {
      // Show confirmation modal only for saved items
      $("#confirmItemDeleteModal").removeClass("hidden flex").addClass("flex");
    } else {
      // Just remove from DOM if unsaved
      $rowToDelete.remove();

      // Re-check if update button is needed
      const $detailRow = $rowToDelete.closest(DETAIL_SEL);
      toggleUpdateButtonForDetail($detailRow);
    }
  });

  // SINGLE ITEM DELETE
  $("#confirmItemDeleteBtn").on("click", function () {
    const itemId = $rowToDelete && $rowToDelete.data("item-id");
    if (!itemId) return;

    $.ajax({
      url: withCycle(`/gts-materials/items/${itemId}`),
      method: "DELETE",
      headers: { "X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr("content") }
    })
      .done(function (res) {
        // Remove the item row in the UI
        const $detailRow = $rowToDelete.closest(DETAIL_SEL);
        const $headerRow = $detailRow.prev('.header-row');
        $rowToDelete.remove();

        // Recompute this detail+header numbers and repaint top cards
        calculateRowTotals($detailRow, $headerRow);
        paintCardsFromDOM('item-delete');

        // Server totals (used by dashboard & cold starts)
        if (typeof fetchAndUpdateMaterialTotals === 'function') fetchAndUpdateMaterialTotals();

        // If backend returned fresh totals, update header cells directly too
        if (res && typeof res.ui_total_material !== "undefined") {
          $headerRow.find(".header-total-material").text(formatCurrency(res.ui_total_material));
        }
        $("#confirmItemDeleteModal").addClass("hidden");
        $rowToDelete = null;
      })
      .fail(function (xhr) {
        alert("Failed to delete item. See console for details.");
        console.error(xhr.responseText);
      });
  });

  $("#cancelItemDeleteBtn").on("click", function () {
    $("#confirmItemDeleteModal").addClass("hidden");
    $rowToDelete = null;
  });

  // ---------- MATERIAL ATTACHMENTS (Metal-ledger style) ----------

  function showPM($m) { $m.removeClass('hidden').css('display', 'flex'); }
  function hidePM($m) { $m.addClass('hidden').css('display', ''); }

  const $upModal = $('#matAttUploadModal');
  const $vwModal = $('#matAttViewerModal');

  let matZoom = 1;
  let matCurrentUrl = null;
  let matCurrentId = null;



  function resetViewer() {
    matZoom = 1;
    matCurrentUrl = null;

    $('#matPreviewFrame').addClass('hidden').css('transform', 'scale(1)').attr('src', '');
    $('#matPreviewImgWrap').addClass('hidden');
    $('#matPreviewImg').attr('src', '').css('transform', 'scale(1)');
    $('#matPreviewEmpty').removeClass('hidden');

    $('#matDownloadBtn').addClass('pointer-events-none opacity-50').attr('href', '#');
  }

  function applyZoom() {
    $('#matPreviewImg').css('transform', `scale(${matZoom})`);
    $('#matPreviewFrame').css('transform', `scale(${matZoom})`).css('transform-origin', 'top left');
  }

  function openPreview(url) {
    resetViewer();
    matCurrentUrl = url;

    if (!url) {
      return;
    }

    const lower = String(url).toLowerCase();
    $('#matPreviewEmpty').addClass('hidden');

    if (lower.endsWith('.pdf')) {
      $('#matPreviewFrame').removeClass('hidden').attr('src', url);
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(lower)) {
      $('#matPreviewImgWrap').removeClass('hidden');
      $('#matPreviewImg').attr('src', url);
    } else {
      // fallback open in new tab
      window.open(url, '_blank');
      $('#matPreviewEmpty').removeClass('hidden');
      return;
    }

    $('#matDownloadBtn').removeClass('pointer-events-none opacity-50').attr('href', url);
    applyZoom();
  }

  $(document).on('click', '.mat-att-del-btn', function () {
    const id = $(this).data('id');
    const type = $(this).data('type');

    if (!id || !type) return;
    if (!confirm(`Delete ${type} attachment?`)) return;

    $.ajax({
      url: withCycle(`/gts-materials/${id}/delete-attachment`), // adjust route
      method: 'POST',
      data: { type },
      headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') }
    })
      .done((res) => {
        // update cache + list + badge immediately
        window.__matAttCache[id] = res?.attachments || {};
        setUploadLabels(window.__matAttCache[id]);
        renderExistingList(window.__matAttCache[id], id);
        updateRowAttachmentBadge(id, window.__matAttCache[id]);
      })
      .fail(xhr => {
        alert(xhr?.responseJSON?.message || 'Delete failed.');
        console.error(xhr?.responseText || xhr);
      });
  });

  // Open UPLOAD modal (open first, fetch after)
  $(document).on('click.gtsmat', `${MAT_ROOT} .upload-btn`, function (e) {
    e.preventDefault(); e.stopPropagation();

    const id = $(this).data('id');
    matCurrentId = id;
    $('#matAttRowId').val(id);

    // reset remove flags
    $('#matRemoveInvoice, #matRemoveReceipt, #matRemoveNote').val('0');

    // reset file inputs
    $('#matInvoiceInput, #matReceiptInput, #matNoteInput').val('');
    setUploadLabels({ invoice: null, receipt: null, note: null });
    $('#matExistingList').empty();

    showPM($upModal);
    fastLoadAttachments(id);
  });

  // Browse buttons
  $(document).on('click', '[data-browse="invoice"]', () => $('#matInvoiceInput').trigger('click'));
  $(document).on('click', '[data-browse="receipt"]', () => $('#matReceiptInput').trigger('click'));
  $(document).on('click', '[data-browse="note"]', () => $('#matNoteInput').trigger('click'));

  // Dropzone click
  $(document).on('click', '.pm-dropzone[data-pick="invoice"]', (e) => {
    if ($(e.target).closest('button').length) return;
    $('#matInvoiceInput').trigger('click');
  });
  $(document).on('click', '.pm-dropzone[data-pick="receipt"]', (e) => {
    if ($(e.target).closest('button').length) return;
    $('#matReceiptInput').trigger('click');
  });
  $(document).on('click', '.pm-dropzone[data-pick="note"]', (e) => {
    if ($(e.target).closest('button').length) return;
    $('#matNoteInput').trigger('click');
  });

  // File label updates
  $('#matInvoiceInput').on('change', function () { $('#matInvoiceLabel').text(this.files?.[0]?.name || 'No file selected yet.'); $('#matRemoveInvoice').val('0'); });
  $('#matReceiptInput').on('change', function () { $('#matReceiptLabel').text(this.files?.[0]?.name || 'No file selected yet.'); $('#matRemoveReceipt').val('0'); });
  $('#matNoteInput').on('change', function () { $('#matNoteLabel').text(this.files?.[0]?.name || 'No file selected yet.'); $('#matRemoveNote').val('0'); });

  // Upload submit button
  $('#matAttUploadBtn').on('click', function () {
    const id = $('#matAttRowId').val();
    if (!id) return;

    const fd = new FormData($('#matAttUploadForm')[0]);

    const $btn = $(this);
    $btn.prop('disabled', true).addClass('opacity-70 pointer-events-none').html(`<i class="bi bi-arrow-repeat animate-spin"></i> Uploading...`);

    $.ajax({
      url: withCycle(`/gts-materials/upload-attachments/${id}`),
      method: 'POST',
      data: fd,
      processData: false,
      contentType: false,
      headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') }
    })
      .done(function (res) {
        window.__matAttCache[id] = res?.attachments ?? window.__matAttCache[id] ?? {};
        updateRowAttachmentBadge(id, window.__matAttCache[id]);

        alert(res?.message ?? 'Attachments saved.');
        hidePM($upModal);
        fastLoadAttachments(id);
        loadGtsMaterials(); // refresh list/buttons state
      })
      .fail(function (xhr) {
        alert(xhr?.responseJSON?.message || 'Upload failed.');
        console.error(xhr?.responseText || xhr);
      })
      .always(function () {
        $btn.prop('disabled', false).removeClass('opacity-70 pointer-events-none').html(`<i class="bi bi-cloud-arrow-up"></i> Upload`);
      });
  });

  // Close upload modal
  $('#matAttUploadClose, #matAttUploadCancel, #matAttUploadBackdrop')
    .off('click.matUpClose')
    .on('click.matUpClose', function () { hidePM($upModal); });

  // Open VIEWER modal
  $(document).on('click.gtsmat', `${MAT_ROOT} .view-btn`, function (e) {
    e.preventDefault(); e.stopPropagation();

    const id = $(this).data('id');
    matCurrentId = id;

    resetViewer();
    $('#matViewerList').empty();
    $('#matViewerSubTitle').text(`Row ID: ${id}`);

    // Download all uses your existing endpoint
    $('#matDownloadAllBtn').attr('href', withCycle(`/gts-materials/download-pdf/${id}`));

    showPM($vwModal);

    $.get(withCycle(`/gts-materials/get-attachments/${id}`))
      .done(function (data) {
        const items = [
          { label: 'Invoice', url: normalizeAttUrl(data?.invoice) },
          { label: 'Bank Receipt', url: normalizeAttUrl(data?.receipt) },
          { label: 'Delivery Note', url: normalizeAttUrl(data?.note) },
        ];

        const $list = $('#matViewerList').empty();

        items.forEach((it) => {
          const disabled = !it.url;
          const $btn = $(`
          <button type="button"
            class="w-full text-left border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}">
            <div class="text-sm font-semibold">${it.label}</div>
            <div class="text-xs pm-subtext truncate">${it.url ? getFileName(it.url) : 'Not uploaded'}</div>
          </button>
        `);

          if (!disabled) {
            $btn.on('click', function () {
              // highlight
              $('#matViewerList button').removeClass('ring-2 ring-slate-400');
              $btn.addClass('ring-2 ring-slate-400');
              openPreview(it.url);
            });
          }

          $list.append($btn);
        });
      })
      .fail(function () {
        console.warn('material viewer get failed', id);
      });
  });

  // Zoom controls
  $('#matZoomIn').on('click', function () { matZoom = Math.min(3, matZoom + 0.1); applyZoom(); });
  $('#matZoomOut').on('click', function () { matZoom = Math.max(0.5, matZoom - 0.1); applyZoom(); });
  $('#matZoomReset').on('click', function () { matZoom = 1; applyZoom(); });
  $('#matZoomFit').on('click', function () {
    // simple fit for images: keep scale at 1 (safe). If you want “true fit”, tell me and I’ll add image-size calc.
    matZoom = 1;
    applyZoom();
  });

  // Download current file (single)
  $('#matDownloadBtn').on('click', function (e) {
    const href = $(this).attr('href');
    if (!href || href === '#') { e.preventDefault(); return; }
    // allow normal download/open
  });

  // Close viewer modal
  $('#matAttViewerClose, #matAttViewerBackdrop')
    .off('click.matVwClose')
    .on('click.matVwClose', function () { hidePM($vwModal); });

  $(document).on('click', '#viewInvoiceLink, #viewReceiptLink, #viewNoteLink', function (e) {
    const href = $(this).attr('href');
    if (!href || href === '#') return;
    e.preventDefault();
    renderPreview('#matPreview', href);
  });

  // Materials
  $(document).on('click', '#matDownloadBtn', function () {
    const id = $('#viewAttachmentModal').data('current-id');
    if (id) window.open(withCycle(`/gts-materials/download-pdf/${id}`), '_blank');
  });

  // Submit updates from the Action icon (bind once, namespaced)
  $(document)
    .off('click.materialUpdate')                                  // prevent dup binds
    .on('click.materialUpdate', '.update-row-btn', function (e) {
      e.preventDefault();
      e.stopPropagation(); // don't trigger header-row expand/collapse

      const $btn = $(this);
      if ($btn.data('loading')) return; // block double clicks

      const $headerRow = $btn.closest('tr.header-row');
      const $detailRow = $headerRow.next(DETAIL_SEL);
      const id = $headerRow.data('id');
      if (!id || !$detailRow.length) return;

      // If set is closed, never allow update
      if (typeof IS_CLOSED !== "undefined" && IS_CLOSED) return;

      // Ensure snapshot exists before doing anything
      if (!$detailRow.data('snapshot')) {
        $detailRow.data('snapshot', buildMaterialSnapshot($detailRow));
      }

      // make sure totals are fresh
      calculateRowTotals($detailRow, $headerRow);

      const totalMaterialBuy =
        parseFloat(String($detailRow.find('.total-material-buy').text()).replace(/[^0-9.\-]/g, '')) || 0;

      const uiTotalMaterial =
        parseFloat(String($headerRow.find('.header-total-material').text()).replace(/[^0-9.\-]/g, '')) || 0;

      // ----- header fields (editable for draft rows) -----
      const invoice_date = ($headerRow.find('.draft-invoice-date').val() || '').trim();
      const invoice_no = ($headerRow.find('.draft-invoice-no').val() || '').trim();
      const supplier_name = ($headerRow.find('.draft-supplier-name').val() || '').trim();
      const brief_description = ($headerRow.find('.draft-brief-description').val() || '').trim();

      // payload expected by your controller
      const payload = {
        invoice_date,
        invoice_no,
        supplier_name,
        brief_description,

        mode_of_transaction: ($detailRow.find('input[placeholder="Enter Transaction Method"]').val() || '').trim(),
        receipt_no: ($detailRow.find('textarea.receipt-no-textarea').val() || '').trim(),
        remarks: ($detailRow.find('textarea[placeholder="Enter Remarks"]').val() || '').trim(),
        shipping_cost: parseFloat($detailRow.find('[data-field="shippingCost"]').val()) || 0,
        dgd: parseFloat($detailRow.find('[data-field="dgd"]').val()) || 0,
        labour: parseFloat($detailRow.find('[data-field="labour"]').val()) || 0,
        total_material: parseFloat(String($headerRow.find('.header-total-material').text()).replace(/[^0-9.\-]/g, '')) || 0,
        total_shipping_cost: parseFloat(String($headerRow.find('.header-total-shipping').text()).replace(/[^0-9.\-]/g, '')) || 0,
        total_material_buy: totalMaterialBuy,
        ui_total_material: uiTotalMaterial,
        materials: []
      };

      $detailRow.find('tr.item-row').each(function () {
        const $r = $(this);
        const m = {
          description: ($r.find('[data-field="description"]').val() || '').trim(),
          units: parseFloat($r.find('[data-field="units"]').val()) || 0,
          unit_price: parseFloat($r.find('[data-field="unitPrice"]').val()) || 0,
          vat: parseFloat($r.find('[data-field="vat"]').val()) || 0,
          weight_per_ctn: parseFloat($r.find('[data-field="weightPerCtn"]').val()) || 0,
          ctns: parseFloat($r.find('[data-field="ctns"]').val()) || 0
        };
        const itemId = $r.attr('data-item-id');
        if (itemId) m.id = itemId;
        payload.materials.push(m);
      });

      // lock UI + spinner
      setUpdateBtnLoading($btn, true);

      $.ajax({
        url: withCycle(`/gts-materials/${id}`),
        method: 'PUT',
        headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
        data: payload,
        timeout: 20000
      })
        .done(function (res) {
          $detailRow.find('.supplier-title').text(payload.supplier_name);
          $detailRow.find('.invoice-no-label').text(payload.invoice_no);

          // refresh snapshot to the just-saved state
          $detailRow.data('snapshot', buildMaterialSnapshot($detailRow));

          // remove update button
          toggleUpdateButtonForDetail($detailRow);

          const $cell = $headerRow.find('td:last').addClass('bg-green-50');
          setTimeout(() => $cell.removeClass('bg-green-50'), 600);

          calculateRowTotals($detailRow, $headerRow);
          paintCardsFromDOM('update');
        })
        .fail(function (xhr) {
          const msg =
            xhr?.responseJSON?.message ||
            xhr?.responseText ||
            'Update failed.';
          alert(msg);
          console.error(xhr?.responseText || xhr);

          // keep update icon visible if still dirty
          toggleUpdateButtonForDetail($detailRow);
        })
        .always(function () {
          // unlock UI
          setUpdateBtnLoading($btn, false);
        });
    });

  const MAT_CONTAINER = `${MAT_ROOT}, #materialTableBody`;

  $(document)
    .off('input.changeDetect change.changeDetect')
    .on(
      'input.changeDetect change.changeDetect',
      `
        ${MAT_CONTAINER} ${DETAIL_SEL} input, 
        ${MAT_CONTAINER} ${DETAIL_SEL} textarea,
        ${MAT_CONTAINER} tr.header-row .draft-invoice-date,
        ${MAT_CONTAINER} tr.header-row .draft-invoice-no,
        ${MAT_CONTAINER} tr.header-row .draft-supplier-name,
        ${MAT_CONTAINER} tr.header-row .draft-brief-description
       `,
      function () {
        // if change came from header input, find its detail row
        let $detailRow = $(this).closest(DETAIL_SEL);
        if (!$detailRow.length) {
          const $headerRow = $(this).closest('tr.header-row');
          $detailRow = $headerRow.next(DETAIL_SEL);
        }
        if (!$detailRow.length) return;

        const isSaved = $detailRow.attr('data-loaded') === 'true' || $detailRow.hasClass('submitted');
        if (!isSaved) return;

        // if snapshot missing, create it once
        if (!$detailRow.data('snapshot')) {
          $detailRow.data('snapshot', buildMaterialSnapshot($detailRow));
          return;
        }

        toggleUpdateButtonForDetail($detailRow);
      }
    );

  // Recalc + re-format the summary footer whenever Shipping/DGD/Labour change
  $(document).off('input.materialShip change.materialShip')
    .on('input.materialShip change.materialShip',
      `${MAT_ROOT} ${DETAIL_SEL} input[data-field="shippingCost"], ${MAT_ROOT} ${DETAIL_SEL} input[data-field="dgd"], ${MAT_ROOT} ${DETAIL_SEL} input[data-field="labour"]`,
      function () {
        const $detailRow = $(this).closest(DETAIL_SEL);
        const $headerRow = $detailRow.prev('.header-row');

        // Recompute totals for THIS row (keeps AED prefix correct)
        calculateRowTotals($detailRow, $headerRow);

        // Also keep the Action “Update” icon logic in sync
        toggleUpdateButtonForDetail($detailRow);
      });

}

function updateFileLabel(inputId, labelId) {
  const el = document.getElementById(inputId);
  const name = el && el.files && el.files[0] ? el.files[0].name : 'No file chosen';
  document.getElementById(labelId).textContent = name;
}

$(document).on('change', '#gtsAttachReceipt', () => updateFileLabel('gtsAttachReceipt', 'gtsAttachReceiptFilename'));
$(document).on('change', '#gtsAttachNote', () => updateFileLabel('gtsAttachNote', 'gtsAttachNoteFilename'));

function reindexSerialNumbers() {
  let i = 1;
  $("#materialTableBody tr.header-row").each(function () {
    $(this).find("td:first").text(i++);
  });
}

// Try multiple selector variants (input value or text content)
function getNumber($root, selectors) {
  for (const sel of selectors) {
    const $el = $root.find(sel).first();
    if ($el.length) {
      const raw = ($el.is('input, textarea, select')) ? $el.val() : $el.text();
      // strip currency text & thousand separators here (no external num())
      const n = Number(String(raw ?? '').replace(/[^0-9.\-]/g, '')) || 0;
      return n;
    }
  }
  return 0;
}

// Write currency whether target is <td> or <input>
function writeCurrency($root, selector, value) {
  const s = formatCurrency(value);
  $root.find(selector).each(function () {
    const $el = $(this);
    if ($el.is('input, textarea, select')) $el.val(s); else $el.text(s);
  });
}

// Robust VAT interpreter: 0, %, or multiplier
function vatAmount(base, vatRaw) {
  const v = Number(vatRaw);
  if (!isFinite(v) || v <= 0) return 0;
  if (v > 1 && v < 2) return base * (v - 1.0); // 1.05 => +5%
  if (v > 1 && v <= 100) return base * (v / 100); // 5 => 5%
  if (v > 0 && v < 1) return base * v;           // 0.05 => 5%
  return 0;
}

function stripZeros(n) {
  const s = String(n);
  return s.includes('.') ? s.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1') : s;
}

function setUpdateBtnLoading($btn, loading) {
  if (!$btn || !$btn.length) return;

  if (loading) {
    if ($btn.data('loading')) return; // already loading
    $btn.data('loading', true);

    $btn.data('oldHtml', $btn.html());
    $btn.prop('disabled', true).addClass('opacity-70 pointer-events-none');

    // replace icon with spinner
    $btn.html(`
      <i class="bi bi-arrow-repeat animate-spin" style="font-size:16px;line-height:1"></i>
    `);
  } else {
    $btn.data('loading', false);
    $btn.prop('disabled', false).removeClass('opacity-70 pointer-events-none');

    const old = $btn.data('oldHtml');
    if (old) $btn.html(old);
  }
}

// MAIN: recompute all live numbers for a detail + header
function calculateRowTotals($detailRow, $headerRow) {
  const num = (v) => {
    if (v == null) return 0;
    return Number(String(v).replace(/[^0-9.\-]/g, '')) || 0;
  };

  let totalWeight = 0;
  let totalUnits = 0;
  let totalMaterialBuy = 0;
  let totalVATMoney = 0;       // monetary VAT (kept for other uses if any)
  let totalMaterialNoVAT = 0;

  // Use the nearest section that actually contains header labels/inputs
  const $scope = $detailRow.closest('.gts-material-detail, .material-card, .card, form').first().length
    ? $detailRow.closest('.gts-material-detail, .material-card, .card, form').first()
    : $detailRow;

  // Per-row calculations
  $detailRow.find(".item-row").each(function () {
    const $row = $(this);

    const units = num($row.find('[data-field="units"]').val());
    const unitPrice = num($row.find('[data-field="unitPrice"]').val());
    const vatInput = Number(($row.find('[data-field="vat"]').val() ?? '').toString().trim()) || 0;
    const weightPerCtn = num($row.find('[data-field="weightPerCtn"]').val());
    const ctns = num($row.find('[data-field="ctns"]').val());

    const base = units * unitPrice;                     // NO VAT
    const vatRaw = (vatInput === 1) ? 0 : vatInput;     // treat 1 as "no VAT"
    const vatAmt = vatAmount(base, vatRaw);

    // MATERIALS rule: if VAT input > 1, treat as multiplier; else show base
    const rowBuy = (vatInput > 1) ? (base * vatInput) : base;
    $row.find(".total-material").text(fmtNum7(rowBuy));

    totalMaterialNoVAT += base;
    totalVATMoney += vatAmt;
    totalMaterialBuy += rowBuy;

    const weightTotal = weightPerCtn * ctns;
    $row.find(".total-weight").text(fmtNum7(weightTotal));
    totalWeight += weightTotal;
    totalUnits += units;
  });

  // Read shipping numbers (header labels or real inputs)
  const shippingCost = getNumber($scope, [
    '[data-field="shippingCost"]',
    '[name="shipping_cost"]', '#shipping_cost',
    '.shipping-cost-input', '.header-shipping-cost'
  ]);
  const dgd = getNumber($scope, [
    '[data-field="dgd"]',
    '[name="dgd"]', '#dgd',
    '[name="dgd_charges"]', '.dgd-input', '.header-dgd'
  ]);
  const labour = getNumber($scope, [
    '[data-field="labour"]',
    '[name="labour"]', '#labour',
    '[name="labour_charges"]', '.labour-input', '.header-labour'
  ]);
  const totalShipping = shippingCost + dgd + labour;

  // Paint detail footer: weights & units
  $detailRow.find(".total-weight-kg").text(
    totalWeight.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 7 })
  );
  $detailRow.find(".total-units").text(totalUnits.toLocaleString());

  // 5% VAT on total material (without VAT)
  const computedVat = totalMaterialNoVAT * 0.05;

  // use AED 7dp for detail/footer and header cells
  const writeAED7 = (sel, val) => {
    $detailRow.find(sel).text(fmtAED7(val));
  };

  // Footer money cells
  writeAED7(".total-vat", computedVat);
  writeAED7(".total-material-buy", totalMaterialBuy);
  writeAED7(".total-material-without-vat", totalMaterialNoVAT);
  writeAED7(".shipping-cost-value", shippingCost);
  writeAED7(".dgd-value", dgd);
  writeAED7(".labour-value", labour);

  // *** THE FIX: total shipping = shipping + dgd + labour ***
  $detailRow.find(".total-shipping-cost").text(fmtAED7(totalShipping));

  // Header paints
  $headerRow.find(".header-total-material").text(fmtAED7(totalMaterialBuy));
  $headerRow.find(".header-total-shipping").text(fmtAED7(totalShipping));

  // Defensive final paint so no legacy code overwrites it
  queueMicrotask(() => {
    $detailRow.find(".total-shipping-cost").text(fmtAED7(totalShipping));
    $headerRow.find(".header-total-shipping").text(fmtAED7(totalShipping));
  });

  // Notify rest of app / caches (one call is enough)
  if (typeof updateGtsTotalsFromDOM === 'function') updateGtsTotalsFromDOM();
  document.dispatchEvent(new CustomEvent('gts:totals-changed'));
}

function updateMaterialTotals(totalMaterial, totalShipping) {
  const material = Number(totalMaterial) || 0;
  const shipping = Number(totalShipping) || 0;
  const investment = Number(window.sheetTotals?.investment) || 0; // add cached inv

  window.sheetTotals.material = material;
  window.sheetTotals.shipping = shipping;

  // save for Summary cold-starts (now with inv too)
  setGtsTotalsToStorage({ material, shipping, investment });

  // native listeners
  document.dispatchEvent(new CustomEvent('gts:totals-changed', {
    detail: { material, shipping, investment }
  }));
}

function gtsTotalsKey() {
  return 'gtsTotals:' + String(window.activeCycleId ?? 'global');
}

function updateInvestmentTotals(investmentTotal) {
  const investment = Number(investmentTotal) || 0;
  window.sheetTotals.investment = investment;

  setGtsTotalsToStorage({
    material: Number(window.sheetTotals.material) || 0,
    shipping: Number(window.sheetTotals.shipping) || 0,
    investment
  });

  // optional native event (safe; Summary doesn’t consume it)
  document.dispatchEvent(new CustomEvent('gts:totals-changed', {
    detail: {
      material: Number(window.sheetTotals.material) || 0,
      shipping: Number(window.sheetTotals.shipping) || 0,
      investment
    }
  }));
}

function formatCurrency(value) {
  return fmtAED7(value);
}

function loadGtsMaterials() {
  const url = (typeof withCycle === 'function') ? withCycle('/gts-materials') : '/gts-materials';
  $.get(url, function (data) {
    if (!Array.isArray(data)) {
      console.error('Invalid response:', data);
      return;
    }

    // Clear any existing rows
    $("#materialTableBody").empty();

    data.reverse().forEach(function (entry, index) {
      const id = entry.id;
      const serialNo = index + 1;
      const num = (v) => Number(String(v ?? 0).replace(/[^0-9.\-]/g, '')) || 0;
      const attCount = [entry.invoice_path, entry.receipt_path, entry.note_path].filter(Boolean).length;

      const actionButtons = IS_CLOSED ? '' : `
        <div class="action-buttons flex justify-center gap-1 items-center">
          ${createMaterialIcon('upload-btn', 'bi-cloud-arrow-up-fill', 'Upload Attachments', 'bg-blue-500 hover:bg-blue-600 text-white', id)}
          ${createMaterialIcon('view-btn', 'bi-paperclip', 'View Attachments', 'bg-gray-800 hover:bg-gray-900 text-white', id, String(attCount))}
          ${createMaterialIcon('delete-material-btn', 'bi-trash-fill', 'Delete Row', 'bg-red-500 hover:bg-red-600 text-white', id)}
        </div>
      `;

      // compute exactly what the cards/summary use
      const headerMat = num(
        entry.ui_total_material ?? entry.total_material_buy ?? entry.total_material ?? 0
      );

      const headerShip = (() => {
        const tsc = num(entry.total_shipping_cost);
        if (tsc) return tsc; // prefer explicit total if present (even as string)
        // fallback: sum individual parts
        return num(entry.shipping_cost) + num(entry.dgd) + num(entry.labour);
      })();

      const COLS = IS_CLOSED ? 7 : 8;

      const isDraft = (entry.status ?? '') === 'draft';

      const isoDate = entry.invoice_date ? String(entry.invoice_date).slice(0, 10) : '';

      const headerFieldsHtml = isDraft && !IS_CLOSED
        ? `
        <td class="border p-2">
            <span class="mh-date-text block ${IS_CLOSED ? '' : 'cursor-pointer'}">
              ${formatLongDate(isoDate)}
            </span>
            <input type="date"
                  class="mh-invoice-date w-full bg-transparent outline-none hidden"
                  value="${isoDate}" ${IS_CLOSED ? 'disabled' : ''}>
        </td>
        <td class="border p-2">
          <input type="text" class="draft-invoice-no w-full bg-transparent outline-none"
                value="${escapeHtml(entry.invoice_no ?? '')}">
        </td>
        <td class="border p-2">
          <input type="text" class="draft-supplier-name w-full bg-transparent outline-none"
                value="${escapeHtml(entry.supplier_name ?? '')}">
        </td>
        <td class="border p-2">
          <input type="text" class="draft-brief-description w-full bg-transparent outline-none"
                value="${escapeHtml(entry.brief_description ?? '')}">
        </td>
      `
        : `
        <td class="border p-2">${formattedDate}</td>
        <td class="border p-2">${entry.invoice_no ?? '-'}</td>
        <td class="border p-2">${escapeHtml(entry.supplier_name ?? '')}</td>
        <td class="border p-2">${escapeHtml(entry.brief_description ?? '')}</td>
      `;

      // Create header row
      const $headerRow = $(`
        <tr class="header-row cursor-pointer hover:bg-gray-100" data-id="${id}" data-loaded="true">
          <td class="border p-2 text-center">${serialNo}</td>
          ${headerFieldsHtml}
          <td class="border p-2 header-total-material">${formatCurrency(headerMat)}</td>
          <td class="border p-2 header-total-shipping">${formatCurrency(headerShip)}</td>
          ${IS_CLOSED ? '' : `<td class="border p-2 text-center">
            <div class="flex flex-col items-center gap-1">
              ${actionButtons}
            </div>
          </td>`}
        </tr>
      `);

      const $detailRow = $(`
        <tr class="mat-detail-row detail-row relative hidden" data-id="${id}">
          <td colspan="${COLS}" class="p-2 bg-gray-50">
          <div class="text-center font-bold text-xl mb-4 bg-blue-200 p-2">${entry.supplier_name}</div>

            <div class="flex justify-center">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-16 w-full max-w-5xl mx-auto">
                <!-- Left Section -->
                <div class="space-y-2 border-4 border-zinc-500 p-5 bg-white">
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">Invoice No:</span> <div class="flex-1 text-gray-700">${entry.invoice_no ?? '-'}</div></div>
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">Total Weight (KG):</span> <div class="flex-1 text-gray-700 total-weight-kg">0</div></div>
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">Total No. of Units:</span> <div class="flex-1 text-gray-700 total-units">0</div></div>
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">DGD:</span> <div class="flex-1 text-gray-700 dgd-value">AED</div></div>
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">Labour Charges:</span> <div class="flex-1 text-gray-700 labour-value">AED</div></div>
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">Shipping Cost:</span> <div class="flex-1 text-gray-700 shipping-cost-value">0</div></div>
                </div>
                <!-- Right Section -->
                <div class="space-y-2 border-4 border-zinc-500 p-5 bg-white">
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">Mode of Transaction:</span> <input type="text" placeholder="Enter Transaction Method" class="flex-1 editable-input w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none" /></div>
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">Receipt No:</span> <textarea placeholder="Enter receipt numbers" class="gts-area receipt-no-textarea flex-1 dynamic-textarea w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none overflow-y-auto whitespace-pre-wrap break-words leading-snug text-[13px] md:text-[14px]"></textarea></div>
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">Remarks:</span> <textarea placeholder="Enter Remarks" class="gts-area dynamic-textarea flex-1 w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none resize-none overflow-hidden whitespace-pre-wrap break-words leading-snug text-[13px] md:text-[14px]"></textarea></div>
                </div>
              </div>
            </div>

            <!-- Item Table -->
            <div class="mt-4">
              <table class="min-w-full border-4 border-zinc-500 p-5 bg-white">
                <thead>
                  <tr>
                    <th class="border p-1 w-5">S.No</th>
                    <th class="border p-1 w-64">Description</th>
                    <th class="border p-1 w-24">No. of Units</th>
                    <th class="border p-1 w-40">Unit Material w/out VAT</th>
                    <th class="border p-1 w-20">VAT 5%</th>
                    <th class="border p-1 w-40">Total material buy</th>
                    <th class="border p-1 w-32">Weight / ctn</th>
                    <th class="border p-1 w-24">No. of CTNS</th>
                    <th class="border p-1 w-32">Total Weight</th>
                  </tr>
                </thead>
                <tbody class="item-table-body">
                  <!-- Rows added here -->
                </tbody>
              </table>

              <button type="button" class="add-item-row-btn mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">+ Add More Items</button>
            </div>

            <!-- Summary Footer -->
            <div class="mt-4 border-4 border-zinc-700 bg-white">
              <div class="grid grid-cols-2 divide-x divide-gray-300">

                <!-- Total Material Without VAT -->
                <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">Total Material w/out VAT:</div>
                <div class="flex items-center border-b border-gray-300 p-2 w-full bg-yellow-100 total-material-without-vat">AED 0</div>

                <!-- Total VAT -->
                <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">Total VAT:</div>
                <div class="flex items-center border-b border-gray-300 p-2 w-full bg-yellow-100 total-vat">AED 0</div>

                <!-- Total Material Buy -->
                <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">Total Material Buy:</div>
                <div class="flex items-center border-b border-gray-300 p-2 w-full bg-yellow-100 total-material-buy">AED 0</div>

                <!-- Shipping Cost -->
                <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">Shipping Cost:</div>
                <div class="flex items-center gap-1 border-b border-gray-300 p-2 w-full bg-yellow-100">
                  <span class="font-medium">AED</span>
                  <input
                    type="number"
                    value="0"
                    min="0"
                    step="0.0000001"
                    inputmode="decimal"
                    data-field="shippingCost"
                    class="shipping-input w-full bg-yellow-100 border-0 focus:outline-none"
                  />
                </div>

                <!-- DGD -->
                <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">DGD:</div>
                <div class="flex items-center gap-1 border-b border-gray-300 p-2 w-full bg-yellow-100">
                  <span class="font-medium">AED</span>
                  <input
                    type="number"
                    value="0"
                    min="0"
                    step="0.0000001"
                    inputmode="decimal"
                    data-field="dgd"
                    class="shipping-input flex-1 bg-yellow-100 border-0 focus:outline-none"
                  />
                </div>

                <!-- Labour -->
                <div class="flex items-center border-b border-gray-300 p-2 font-semibold w-full">Labour:</div>
                <div class="flex items-center gap-1 border-b border-gray-300 p-2 w-full bg-yellow-100">
                  <span class="font-medium">AED</span>
                  <input
                    type="number"
                    value="0"
                    min="0"
                    step="0.0000001"
                    inputmode="decimal"
                    data-field="labour"
                    class="shipping-input flex-1 bg-yellow-100 border-0 focus:outline-none"
                  />
                </div>

                <!-- Total Shipping Cost -->
                <div class="flex items-center p-2 font-semibold w-full">Total Shipping Cost:</div>
                <div class="flex items-center p-2 w-full bg-yellow-100 total-shipping-cost">
                  AED 0
                </div>
              </div>
            </div>
          </td>
        </tr>
      `);

      $detailRow.addClass("submitted").attr("data-loaded", "true");

      $("#materialTableBody").append($headerRow).append($detailRow);

      // Only make item table inputs minimal; keep borders for Receipt/Remarks
      $detailRow.find(".item-table-body input").each(function () {
        $(this).css({
          "border": "none",
          "background": "transparent",
          "outline": "none",
          "box-shadow": "none"
        });
      });

      // Also apply to item table inputs (excluding summary footer)
      $detailRow.find("tr.item-row input").each(function () {
        $(this).css({
          "border": "none",
          "background": "transparent",
          "outline": "none",
          "box-shadow": "none"
        });
      });

      // Update summary fields inside detail row
      $detailRow.find('.total-weight-kg').text(entry.total_weight || 0);
      $detailRow.find('.total-vat').text(formatCurrency(entry.total_vat ?? 0));
      $detailRow.find('.total-material-buy').text(formatCurrency(entry.total_material_buy));
      $detailRow.find('.dgd-value').text(formatCurrency(entry.dgd));
      $detailRow.find('.labour-value').text(formatCurrency(entry.labour));
      $detailRow.find('.shipping-cost-value').text(formatCurrency(entry.shipping_cost));

      // Update input values in editable section
      $detailRow.find('input[data-field="shippingCost"]').val(entry.shipping_cost || 0);
      $detailRow.find('input[data-field="dgd"]').val(entry.dgd || 0);
      $detailRow.find('input[data-field="labour"]').val(entry.labour || 0);
      $detailRow.find('input[placeholder="Enter Transaction Method"]').val(entry.mode_of_transaction || "");

      const $receiptTextarea = $detailRow.find('textarea.receipt-no-textarea');
      if ($receiptTextarea.length) {
        const normalizedReceipt = (entry.receipt_no || '').replace(/<br\s*\/?>/gi, '\n');
        $receiptTextarea.val(normalizedReceipt);
        window._autoSizeTA?.($receiptTextarea[0]);
      }

      // Remarks
      const $remarksTextarea = $detailRow.find('textarea[placeholder="Enter Remarks"]');
      $remarksTextarea.val(entry.remarks || "");
      window._autoSizeTA?.($remarksTextarea[0]);

      // Layout pass AFTER values are in
      _compactReceiptResize($detailRow);
      // one more after paint to be safe
      queueMicrotask(() => _compactReceiptResize($detailRow));

      // Now render item rows
      const $itemTableBody = $detailRow.find('.item-table-body');

      if (entry.items && Array.isArray(entry.items)) {
        entry.items.forEach((item, idx) => {
          const $row = $($('#itemRowTemplate').html());

          $row.attr('data-item-id', item.id);

          $row.find('td').eq(0).text(idx + 1); // S.No
          $row.find('[data-field="description"]').val(item.description || '');
          $row.find('[data-field="units"]').val(item.units || 0);
          $row.find('[data-field="unitPrice"]').val(item.unit_price || 0);
          $row.find('[data-field="vat"]').val(item.vat || 0);
          $row.find('[data-field="weightPerCtn"]').val(item.weight_per_ctn || 0);
          $row.find('[data-field="ctns"]').val(item.ctns || 0);

          // Calculated
          const totalMaterial = (item.unit_price || 0) * (item.units || 0);
          const totalWeight = (item.weight_per_ctn || 0) * (item.ctns || 0);
          $row.find('.total-material').text(fmtNum7(totalMaterial));
          $row.find('.total-weight').text(fmtNum7(totalWeight));

          $itemTableBody.append($row);
        });
      }

      // snapshot AFTER the row is fully rendered
      $detailRow.data('snapshot', buildMaterialSnapshot($detailRow));
      toggleUpdateButtonForDetail($detailRow);
    });

    $(".mat-detail-row, .detail-row").each(function () {
      const $detailRow = $(this);
      const $headerRow = $detailRow.prev(".header-row");
      calculateRowTotals($detailRow, $headerRow);
    });

    paintCardsFromDOM('dom');

    fetchAndUpdateInvestmentTotal();
  });
}

// Collect numbers from the row DOM. Do NOT paint cards from here.
// We only compute + cache, and return the sums.
function updateGtsTotalsFromDOM() {
  const num = (v) => Number(String(v ?? 0).replace(/[^0-9.\-]/g, '')) || 0;
  let totalMaterial = 0;
  let totalShipping = 0;

  $('.header-total-material').each(function () {
    totalMaterial += num($(this).text());
  });
  $('.header-total-shipping').each(function () {
    totalShipping += num($(this).text());
  });

  // OPTIONAL: cache for cold starts on other tabs; DO NOT PAINT here.
  if (typeof window.setGtsTotalsToStorage === 'function') {
    window.setGtsTotalsToStorage({
      material: totalMaterial,
      shipping: totalShipping,
      investment: Number(window.sheetTotals?.investment) || 0,
    });
  }

  return { material: totalMaterial, shipping: totalShipping };
}

// Materials-only icon button factory (does not collide with Investment's createIconButton)
function createMaterialIcon(type, iconClass, tooltipText, btnClass = '', dataId = '', badgeText = '') {
  const icon = String(iconClass || '').trim();
  const finalIcon = icon.startsWith('bi ') ? icon : `bi ${icon}`;

  const badgeHtml = badgeText !== '' ? `
    <span class="mat-att-dot absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
      rounded-full bg-red-600 text-white text-[11px] font-bold
      flex items-center justify-center leading-none">
      ${badgeText}
    </span>` : '';

  return `
    <div class="relative group inline-block">
      <button class="${type} ${btnClass} h-8 w-8 p-0 rounded text-sm flex items-center justify-center relative"
              data-id="${dataId}" type="button">
        <i class="${finalIcon}" style="font-size:16px;line-height:1"></i>
        ${badgeHtml}
      </button>

      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1
                  scale-0 group-hover:scale-100 transition duration-200
                  bg-black text-white text-xs px-2 py-1 rounded pointer-events-none z-10 whitespace-nowrap">
        ${tooltipText}
      </div>
    </div>
  `;
}

// function setMaterialRowDirty($detailRow, dirty) {}

// Build a snapshot of a detail row for change detection (includes header + detail)
function buildMaterialSnapshot($detailRow) {
  const t = v => (v == null ? '' : String(v).trim());
  const normTextArea = v => t((v || '').replace(/\r/g, '')); // keep your \r fix

  const $headerRow = $detailRow.prev('.header-row');

  const header = {
    invoice_date: t($headerRow.find('.draft-invoice-date').val()),
    invoice_no: t($headerRow.find('.draft-invoice-no').val()),
    supplier_name: t($headerRow.find('.draft-supplier-name').val()),
    brief_description: t($headerRow.find('.draft-brief-description').val()),
  };

  const snap = {
    header,
    mot: t($detailRow.find('input[placeholder="Enter Transaction Method"]').val()),
    receipt: normTextArea(
      $detailRow
        .find('textarea.receipt-no-textarea, textarea[placeholder="Enter receipt numbers"]')
        .val()
    ),
    remarks: normTextArea($detailRow.find('textarea[placeholder="Enter Remarks"]').val()),
    shipping: t($detailRow.find('input[data-field="shippingCost"], [data-field="shippingCost"]').val()),
    dgd: t($detailRow.find('input[data-field="dgd"], [data-field="dgd"]').val()),
    labour: t($detailRow.find('input[data-field="labour"], [data-field="labour"]').val()),
    items: []
  };

  $detailRow.find('tr.item-row').each(function () {
    const $r = $(this);
    snap.items.push({
      id: $r.attr('data-item-id') || null,
      desc: t($r.find('[data-field="description"]').val()),
      units: t($r.find('[data-field="units"]').val()),
      unit: t($r.find('[data-field="unitPrice"]').val()),
      vat: t($r.find('[data-field="vat"]').val()),
      wctn: t($r.find('[data-field="weightPerCtn"]').val()),
      ctns: t($r.find('[data-field="ctns"]').val())
    });
  });

  return snap;
}

// Compare current vs snapshot (numeric-safe)
function isDetailChanged($detailRow) {
  const snap = $detailRow.data('snapshot');
  if (!snap) return false;
  const cur = buildMaterialSnapshot($detailRow);
  return JSON.stringify(snap) !== JSON.stringify(cur);
}

// Ensure the icon exists once in Action cell when changed; remove when not
function toggleUpdateButtonForDetail($detailRow) {
  const $headerRow = $detailRow.prev('.header-row');
  const $actionCell = $headerRow.find('td:last');

  // we only show update for submitted/loaded rows
  const isSaved = $detailRow.hasClass('submitted') || $detailRow.attr('data-loaded') === 'true';
  const changed = isSaved && isDetailChanged($detailRow);

  // make sure there is a single action container
  let $wrap = $actionCell.find('.action-buttons');
  if (!$wrap.length) {
    $wrap = $('<div class="action-buttons flex justify-center gap-1"></div>');
    // move any existing action buttons into this wrapper once
    $wrap.append($actionCell.children().detach());
    $actionCell.empty().append($wrap);
  }

  // DEDUPE: if duplicated icons exist, keep only the first
  $wrap.find('.update-row-btn').slice(1).remove();

  if (changed) {
    if (!$wrap.find('.update-row-btn').length) {
      // add exactly once
      $wrap.prepend(
        createMaterialIcon('update-row-btn', 'bi-arrow-repeat', 'Update Row',
          'bg-green-600 hover:bg-green-700 text-white', $headerRow.data('id') || '')
      );
    }
  } else {
    $wrap.find('.update-row-btn').remove(); // remove if no longer dirty
  }
}

function paintCardsFromDOM(origin) {
  const sums = updateGtsTotalsFromDOM(); // { material, shipping }
  if (typeof window.updateTotals === 'function') {
    window.updateTotals(
      {
        material: sums.material,
        shipping: sums.shipping,
        investment: Number(window.sheetTotals?.investment) || 0
      },
      {
        origin: origin || 'dom',
        force: true,              // bypass origin/reqId priority
        allowAfterLock: true      // bypass __materialsLocked
      }
    );
  }
  document.dispatchEvent(new CustomEvent('gts:totals-changed'));
}

// Show up to 7 decimals, trim trailing zeros
function fmtNum7(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 7 });
}

// AED with up to 7 dp (detail/footer/header cells). KPIs can keep 2dp elsewhere.
function fmtAED7(n) {
  const v = Number(n) || 0;
  return 'AED ' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 7 });
}

function initInvestmentLogic() {
  $.ajaxSetup({
    headers: {
      'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
    }
  });

  if (window.investmentLogicInitialized) return;
  window.investmentLogicInitialized = true;

  $("#addInvestmentRowBtn").on("click", function () {
    // Reset the modal fields
    $("#modalInvestmentDate").val("");
    $("#modalInvestmentInvestor").val("");

    // Show the modal
    $("#investmentRowModal").removeClass("hidden").addClass("flex");
  });

  $("#investmentForm").on("submit", function (e) {
    e.preventDefault(); // stop actual form submit

    const investmentDate = $("#modalInvestmentDate").val().trim();
    const investor = $("#modalInvestmentInvestor").val().trim();

    if (!investmentDate || !investor) {
      alert("Please fill in both Date and Investor.");
      return;
    }

    // Use createInvestmentLayout like this:
    createInvestmentLayout(Date.now(), investmentDate, investor);

    // Hide the modal
    $("#investmentRowModal").addClass("hidden").removeClass("flex");

    // Optional: Reset form
    this.reset();
  });

  $("#investmentCancelBtn").on("click", function () {
    $("#investmentRowModal").addClass("hidden").removeClass("flex");
  });

  $(document).on("click", ".investment-header", function (e) {
    if ($(e.target).is("button") || $(e.target).closest("button").length || $(e.target).is("a")) return;
    $(this).next(".investment-detail-row").toggleClass("hidden");
  });

  // one bind, namespaced
  $(document)
    .off('input.invAmt')
    .on('input.invAmt', '.investment-amount', function () {
      const $input = $(this);
      const raw = String($input.val() || '').replace(/,/g, '');
      const n = parseFloat(raw);

      const $detailTr = $input.closest('tr');                // investment-detail-row
      const $headerRow = $detailTr.prev('.investment-header');

      const display = isNaN(n) ? fmtAED7(0) : fmtAED7(n);
      $input.data('numericValue', isNaN(n) ? 0 : n);

      // Prefer the span, fallback to td (0-based index 3)
      const $span = $headerRow.find('.investment-amount-display');
      if ($span.length) {
        $span.text(display);
      } else {
        $headerRow.find('td').eq(3).text(display);
      }

      // lighter: debounce the server hit while typing
      debounceFetchInvTotal();
    });

  // simple debounce helper (300ms)
  let _invFetchTO = null;
  function debounceFetchInvTotal(ms = 300) {
    clearTimeout(_invFetchTO);
    _invFetchTO = setTimeout(() => {
      if (typeof fetchAndUpdateInvestmentTotal === 'function') {
        fetchAndUpdateInvestmentTotal();
      }
    }, ms);
  }

  // It show murabahaInput at top if it have any value
  $(document).on("input", "#murabahaInput", function () {
    const value = $(this).val().trim();
    if (value !== "") {
      $("#murabahaAmount").text(value);
      $("#murabahaTotalLine").removeClass("hidden");
    } else {
      $("#murabahaAmount").text("");
      $("#murabahaTotalLine").addClass("hidden");
    }
  });

  $(document).on("click", ".submit-investment-btn", function (e) {
    e.preventDefault();
    if (!ensureOpenOrToast()) return;

    const $headerRow = $(this).closest("tr");
    const $detailRow = $headerRow.next(".investment-detail-row");
    const investmentId = $detailRow.data("id");
    const $form = $detailRow.find(`#investmentDetailsForm-${investmentId}`);


    if ($form.length === 0) {
      alert("Form not found!");
      return;
    }

    // Get values from form fields
    const investmentDate = $form.find(".investment-date").val();
    const investor = $form.find(".investment-investor").val()?.trim() || "";
    const investmentAmount = parseFloat($form.find(".investment-amount").val()) || 0;
    const investmentNo = $form.find(".investment-no").val()?.trim() || "";
    const modeOfTransaction = $form.find(".mode-of-transaction").val();
    const murabaha = $form.find(".murabaha-input").val()?.trim() || "";
    const repaymentTerms = $form.find(".repayment-terms").val();
    const loanTenure = $form.find(".loan-tenure").val();
    const repaymentDate = $form.find(".repayment-date").val();
    const remarks = $form.find(".remarks").val()?.trim() || "";
    const paymentMethod = $form.find(".payment-method").val() || "";

    const $submitBtn = $headerRow.find(".submit-investment-btn");

    $.ajax({
      url: withCycle("/investments"),
      method: "POST",
      data: {
        date: investmentDate,
        investor: investor,
        investment_amount: investmentAmount,
        investment_no: investmentNo,
        mode_of_transaction: modeOfTransaction,
        murabaha: murabaha,
        repayment_terms: repaymentTerms,
        loan_tenure: loanTenure,
        repayment_date: repaymentDate,
        remarks: remarks,
        payment_method: paymentMethod,
      },
      headers: {
        "X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr("content")
      },
      success: function (res) {
        $form.find("input, select, textarea").prop("disabled", true);

        // Update header row's data-id to the actual DB ID
        $headerRow.attr("data-id", res.id);
        $detailRow.attr("data-id", res.id);

        // Get actual header row again from DOM
        const $updatedHeaderRow = $(`.investment-header[data-id="${res.id}"]`);
        const amount = parseFloat($detailRow.find(".investment-amount-input").val()) || 0;
        const formatted = `AED ${amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`;

        const methodText = paymentMethod || '—';
        $updatedHeaderRow.find(".payment-method-display").text(methodText);

        // Set value into header row
        $updatedHeaderRow.find(".investment-amount-display").text(formatted);

        // Remove Submit button
        $updatedHeaderRow.find(".submit-investment-btn").remove();

        // Scroll to this row
        $("html, body").animate({
          scrollTop: $headerRow.offset().top - 100
        }, 400);

        fetchAndUpdateInvestmentTotal();
        alert("Saved!");

        location.reload();
      },
      error: function (xhr) {
        $submitBtn.prop("disabled", false);
        alert("Error saving.");
        console.error(xhr.responseText);
      }
    });
  });

  $(document).on("click", ".delete-investment-btn", function () {
    const $headerRow = $(this).closest("tr");
    const investmentId = $headerRow.data("id");

    if (!confirm("Are you sure you want to delete this investment?")) return;
    if (!ensureOpenOrToast()) return;

    $.ajax({
      url: withCycle(`/investments/${investmentId}`),
      method: "DELETE",
      headers: {
        "X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr("content")
      },
      success: function () {
        $headerRow.next(".investment-detail-row").remove();
        $headerRow.remove();
        updateInvestmentSerialNumbers();
        fetchAndUpdateInvestmentTotal();
        alert("Investment deleted successfully.");
      },
      error: function () {
        alert("Failed to delete investment.");
      }
    });
  });

  $(document).on("input change", ".investment-detail-row input, .investment-detail-row select, .investment-detail-row textarea", function () {
    const $form = $(this).closest("form");
    const currentSnapshot = {};
    const savedSnapshot = $form.data("snapshot");

    if (!savedSnapshot) return;

    $form.find("input, select, textarea").each(function () {
      const name = $(this).attr("name") || $(this).attr("class");
      let val = $(this).val();
      if ($(this).is("input[type='number']")) val = parseFloat(val) || 0;
      currentSnapshot[name] = val?.toString().trim() || "";
    });

    const hasChanged = JSON.stringify(currentSnapshot) !== JSON.stringify(savedSnapshot);

    if (hasChanged) {
      $form.find(".invest-save-changes-btn").removeClass("hidden");
    } else {
      $form.find(".invest-save-changes-btn").addClass("hidden");
    }
  });

  $(document).on("click", ".invest-save-changes-btn", function () {
    if (!ensureOpenOrToast()) return;

    if (!$(this).closest('#sheet-gts-investment').length) return;
    const $form = $(this).closest("form");
    const $detailRow = $form.closest("tr.investment-detail-row");
    const $headerRow = $detailRow.prev(".investment-header");
    const investmentId = $detailRow.data("id");

    if (!investmentId) {
      alert("Missing ID");
      return;
    }

    const updatedData = {
      date: $form.find(".investment-date").val(),
      investor: $form.find(".investment-investor").val(),
      investment_amount: parseFloat($form.find(".investment-amount").val()) || 0,
      investment_no: $form.find(".investment-no").val(),
      mode_of_transaction: $form.find(".mode-of-transaction").val(),
      murabaha: $form.find(".murabaha-input").val(),
      repayment_terms: $form.find(".repayment-terms").val(),
      loan_tenure: $form.find(".loan-tenure").val(),
      repayment_date: $form.find(".repayment-date").val(),
      remarks: $form.find(".remarks").val(),
      payment_method: $form.find(".payment-method").val() || "",
    };

    $.ajax({
      url: withCycle(`/investments/${investmentId}`),
      method: "PUT",
      data: updatedData,
      success: function () {
        // Update header values
        $headerRow.find("td:nth-child(3)").text(updatedData.investor);
        $headerRow.find("td:nth-child(4)").text(
          `AED ${updatedData.investment_amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}`
        );
        $headerRow.find("td:nth-child(5) .payment-method-display").text(updatedData.payment_method || '—');

        // Update stored original data
        $form.data("original", { ...updatedData });

        // Hide save button again
        $form.find(".invest-save-changes-btn").addClass("hidden");

        fetchAndUpdateInvestmentTotal();

        alert("Changes saved!");
      },
      error: function () {
        alert("Failed to save changes.");
      }
    });
  });

  // ANY edit inside an investment detail row => toggle action Update icon
  $(document).on('input change', '.investment-detail-row input, .investment-detail-row select, .investment-detail-row textarea', function () {
    const $detailRow = $(this).closest('.investment-detail-row');
    toggleUpdateButtonForInvestment($detailRow);
  });

  console.log("Count:", $(".investment-amount-display").length);
  $(".investment-amount-display").each(function () {
    console.log("Text:", $(this).text());
  });

  // Show upload modal
  $(document).on("click", ".investment-attachment-btn", function () {
    const investmentId = $(this).data("id");

    // Set ID in modal
    $("#uploadAttachmentModal").data("investment-id", investmentId);

    // Clear file inputs and filenames
    $("#invoice, #receipt, #note").val('');
    $("#invoiceFileName, #receiptFileName, #noteFileName").val('');

    // Load existing file names
    $.get(withCycle(`/investment/${investmentId}/attachments`), function (res) {
      if (res.invoice) {
        $("#invoiceFileName").val(res.invoice.split('/').pop());
      }
      if (res.receipt) {
        $("#receiptFileName").val(res.receipt.split('/').pop());
      }
      if (res.note) {
        $("#noteFileName").val(res.note.split('/').pop());
      }
    });

    // Show modal
    $("#uploadAttachmentModal").removeClass("hidden").addClass("flex").hide().fadeIn();
  });

  // Hide modal
  $('#closeAttachmentModal, #cancelAttachmentUpload').on('click', function () {
    $('#uploadAttachmentModal').fadeOut().css('display', 'none');;
  });

  $("#attachmentUploadForm").on("submit", function (e) {
    e.preventDefault();
    if (!ensureOpenOrToast()) return;

    const investmentId = $("#uploadAttachmentModal").data("investment-id"); // this must NOT be undefined

    if (!investmentId) {
      alert("Missing investment ID.");
      return;
    }

    const formData = new FormData(this);
    formData.append("_token", $('meta[name="csrf-token"]').attr("content"));

    $.ajax({
      url: withCycle(`/investment/${investmentId}/upload-attachments`),
      method: "POST",
      data: formData,
      processData: false,
      contentType: false,
      success: function () {
        $("#uploadAttachmentModal").fadeOut();
      },
      error: function () {
        alert("Failed to upload attachments");
      }
    });
  });

  $(document).on("click", ".btn-view-attachment", function () {
    const row = $(this).closest('tr');
    const id = row.data('id');
    const investor = row.find('td:nth-child(3)').text().trim();

    // Set modal title
    $('#invAttachmentViewerTitle').text(`ID: ${id} – ${investor}`);

    // Reset links and names
    const $inv = $("#iviewInvoiceLink");
    const $rec = $("#iviewReceiptLink");
    const $note = $("#iviewNoteLink");

    const $invName = $("#iviewInvoiceName");
    const $recName = $("#iviewReceiptName");
    const $noteName = $("#iviewNoteName");

    [$inv, $rec, $note].forEach($a => {
      $a.attr("href", "#")
        .removeClass("text-blue-600")
        .addClass("text-gray-400")
        .text("Not Uploaded");
    });

    [$invName, $recName, $noteName].forEach($s => $s.text(""));

    // Disable download button initially
    $('#invDownloadBtn')
      .addClass('pointer-events-none opacity-50')
      .text('Download PDF');

    // Fetch and apply attachment URLs
    $.ajax({
      url: withCycle(`/investment/${id}/attachments`),
      type: 'GET',
      success: function (data) {

        if (data.invoice) {
          const invName = data.invoice.split('/').pop();
          $inv.attr("href", data.invoice)
            .removeClass("text-gray-400")
            .addClass("text-blue-600")
            .text("Open");
          $invName.text(invName);
        }

        if (data.receipt) {
          const recName = data.receipt.split('/').pop();
          $rec.attr("href", data.receipt)
            .removeClass("text-gray-400")
            .addClass("text-blue-600")
            .text("Open");
          $recName.text(recName);
        }

        if (data.note) {
          const noteName = data.note.split('/').pop();
          $note.attr("href", data.note)
            .removeClass("text-gray-400")
            .addClass("text-blue-600")
            .text("Open");
          $noteName.text(noteName);
        }

        if (data.invoice || data.receipt || data.note) {
          $('#invDownloadBtn')
            .removeClass('pointer-events-none opacity-50')
            .text('Download PDF');
        }

        $('#investmentAttachmentModal')
          .data('current-id', id)
          .removeClass('hidden')
          .addClass('flex')
          .fadeIn();
      },
      error: function () {
        alert('Failed to load attachments.');
      }
    });
  });

  // Investments
  $(document).on('click', '#invDownloadBtn', function () {
    const id = $('#investmentAttachmentModal').data('current-id');
    if (id) window.open(withCycle(`/investment/${id}/attachments/download`), '_blank');
  });

  $('#closeInvestmentViewModal, #closeInvestmentViewModalBottom').on('click', function () {
    $("#investmentAttachmentModal").fadeOut(200, function () {
      $(this).addClass("hidden").css("display", "none");
    });
  });

  let currentMurabahaRowId = null;

  $(document).on('change', '.murabaha-radio', function () {
    const value = $(this).val();
    const row = $(this).closest('tr');
    currentMurabahaRowId = row.data('id');

    if (value === 'yes') {
      // Get existing date from hidden input
      const existingDate = row.find('.murabaha-date-hidden').val();

      // Set investment ID in modal for saving
      $('#murabahaDateModal').data('investment-id', currentMurabahaRowId);

      // Pre-fill date input if exists
      $('#murabahaDateInput').val(existingDate || '');

      // Show modal
      $('#murabahaDateModal').css('display', 'flex').hide().fadeIn();

    } else {
      // "No" selected — clear hidden date
      row.find('.murabaha-date-hidden').val('');
      row.find('.murabaha-date-display').text(''); // Clear from view
    }
  });

  $('#cancelMurabahaDate').on('click', function () {
    $('#murabahaDateModal').fadeOut();

    // Reset radio to "No"
    if (currentMurabahaRowId) {
      $(`tr[data-id="${currentMurabahaRowId}"] input[type=radio][value=no]`).prop('checked', true);
    }
  });

  $("#saveMurabahaDateBtn").on("click", function () {
    if (!ensureOpenOrToast()) return;

    const selectedDate = $("#murabahaDateInput").val();
    const investmentId = $("#murabahaDateModal").data("investment-id"); // match modal ID

    if (!selectedDate) {
      alert("Please select a date.");
      return;
    }

    $.ajax({
      url: withCycle(`/investment/${investmentId}/murabaha`),
      method: 'POST',
      data: {
        murabaha_status: "yes",
        murabaha_date: selectedDate,
        _token: $('meta[name="csrf-token"]').attr("content")
      },
      success: function (res) {
        $("#murabahaDateModal").fadeOut();
        // Update display and hidden value
        $(`.murabaha-date-display[data-id="${investmentId}"]`).text(selectedDate);
        $(`tr[data-id="${investmentId}"]`).find('.murabaha-date-hidden').val(selectedDate);
      },
      error: function () {
        alert("Failed to save Murabaha date.");
      }
    });
  });

  // submit updates from the green icon in Action column
  $(document)
    .off('click.investUpdate')
    .on('click.investUpdate', '.update-invest-btn', function () {
      if (!ensureOpenOrToast()) return;

      const $headerRow = $(this).closest('tr.investment-header');
      const $detailRow = $headerRow.next('.investment-detail-row');
      const id = $headerRow.data('id');
      if (!id) return;

      const $f = $detailRow.find('form');

      const payload = {
        date: $f.find('.investment-date').val(),
        investor: $f.find('.investment-investor').val(),
        investment_amount: parseFloat($f.find('.investment-amount').val()) || 0,
        investment_no: $f.find('.investment-no').val(),
        mode_of_transaction: $f.find('.mode-of-transaction').val(),
        murabaha: $f.find('.murabaha-input').val(),
        repayment_terms: $f.find('.repayment-terms').val(),
        loan_tenure: parseInt($f.find('.loan-tenure').val()) || 0,
        repayment_date: $f.find('.repayment-date').val(),
        remarks: $f.find('.remarks').val(),
        payment_method: $f.find('.payment-method').val() || '',
        murabaha_status: $detailRow.find('input.murabaha-radio:checked').val() || 'no',
        murabaha_date: $detailRow.find('.murabaha-date-hidden').val() || ''
      };

      $.ajax({
        url: withCycle(`/investments/${id}`),
        method: 'PUT',
        headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
        data: payload
      })
        .done(function () {
          // header refresh
          $headerRow.find('.investment-amount-display').text(fmtAED7(payload.investment_amount || 0));
          $headerRow.find('.payment-method-display').text(payload.payment_method || '—');

          // reset baseline + remove icon
          $detailRow.data('snapshot', buildInvestmentSnapshot($detailRow));
          toggleUpdateButtonForInvestment($detailRow);

          fetchAndUpdateInvestmentTotal();
          const $cell = $headerRow.find('td:last').addClass('bg-green-50');
          setTimeout(() => $cell.removeClass('bg-green-50'), 600);
        })
        .fail(function (xhr) {
          alert(xhr?.responseJSON?.message || 'Update failed.');
          console.error(xhr?.responseText || xhr);
        });
    });

  $(document)
    .off('input.investDirty change.investDirty')
    .on('input.investDirty change.investDirty', '#investmentTableBody .investment-detail-row :input', function () {
      toggleUpdateButtonForInvestment($(this).closest('.investment-detail-row'));
    });

}

function renderPreview(previewSelector, fileUrl) {
  const preview = $(previewSelector);
  preview.empty();

  if (!fileUrl) {
    preview.text("Not uploaded");
    return;
  }

  const lowerUrl = fileUrl.toLowerCase();
  if (lowerUrl.endsWith('.pdf')) {
    preview.html(`<iframe src="${fileUrl}" class="w-full h-[400px] border rounded"></iframe>`);
  } else if (/\.(jpg|jpeg|png|webp)$/i.test(lowerUrl)) {
    preview.html(`<img src="${fileUrl}" class="max-w-full max-h-[400px] rounded border" alt="Attachment Preview" />`);
  } else {
    preview.html(`<a href="${fileUrl}" target="_blank" class="text-blue-600 underline">Open file</a>`);
  }
}

function getFileName(url) {
  if (!url) return '';
  try {
    const clean = url.split('?')[0];                 // strip query
    return decodeURIComponent(clean.split('/').pop());
  } catch { return url; }
}

function isClosed() {
  return !!window.__SET_IS_CLOSED ||
    (window.cycle && window.cycle.status === 'closed') ||
    document.documentElement.classList.contains('is-cycle-closed');
}

function createInvestmentLayout(
  investmentId = Date.now(),
  investmentDate,
  investor,
  investmentAmount = 0,
  investmentNo = "",
  modeOfTransaction = "",
  murabaha = "",
  repaymentTerms = "",
  loanTenure = "",
  repaymentDate = "",
  remarks = "",
  status = "draft",
  murabahaStatus = 'no',
  murabahaDate = '',
  paymentMethod = ''
) {
  // Calculate serial number
  const serialNo = $("#investmentTableBody tr.investment-header").length + 1;

  // Format with commas
  const formattedAmount = fmtAED7(investmentAmount || 0);

  const dateObj = new Date(investmentDate);
  const formattedDate = isNaN(dateObj)
    ? "Invalid Date"
    : dateObj.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const showActions = !isClosed();

  const actionButtons = showActions ? `
    <div class="action-buttons flex items-center justify-center gap-1">
      ${status === "draft" ? `
        <button type="button" class="submit-investment-btn px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
          Submit
        </button>` : ''}

      ${createInvestmentIconButton('investment-attachment-btn', 'bi-cloud-arrow-up-fill', 'Upload Attachments', 'bg-blue-500 hover:bg-blue-600 text-white', investmentId)}
      ${createInvestmentIconButton('btn-view-attachment', 'bi-paperclip', 'View Attachments', 'bg-gray-700 hover:bg-gray-800 text-white', investmentId)}
      ${createInvestmentIconButton('delete-investment-btn', 'bi-trash-fill', 'Delete Row', 'bg-red-500 hover:bg-red-600 text-white', investmentId)}
    </div>
  ` : '';

  const safeId = String(investmentId).replace(/[^a-zA-Z0-9_-]/g, '');

  const safePayment = paymentMethod || '—';

  const $headerRow = $(`
      <tr class="investment-header cursor-pointer hover:bg-gray-100" data-id="${investmentId}">
        <td class="border p-2 text-center">${serialNo}</td>
        <td class="border p-2">${formattedDate}</td>
        <td class="border p-2">${investor}</td>
        <td class="border p-2">
          <span class="investment-amount-display">${formattedAmount}</span>
        </td>
        <td class="border p-2"><span class="payment-method-display">${escapeHtml(safePayment)}</span></td>
        ${showActions ? `<td class="border p-2 text-center action-col" data-col="action">${actionButtons}</td>` : ``}
      </tr>
    `);

  const $detailRow = $(`
    <tr class="investment-detail-row relative hidden" data-id="${investmentId}">
      <td colspan="${showActions ? 6 : 5}" class="p-4 bg-white">
        <form id="investmentDetailsForm-${investmentId}" data-id="${investmentId}">
          <div class="mt-3 text-right">
            ${status !== "draft" ? `
              <button type="button"
                class="invest-save-changes-btn hidden px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                Save Changes
              </button>` : ""}
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium mb-1">Date</label>
              <input type="text" value="${escapeHtml(formattedDate)}" class="investment-date w-full bg-yellow-100 px-3 py-2 rounded" readonly />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Investor</label>
              <input type="text" value="${escapeHtml(investor)}" class="investment-investor w-full bg-yellow-100 px-3 py-2 rounded" readonly />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Investment Amount</label>
              <input type="number" step="any" inputmode="decimal" min="0" placeholder="e.g., 10000" value="${escapeHtml(investmentAmount)}" class="investment-amount w-full bg-yellow-100 px-3 py-2 rounded editable-field" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Investment No.</label>
              <input type="text" placeholder="e.g., GTS-..." value="${escapeHtml(investmentNo)}" class="investment-no w-full bg-yellow-100 px-3 py-2 rounded editable-field" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Mode of Transaction</label>
              <select class="mode-of-transaction w-full bg-blue-100 px-3 py-2 rounded editable-field">
                <option ${modeOfTransaction === "Bank Deposit" ? "selected" : ""}>Bank Deposit</option>
                <option ${modeOfTransaction === "Cash" ? "selected" : ""}>Cash</option>
                <option ${modeOfTransaction === "Cheque" ? "selected" : ""}>Cheque</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Murabaha (Profit Sharing)</label>
              <input type="text" value="${escapeHtml(murabaha)}" class="murabaha-input w-full bg-yellow-100 px-3 py-2 rounded editable-field" />
            </div>

            <div class="mt-2">
              <label class="block text-sm font-medium mb-1">Murabaha Applicable?</label>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2">
                  <input type="radio" name="murabaha_status_${safeId}" class="murabaha-radio" value="yes" ${murabahaStatus === 'yes' ? 'checked' : ''} />
                  <span>Yes</span>
                </label>
                <label class="flex items-center gap-2">
                  <input type="radio" name="murabaha_status_${safeId}" class="murabaha-radio" value="no" ${murabahaStatus === 'no' ? 'checked' : ''} />
                  <span>No</span>
                </label>

                <span class="murabaha-date-display text-sm text-blue-600 font-semibold" data-id="${investmentId}">
                  ${murabahaDate || ''}
                </span>
              </div>
            </div>
            <input type="hidden" name="murabaha_date_${investmentId}" class="murabaha-date-hidden" value="" />

            <div>
              <label class="block text-sm font-medium mb-1">Repayment Terms</label>
              <select class="repayment-terms w-full bg-blue-100 px-3 py-2 rounded editable-field">
                <option ${repaymentTerms === "Monthly" ? "selected" : ""}>Monthly</option>
                <option ${repaymentTerms === "Quarterly" ? "selected" : ""}>Quarterly</option>
                <option ${repaymentTerms === "Annually" ? "selected" : ""}>Annually</option>
                <option ${repaymentTerms === "Lump sum" ? "selected" : ""}>Lump sum</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Loan Tenure (Duration Months)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g., 12"
                value="${escapeHtml(loanTenure)}"
                class="loan-tenure w-full bg-yellow-100 px-3 py-2 rounded editable-field"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Repayment Date</label>
              <input type="date" value="${escapeHtml(repaymentDate)}" class="repayment-date w-full bg-yellow-100 px-3 py-2 rounded editable-field" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Payment Method</label>
              <select class="payment-method w-full bg-blue-100 px-3 py-2 rounded editable-field">
                <option value="" ${!paymentMethod ? 'selected' : ''}>Select…</option>
                <option value="Cash" ${paymentMethod === 'Cash' ? 'selected' : ''}>Cash</option>
                <option value="Bank transfer" ${paymentMethod === 'Bank transfer' ? 'selected' : ''}>Bank transfer</option>
                <option value="Other" ${paymentMethod === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Remarks</label>
              <textarea class="remarks w-full bg-yellow-100 px-3 py-2 rounded editable-field">${remarks}</textarea>
            </div>
          </div>

          <input type="hidden" name="investment_id" value="${escapeHtml(investmentId)}" />

        </form>
      </td>
    </tr>
  `);

  $("#investmentTableBody").append($headerRow).append($detailRow);

  $detailRow.data('snapshot', buildInvestmentSnapshot($detailRow));
  toggleUpdateButtonForInvestment($detailRow);

  const $form = $detailRow.find(`#investmentDetailsForm-${investmentId}`);

  // Define a clean function to sanitize input values
  function clean(val) {
    return val === "null" || val == null ? "" : val.toString().trim();
  }

  // Store original data using sanitized values
  const originalData = {
    investor: clean(investor),
    investment_amount: parseFloat(investmentAmount) || 0,
    investment_no: clean(investmentNo),
    mode_of_transaction: clean(modeOfTransaction),
    murabaha: clean(murabaha),
    repayment_terms: clean(repaymentTerms),
    loan_tenure: parseInt(loanTenure) || 0,
    repayment_date: repaymentDate?.split("T")[0] || "",
    remarks: clean(remarks),
    payment_method: clean(paymentMethod),
  };

  $form.data("original", originalData);

  $detailRow.find(".investment-amount").on("input", function () {
    const amount = parseFloat($(this).val()) || 0;
    const formatted = `AED ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const $header = $detailRow.prev(".investment-header");
    if ($header.length) {
      $header.find("td:nth-child(4)").html(`<span class="investment-amount-display">${formatted}</span>`);
    }

    fetchAndUpdateInvestmentTotal(); // your new method
  });


  $('html, body').animate({
    scrollTop: $headerRow.offset().top - 80
  }, 400);

  updateInvestmentSerialNumbers();
  fetchAndUpdateInvestmentTotal();
}

// Investment-only icon factory (doesn't clash with Materials)
function createInvestmentIconButton(btnClass, iconClass, tooltipText, bgClasses, id) {
  return `
    <div class="relative group inline-block investment-action-buttons">
      <button
        class="${btnClass} ${bgClasses} h-8 w-8 p-0 rounded text-sm flex items-center justify-center"
        data-id="${id}"
        type="button"
      >
        <i class="bi ${iconClass} text-[16px] leading-none"></i>
      </button>
      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1
                  scale-0 group-hover:scale-100 transition duration-200
                  bg-black text-white text-xs px-2 py-1 rounded pointer-events-none z-10 whitespace-nowrap">
        ${tooltipText}
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadGtsInvestments() {
  $.ajax({
    url: withCycle("/investments"),
    method: "GET",
    success: function (data) {
      $("#investmentTableBody").empty();

      data.forEach((item, index) => {
        createInvestmentLayout(
          item.id,
          item.date,
          item.investor,
          item.investment_amount,
          item.investment_no,
          item.mode_of_transaction,
          item.murabaha,
          item.repayment_terms,
          item.loan_tenure,
          item.repayment_date,
          item.remarks,
          item.status,
          item.murabaha_status,
          item.murabaha_date,
          item.payment_method
        );
      });

      updateInvestmentSerialNumbers();

      // Always refresh the card once rows are in the DOM
      fetchAndUpdateInvestmentTotal();
    },
    error: function () {
      alert("Failed to load investments");
    }
  });
}

function updateInvestmentSerialNumbers() {
  $("#investmentTableBody tr.investment-header").each(function (index) {
    $(this).find("td:first").text(index + 1);
  });
}

function fetchAndUpdateInvestmentTotal() {
  const url = (typeof withCycle === 'function')
    ? withCycle('/gts-investments/total')
    : '/gts-investments/total';

  return $.getJSON(url)
    .then(res => {
      const total = Number(res?.total ?? res?.investment ?? 0) || 0;

      // hand off to the single source of truth (gts-totals.js)
      if (typeof window.updateInvestmentTotals === 'function') {
        window.updateInvestmentTotals(total);   // paints + caches
      }
      return total;
    })
    .catch(err => {
      console.error('[investment] total fetch failed', err);
      if (typeof window.updateInvestmentTotals === 'function') {
        window.updateInvestmentTotals(0);       // safe fallback
      }
      return 0;
    });
}

// Build a snapshot of a detail row (for change detection)
function buildInvestmentSnapshot($detailRow) {
  const $f = $detailRow.find('form');
  const t = v => (v == null ? '' : String(v).trim());
  const n = v => (Number(String(v).replace(/[^\d.-]/g, '')) || 0);

  return {
    date: t($f.find('.investment-date').val()),
    investor: t($f.find('.investment-investor').val()),
    // NOTE: keep raw text so removing ".00" counts as a change
    amount_raw: t($f.find('.investment-amount').val()),
    inv_no: t($f.find('.investment-no').val()),
    mot: t($f.find('.mode-of-transaction').val()),
    murabaha: t($f.find('.murabaha-input').val()),
    repay_terms: t($f.find('.repayment-terms').val()),
    tenure: t($f.find('.loan-tenure').val()), // keep as text for strict diff
    repay_date: t($f.find('.repayment-date').val()),
    remarks: t($f.find('.remarks').val()),
    payment: t($f.find('.payment-method').val()),
    murabaha_status: $detailRow.find('input.murabaha-radio:checked').val() || 'no',
    murabaha_date: t($detailRow.find('.murabaha-date-hidden').val() || '')
  };
}

function isInvestmentChanged($detailRow) {
  const prev = $detailRow.data('snapshot') || {};
  const curr = buildInvestmentSnapshot($detailRow);
  try { return JSON.stringify(prev) !== JSON.stringify(curr); }
  catch { return true; }
}

// Ensure/update the update icon in the Action cell for this row
function toggleUpdateButtonForInvestment($detailRow) {
  if (isClosed()) return;

  const $headerRow = $detailRow.prev('.investment-header');
  const $cell = $headerRow.find('td:last');

  // Single wrapper in Action cell
  let $wrap = $cell.find('.action-buttons');
  if (!$wrap.length) {
    $wrap = $('<div class="action-buttons flex items-center justify-center gap-1"></div>');
    $wrap.append($cell.children().detach());
    $cell.empty().append($wrap);
  }

  const changed = isInvestmentChanged($detailRow);
  const $existing = $wrap.find('.update-invest-btn');

  if (changed) {
    if ($existing.length === 0) {
      $wrap.prepend(
        createInvestmentIconButton(
          'update-invest-btn',
          'bi-arrow-repeat',
          'Update Row',
          'bg-green-600 hover:bg-green-700 text-white',
          $headerRow.data('id') || ''
        )
      );
    } else if ($existing.length > 1) {
      // if somehow duplicated, keep the first and remove the rest
      $existing.slice(1).remove();
    }
  } else {
    $existing.remove();
  }
}

(function purgeLegacyBenKeys() {
  try {
    ['localTotal', 'sqTotal', 'usTotal', 'gtsTotals', 'customerTotals'].forEach(k =>
      localStorage.removeItem(k)
    );
    localStorage.removeItem('localSalesTotal');
  } catch { }
})();