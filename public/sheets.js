$.ajaxSetup({
    headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') }
});

const activeSheet = localStorage.getItem('activeSheet') || 'summary';

const sheetHeaders = {
    'gts-material': {
        title: 'GTS Material Entries',
        icon: '/images/material-sheet-logo.png',
    },
    'gts-investment': {
        title: 'GTS Investment Entries',
        icon: '/images/investment-sheet-logo.png',
    },
    us: {
        title: 'US Client Payment',
        icon: '/images/us-sheet-logo.png',
    },
    sq: {
        title: 'SQ Sheet',
        icon: '/images/sq-sheet-icon.png',
    },
    local: {
        title: 'Local Sales',
        icon: '/images/local-sales-icon.png',
    },
    summary: {
        title: 'Summary Sheet',
        icon: '/images/sub-logo.png',
    },
    beneficiary: {
        title: 'Beneficiary Sheet',
        icon: '/images/beneficiary-logo.png',
    }
};

const CUSTOMER_SHEET_ICON = '/images/customer-sheet-logo.png';

// US Sheet
let originalUSClients = [];

// SQ Sheet
let originalSQClients = [];

// ---- Summary globals (declare early) ----
window.sheetTotals = window.sheetTotals || { material: 0, shipping: 0, investment: 0 };
let _lastGoodSummary = { material: 0, shipping: 0, investment: 0 }; // must exist before first render
let _summaryReqId = 0;
window._gtsReqId = window._gtsReqId || 0;
window._gtsAppliedReqId = window._gtsAppliedReqId || 0;

function setActiveSheetBtn(sheet) {
    $('.sheet-tab').removeClass('active').attr('aria-current', 'false');
    $(`.sheet-tab[data-sheet="${sheet}"]`).addClass('active').attr('aria-current', 'page');
}

function fetchInvestmentTotalDedupe() {
    if (window._invFetchPromise) return window._invFetchPromise;
    window._invFetchPromise = fetchAndUpdateInvestmentTotal()
        .always(() => { window._invFetchPromise = null; });
    return window._invFetchPromise;
}

$(document).ready(function () {
    // Render customer tabs (inline or dropdown)
    renderCustomerTabs();

    const initial = localStorage.getItem('activeSheet') || 'summary';
    setActiveSheetBtn(initial);

    $(document).on("click", ".sheet-tab", function (e) {
        e.preventDefault();

        const sheet = $(this).data('sheet');

        setActiveSheetBtn(sheet);
        localStorage.setItem('activeSheet', sheet);

        const $section = $(`#sheet-${sheet}`);
        $('.sheet-section').not($section).hide();
        $section.removeClass('hidden').css('display', 'block');

        const header = sheetHeaders[sheet];
        if (header) {
            $('#headerTitle').text(header.title);
            $('#headerIcon').attr('src', header.icon);
        } else if (sheet.startsWith('customer-')) {
            const sheetName = sheet.slice('customer-'.length).toUpperCase(); // safer than split
            $('#headerTitle').text(`Customer Sheet: ${sheetName}`);
            $('#headerIcon').attr('src', CUSTOMER_SHEET_ICON); // <-- shared customer logo

            // make sure any hidden ancestor is unhidden
            unhideAncestors($section);

            const sheetId =
                $section.find('.customer-sheet-id').val() ||
                $section.find('#customer-sheet-id').val();

            if (sheetId) {
                if (typeof loadCustomerSheetData === 'function') loadCustomerSheetData(sheetId, $section);
                if (typeof loadLoanLedger === 'function') loadLoanLedger(sheetId);
            } else {
                console.warn('No customer-sheet-id found inside', $section.attr('id'));
            }
        }

        if (sheet === 'gts-material') {
            initMaterialLogic();
            loadGtsMaterials();
            fetchAndUpdateInvestmentTotal();
        } else if (sheet === 'gts-investment') {
            initInvestmentLogic();
            loadGtsInvestments();
            fetchAndUpdateInvestmentTotal();
        } else if (sheet === 'us') {
            loadUSClients();
        } else if (sheet === 'sq') {
            loadSQClients();
        } else if (sheet === 'local') {
            initLocalLogic();
            loadLocalSales();
        } else if (sheet === 'summary') {
            initSummaryLogic();
            loadCashInBreakdown();
            fetchAndUpdateInvestmentTotal();
            refreshLoanOutstandingHybrid();
        } else if (sheet === 'beneficiary') {
            initBenLogic();
            loadBeneficiaries();
            computeAndRenderProfit();
        }
        $('#headerTitle').css('margin-bottom', sheet === 'summary' ? '0' : '5px');
    });

    const $btn = $(`.sheet-tab[data-sheet="${activeSheet}"]`);
    if ($btn.length) {
        $btn.trigger('click');
    } else {
        // 4) FALLBACK: bootstrap Summary if no tab matched (first load / SSR)
        localStorage.setItem('activeSheet', 'summary');

        $('[id^="sheet-"]').hide();
        $('#sheet-summary').show();
        setActiveSheetBtn('summary');
        // run the loaders so KPI, chart, breakdowns, and LOANS render on reload
        initSummaryLogic();
        loadCashInBreakdown();
        if (typeof fetchAndUpdateInvestmentTotal === 'function') fetchAndUpdateInvestmentTotal();
        refreshLoanOutstandingHybrid();
    }

    // This is where you put the handler for the "Investment Layout" button
    $("#selectInvestmentBtn").on("click", function () {
        $("#typeSelectModal").addClass("hidden").removeClass("flex");
        $('.sheet-tab[data-sheet="gts-investment"]').click();
        // If you want to auto-show Add Row modal:
        setTimeout(() => {
            $("#addInvestmentRowBtn").click();
        }, 300);
    });

    // near top of sheets.js
    $(document).off('submit.blockUpdate')
        .on('submit.blockUpdate', 'form[action$="/update-customer-sheet"]', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.warn('Blocked legacy submit to /update-customer-sheet');
        });

    // =======================
    // US CLIENT PAYMENT JS
    // =======================

    loadUSClients();

    $(document).on('click', '.delete-us-btn', function () {
        const id = $(this).data('id');
        $('#usDeleteId').val(id);
        $('#usDeleteModal').removeClass('hidden').addClass('flex');
    });

    $('#confirmUsDeleteBtn').on('click', function () {
        const id = $('#usDeleteId').val();

        $.ajax({
            url: `/us-client/delete/${id}`,
            type: 'DELETE',
            data: {
                _token: $('meta[name="csrf-token"]').attr('content')
            },
            success: function (response) {
                $('#usDeleteModal').addClass('hidden').removeClass('flex');
                $('button[data-id="' + id + '"]').closest('tr').remove();
                loadUSClients();
            },
            error: function () {
                alert('Failed to delete record.');
            }
        });
    });

    // Handle Edit
    let editingId = null;
    $(document).on('click', '.edit-us-btn', function () {
        const tr = $(this).closest('tr');
        editingId = tr.data('id');

        const rawDate = tr.data('date');
        const amount = tr.find('td:eq(2)').text().replace('AED', '').replace(/,/g, '').trim();
        const remarks = tr.find('td:eq(3)').text().trim();

        $('#usDate').val(rawDate);
        $('#usAmount').val(amount);
        $('#usRemarks').val(remarks);

        $('button[type="submit"]').text('Update').data('editing', true);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Update Mode
    $('#usClientForm').on('submit', function (e) {
        e.preventDefault();

        const formData = {
            date: $('#usDate').val(),
            amount: $('#usAmount').val(),
            remarks: $('#usRemarks').val(),
            _token: $('meta[name="csrf-token"]').attr('content')
        };

        if ($('button[type="submit"]').data('editing')) {
            $.ajax({
                url: `/us-client/update/${editingId}`,
                type: 'PUT',
                data: formData,
                success: function () {
                    $('#usClientForm')[0].reset();
                    $('button[type="submit"]').text('Submit').removeData('editing');
                    loadUSClients(); // reload from DB
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }
            });
        } else {
            $.post('/us-client/save', $(this).serialize())
                .done(function (res) {
                    if (res.success) {
                        $('#usClientForm')[0].reset();
                        loadUSClients(); // reload from DB, avoids NaN & wrong dates
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }
                })
                .fail(function (xhr) {
                    if (xhr.status === 422) {
                        const errors = xhr.responseJSON.errors;
                        let message = 'Validation error:\n';
                        for (let field in errors) {
                            message += `${errors[field].join(', ')}\n`;
                        }
                        alert(message);
                    } else {
                        alert('Something went wrong while saving.');
                    }
                });
        }
    });

    // Show popup
    $('#usDateFilterInput').on('click', function () {
        const $popup = $('#usDateFilterPopup');
        const inputRect = this.getBoundingClientRect();
        const spaceBelow = window.innerHeight - inputRect.bottom;
        const spaceAbove = inputRect.top;

        // Show popup and decide direction
        $popup.removeClass('top-full bottom-full mt-1 mb-1');

        if (spaceBelow < 260 && spaceAbove > 260) {
            $popup.addClass('bottom-full mb-1'); // show above
        } else {
            $popup.addClass('top-full mt-1'); // show below
        }

        $popup.removeClass('hidden');
    });

    // Hide popup when clicking outside
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#usDateFilterPopup, #usDateFilterInput').length) {
            $('#usDateFilterPopup').addClass('hidden');
        }
    });

    // Apply filter
    $('#applyUsDateFilterBtn').on('click', function () {
        const from = $('#usDateFilterFrom').val();
        const to = $('#usDateFilterTo').val();

        if (!from || !to) {
            alert("Please select both dates.");
            return;
        }

        const fromDate = new Date(from);
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999); // Include full day

        $('#us-client-body tr').each(function () {
            // Use raw data-date from the <tr>
            const rowDateStr = $(this).data('date'); // e.g., "2025-03-04"
            const rowDate = new Date(rowDateStr);
            rowDate.setHours(12); // Normalize to avoid timezone issues

            if (rowDate >= fromDate && rowDate <= toDate) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        $('#usDateFilterPopup').addClass('hidden');
    });

    // Clear filter
    $('#clearUsDateFilterBtn').on('click', function () {
        $('#usDateFilterFrom').val('');
        $('#usDateFilterTo').val('');
        $('#usDateFilterInput').val('');

        $('#us-client-body tr').show();
    });

    $('#usFilteredExcelBtn').on('click', function () {
        const wb = XLSX.utils.book_new();
        const wsData = [];

        wsData.push(['SR.NO', 'Date', 'Amount', 'Remarks']);
        $('#us-client-body tr').each(function () {
            const row = [
                $(this).find('td:eq(0)').text(),
                $(this).find('td:eq(1)').text(),
                $(this).find('td:eq(2)').text(),
                $(this).find('td:eq(3)').text()
            ];
            wsData.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Filtered US Client Sheet");
        XLSX.writeFile(wb, "us_client_filtered.xlsx");
    });

    $(document).on('input', '.column-filter', function () {
        const filters = [];

        // Store each filter value along with its column index
        $('.column-filter').each(function () {
            filters.push({
                index: $(this).data('index'),
                value: $(this).val().toLowerCase()
            });
        });

        // Apply filters to each row
        $('#us-client-body tr').each(function () {
            const cells = $(this).find('td');
            const visible = filters.every(filter => {
                if (!filter.value) return true;
                return cells.eq(filter.index).text().toLowerCase().includes(filter.value);
            });

            $(this).toggle(visible);
        });
    });


    // =======================
    // SQ Sheet JS
    // =======================


    loadSQClients();

    $(document).on('click', '.delete-sq-btn', function () {
        const id = $(this).data('id');
        $('#sqDeleteId').val(id);
        $('#sqDeleteModal').removeClass('hidden').addClass('flex');
    });

    $('#confirmSqDeleteBtn').on('click', function () {
        const id = $('#sqDeleteId').val();

        $.ajax({
            url: `/sq-client/delete/${id}`,
            type: 'DELETE',
            data: { _token: $('meta[name="csrf-token"]').attr('content') },
            success: function (response) {
                $('#sqDeleteModal').addClass('hidden').removeClass('flex');
                $('button[data-id="' + id + '"]').closest('tr').remove();
                loadSQClients();
            },
            error: function () {
                alert('Failed to delete record.');
            }
        });
    });

    $(document).on('click', '.edit-sq-btn', function () {
        const tr = $(this).closest('tr');
        editingId = tr.data('id');

        const rawDate = tr.data('date');
        const amount = tr.find('td:eq(2)').text().replace('AED', '').replace(/,/g, '').trim();
        const remarks = tr.find('td:eq(3)').text().trim();

        $('#sqDate').val(rawDate);
        $('#sqAmount').val(amount);
        $('#sqRemarks').val(remarks);

        $('button[type="submit"]').text('Update').data('editing', true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('#sqClientForm').on('submit', function (e) {
        e.preventDefault();

        const formData = {
            date: $('#sqDate').val(),
            amount: $('#sqAmount').val(),
            remarks: $('#sqRemarks').val(),
            _token: $('meta[name="csrf-token"]').attr('content')
        };

        if ($('button[type="submit"]').data('editing')) {
            $.ajax({
                url: `/sq-client/update/${editingSQId}`,
                type: 'PUT',
                data: formData,
                success: function () {
                    $('#sqClientForm')[0].reset();
                    $('button[type="submit"]').text('Submit').removeData('editing');
                    loadSQClients();
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }
            });
        } else {
            $.post('/sq-client/save', $(this).serialize())
                .done(function (res) {
                    if (res.success) {
                        $('#sqClientForm')[0].reset();
                        loadSQClients();
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }
                })
                .fail(function (xhr) {
                    if (xhr.status === 422) {
                        const errors = xhr.responseJSON.errors;
                        let message = 'Validation error:\n';
                        for (let field in errors) {
                            message += `${errors[field].join(', ')}\n`;
                        }
                        alert(message);
                    } else {
                        alert('Something went wrong while saving.');
                    }
                });
        }
    });

    $('#sqDateFilterInput').on('click', function () {
        const $popup = $('#sqDateFilterPopup');
        const inputRect = this.getBoundingClientRect();
        const spaceBelow = window.innerHeight - inputRect.bottom;
        const spaceAbove = inputRect.top;

        // Show popup and decide direction
        $popup.removeClass('top-full bottom-full mt-1 mb-1');

        if (spaceBelow < 260 && spaceAbove > 260) {
            $popup.addClass('bottom-full mb-1'); // show above
        } else {
            $popup.addClass('top-full mt-1'); // show below
        }

        $popup.removeClass('hidden');
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('#sqDateFilterPopup, #sqDateFilterInput').length) {
            $('#sqDateFilterPopup').addClass('hidden');
        }
    });

    $('#applySqDateFilterBtn').on('click', function () {
        const from = $('#sqDateFilterFrom').val();
        const to = $('#sqDateFilterTo').val();

        if (!from || !to) {
            alert("Please select both dates.");
            return;
        }

        const fromDate = new Date(from);
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999); // Include full day

        $('#us-client-body tr').each(function () {
            // Use raw data-date from the <tr>
            const rowDateStr = $(this).data('date'); // e.g., "2025-03-04"
            const rowDate = new Date(rowDateStr);
            rowDate.setHours(12); // Normalize to avoid timezone issues

            if (rowDate >= fromDate && rowDate <= toDate) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        $('#sqDateFilterPopup').addClass('hidden');
    });

    $('#clearSqDateFilterBtn').on('click', function () {
        $('#sqDateFilterFrom').val('');
        $('#sqDateFilterTo').val('');
        $('#sqDateFilterInput').val('');

        $('#sq-client-body tr').show();
    });

    $('#sqFilteredExcelBtn').on('click', function () {
        const wb = XLSX.utils.book_new();
        const wsData = [];

        wsData.push(['SR.NO', 'Date', 'Amount', 'Remarks']);
        $('#sq-client-body tr').each(function () {
            const row = [
                $(this).find('td:eq(0)').text(),
                $(this).find('td:eq(1)').text(),
                $(this).find('td:eq(2)').text(),
                $(this).find('td:eq(3)').text()
            ];
            wsData.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Filtered SQ Sheet");
        XLSX.writeFile(wb, "sq_client_filtered.xlsx");
    });

    $(document).on('input', '.column-filter', function () {
        const filters = [];

        // Store each filter value along with its column index
        $('.column-filter').each(function () {
            filters.push({
                index: $(this).data('index'),
                value: $(this).val().toLowerCase()
            });
        });

        // Apply filters to each row
        $('#sq-client-body tr').each(function () {
            const cells = $(this).find('td');
            const visible = filters.every(filter => {
                if (!filter.value) return true;
                return cells.eq(filter.index).text().toLowerCase().includes(filter.value);
            });

            $(this).toggle(visible);
        });
    });

    // Show modal
    $('#openCreateCustomerModalBtn').on('click', function () {
        $('#createCustomerSheetModal').removeClass('hidden').addClass('flex');
    });

    // Cancel modal
    $('#cancelCustomerSheetModalBtn').on('click', function () {
        $('#createCustomerSheetModal').addClass('hidden').removeClass('flex');
    });

    $(document)
        .off('click.summaryNav')
        .on('click.summaryNav', '#nav-summary', function (e) {
            e.preventDefault();
            // delegate to the Summary tab → it will run the loaders once
            $('.sheet-tab[data-sheet="summary"]').trigger('click');
        });

    $(document)
        .off('customerSheets:totalsUpdated.summaryTable')
        .on('customerSheets:totalsUpdated.summaryTable', function () {
            if ($('#sheet-summary').is(':visible')) {
                loadCashInBreakdown();
            }
        });

    $(document)
        .off('click.summaryNavSticky')
        .on('click.summaryNavSticky', '#nav-summary, .sheet-tab[data-sheet="summary"]', function () {
            // after you switch and render summary UI:
            setTimeout(ensureKpiStickyBackdrop, 0);
        });

    // also call once on page load in case Summary is the initial view
    $(function () {
        setTimeout(ensureKpiStickyBackdrop, 0);
    });

    // On Summary nav click (initial load)
    $(document)
        .off('click.summaryNavLoans')
        .on('click.summaryNavLoans', '#nav-summary, .sheet-tab[data-sheet="summary"]', function () {
            refreshLoanOutstandingHybrid();
        });

    // Whenever the loan ledger updates anywhere in the app
    $(document)
        .off('loanLedger:updated.summaryLoans')
        .on('loanLedger:updated.summaryLoans', function () {
            refreshLoanOutstandingHybrid();
        });

    // Toggle menu
    $(document)
        .off('click.custdd')
        .on('click.custdd', '#custDropBtn', function (e) {
            e.stopPropagation();
            $('#custDropMenu').toggleClass('hidden');
        });

    // Close when clicking outside
    $(document)
        .off('click.custddclose')
        .on('click.custddclose', function (e) {
            if (!$(e.target).closest('#customerTabsContainer').length) {
                $('#custDropMenu').addClass('hidden');
            }
        });

    // When choosing an item, update label and close (the global .sheet-tab handler will switch sheets)
    $(document)
        .off('click.custdditem')
        .on('click.custdditem', '#custDropMenu .sheet-tab', function () {
            $('#custDropMenu').addClass('hidden');
            $('#custDropBtn').contents().filter(function () { return this.nodeType === 3; }).remove();
            // Set new label (keep the caret icon)
            const label = $(this).text().trim();
            $('#custDropBtn').prepend(label + ' ');
        });

});

function getSqCached() {
    // 1) DOM (if SQ sheet already rendered)
    const el = document.getElementById('sq-total-amount');
    if (el && el.textContent) {
        const n = parseFloat(el.textContent.replace(/[^\d.-]/g, ''));
        if (!isNaN(n)) return n;
    }
    // 2) window
    if (typeof window.sqTotal === 'number') return window.sqTotal;
    // 3) localStorage
    try {
        const raw = localStorage.getItem('sqTotal');
        if (raw != null) {
            const n = parseFloat(raw);
            if (!isNaN(n)) return n;
        }
    } catch { }
    return null; // not cached
}

function fetchSqTotal() {
    return $.getJSON('/summary/sq/total')
        .then(res => Number(res?.total) || 0)
        .catch(() => 0);
}

function switchToSheet(sheetId) {
    const $tab = $(`.sheet-tab[data-sheet="${sheetId}"]`);
    if ($tab.length) { $tab[0].click(); return; }
    // fallback show/hide if no tab exists yet
    const $section = $(`#sheet-${sheetId}`);
    $('.sheet-section').not($section).hide();
    $section.removeClass('hidden').css('display', 'block');
    try { localStorage.setItem('activeSheet', sheetId); } catch { }
}

// All number have comma 
function applyNumberFormatting() {
    $('.format-aed').each(function () {
        const numText = $(this).text().replace(/[^0-9.-]+/g, ''); // Remove "AED" etc.
        const num = parseFloat(numText);
        if (!isNaN(num)) {
            $(this).text('AED ' + num.toLocaleString(undefined, { minimumFractionDigits: 2 }));
        }
    });
}

function updateSummaryCards() {
    let totalMaterial = 0;
    let totalMaterialInclVAT = 0;
    let totalVAT = 0;
    let totalShipment = 0;

    $('table tbody tr').each(function () {
        const vat = parseFloat($(this).find('td:eq(12)').text().replace('AED', '').trim()) || 0;
        const material = parseFloat($(this).find('td:eq(13)').text().replace('AED', '').trim()) || 0;
        const materialInclVAT = parseFloat($(this).find('td:eq(14)').text().replace('AED', '').trim()) || 0;
        const shipment = parseFloat($(this).find('td:eq(18)').text().replace('AED', '').trim()) || 0;

        totalVAT += vat;
        totalMaterial += material;
        totalMaterialInclVAT += materialInclVAT;
        totalShipment += shipment;
    });

    const grandTotal = totalMaterialInclVAT + totalShipment;

    $('#totalMaterialAED').text('AED ' + totalMaterial.toFixed(2));
    $('#totalMaterialInclVAT').text('AED ' + totalMaterialInclVAT.toFixed(2));
    $('#totalVAT').text('AED ' + totalVAT.toFixed(2));
    $('#totalShipmentAED').text('AED ' + totalShipment.toFixed(2));
    $('#grandTotalAED').text('AED ' + grandTotal.toFixed(2));
}

function printAttachments() {
    const content = document.getElementById('pdfContentForDownload').innerHTML;

    const win = window.open('', '_blank');
    win.document.write(`
      <html>
      <head>
        <title>Attachments</title>
        <style>
          body { font-family: Arial; padding: 10px; margin: 0; }
            .pdf-block {
                margin-bottom: 20px;
                page-break-inside: avoid;
                text-align: center;
            }
            .pdf-title {
                margin-bottom: 10px;
                font-size: 16px;
                text-align: left;
            }
            .pdf-image {
                width: 100%;
                max-height: 850px;
                object-fit: contain;
            }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
}

function fetchAndFillEditForm(id) {
    $.ajax({
        url: `/get-investment/${id}`,
        method: 'GET',
        success: function (data) {
            if (!data) {
                alert("No data found.");
                return;
            }

            $('#date').val(data.date);
            $('#supplier').val(data.supplier_name);
            $('#buyer').val(data.buyer);
            let cleanInvoice = (data.invoice_number ?? '').split('-copy-')[0];
            $('#invoice').val(cleanInvoice);
            $('#transaction').val(data.transaction_mode);
            $('#description').val(data.description);
            $('#ctns').val(data.no_of_ctns);
            $('#unitsPerCtn').val(data.units_per_ctn);
            $('#unitPrice').val(data.unit_price);
            $('#vatPercentage').val(data.vat_percentage);
            $('#weight').val(data.weight);
            $('#shippingRatePerKg').val(data.shipping_rate_per_kg);
            $('#remarks').val(data.remarks);

            $('#investmentForm').data('edit-id', data.id);
            $('#investmentForm').data('original-invoice', data.invoice_number);
            $('#investmentForm').data('original-sub-serial', data.sub_serial);

            $('#submitBtn').hide();
            $('#saveChangesBtn').show();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: function () {
            alert("Error loading entry for editing.");
        }
    });
}

function parseRowDate(dateStr) {
    // Expected format: "Friday, 28 March 2025"
    const parts = dateStr.split(',')[1]?.trim().split(' ');
    if (!parts || parts.length !== 3) return '';

    const day = parts[0].padStart(2, '0');
    const monthName = parts[1];
    const year = parts[2];

    const monthMap = {
        January: '01', February: '02', March: '03', April: '04',
        May: '05', June: '06', July: '07', August: '08',
        September: '09', October: '10', November: '11', December: '12'
    };

    const month = monthMap[monthName];
    if (!month) return '';

    return `${year}-${month}-${day}`; // yyyy-mm-dd
}

// US CLIENT PAYMENT Logic Initialization

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateISO(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toISOString().split('T')[0]; // "2025-03-04"
}

function exportUSClientExcel() {
    const wb = XLSX.utils.book_new();
    const wsData = [];

    wsData.push(['SR.NO', 'Date', 'Amount (AED)', 'Remarks']);

    $('#us-client-body tr').each(function (index) {
        const row = [];
        const cells = $(this).find('td');
        row.push(index + 1);
        row.push(cells.eq(1).text().trim());
        row.push(cells.eq(2).text().trim());
        row.push(cells.eq(3).text().trim());
        wsData.push(row);
    });

    wsData.push([]);
    wsData.push(['Total Amount', $('#us-total-amount').text()]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "US Client Sheet");
    XLSX.writeFile(wb, 'us_client_payment.xlsx');
}

function loadUSClients() {
    $.get('us-client/data', function (data) {
        const clients = (data && Array.isArray(data.clients)) ? data.clients : [];
        originalUSClients = clients;
        renderUSClients(clients);

        const total = Number(data && data.totalAmount) || 0;
        $('#us-total-amount').text(
            'AED ' + total.toLocaleString(undefined, { minimumFractionDigits: 2 })
        );

        // cache for Summary/Beneficiary (optional)
        window.usTotal = total;
        try { localStorage.setItem('usTotal', String(total)); } catch { }
    })
        .fail(function (xhr) {
            console.error('US clients fetch failed:', xhr?.status, xhr?.responseText);
            $('#us-total-amount').text('AED 0.00');
        })
        .always(function () {
            $(document).trigger('us:totalsUpdated');
        });
}

function renderUSClients(clients) {
    const tbody = $('#us-client-body');
    tbody.empty();

    clients.forEach((item) => {
        const originalIndex = originalUSClients.findIndex(c => c.id === item.id);
        const srNo = originalIndex !== -1 ? originalIndex + 1 : '-';

        const row = `
            <tr data-id="${item.id}" data-date="${formatDateISO(item.date)}">
                <td class="w-5">${srNo}</td>
                <td class="w-35">${formatDate(item.date)}</td>
                <td class="format-aed w-32">AED ${parseFloat(item.amount).toFixed(2)}</td>
                <td class="w-40">${item.remarks || ''}</td>
                <td class="w-24">
                    <button class="edit-us-btn px-2 py-1 text-sm rounded bg-green-600 hover:bg-green-700 text-white" title="Edit">
                        <i class="bi bi-pencil-square"></i>
                    </button>

                    <button class="delete-us-btn px-2 py-1 text-sm rounded bg-red-600 hover:bg-red-700 text-white" data-id="${item.id}" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`;
        tbody.append(row);
    });

    applyNumberFormatting();
}

// SQ Sheet Logic Initialization
function loadSQClients() {
    $.get('/sq-client/data', function (data) {
        originalSQClients = data.clients;
        renderSQClients(data.clients);
        $('#sq-total-amount').text(
            'AED ' + parseFloat(data.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })
        );
        // cache it so Summary can use immediately on next visit/refresh
        try {
            window.sqTotal = Number(data.totalAmount) || 0;
            localStorage.setItem('sqTotal', String(window.sqTotal));
        } catch { }
        $(document).trigger('sq:totalsUpdated');
    });
}

function renderSQClients(clients) {
    const tbody = $('#sq-client-body');
    tbody.empty();

    clients.forEach((item) => {
        const originalIndex = originalSQClients.findIndex(c => c.id === item.id);
        const srNo = originalIndex !== -1 ? originalIndex + 1 : '-';

        const row = `
            <tr data-id="${item.id}" data-date="${formatDateISO(item.date)}">
                <td class="w-5">${srNo}</td>
                <td class="w-35">${formatDate(item.date)}</td>
                <td class="format-aed w-32">AED ${parseFloat(item.amount).toFixed(2)}</td>
                <td class="w-40">${item.remarks || ''}</td>
                <td class="w-24">
                    <button class="edit-sq-btn px-2 py-1 text-sm rounded bg-green-600 hover:bg-green-700 text-white" title="Edit">
                        <i class="bi bi-pencil-square"></i>
                    </button>

                    <button class="delete-sq-btn px-2 py-1 text-sm rounded bg-red-600 hover:bg-red-700 text-white" data-id="${item.id}" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`;
        tbody.append(row);
    });

    applyNumberFormatting();
}

function exportSQExcel() {
    const wb = XLSX.utils.book_new();
    const wsData = [];

    wsData.push(['SR.NO', 'Date', 'Amount (AED)', 'Remarks']);

    $('#sq-client-body tr').each(function (index) {
        const row = [];
        const cells = $(this).find('td');
        row.push(index + 1);
        row.push(cells.eq(1).text().trim());
        row.push(cells.eq(2).text().trim());
        row.push(cells.eq(3).text().trim());
        wsData.push(row);
    });

    wsData.push([]);
    wsData.push(['Total Amount', $('#sq-total-amount').text()]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "SQ Sheet");
    XLSX.writeFile(wb, 'sq_sheet.xlsx');
}





// Local Sales: cache items per header row so we only fetch once
window.localItemsCache = window.localItemsCache || {};

// ---------- Local Sales: render master+detail ----------
function renderLocalRows(rows) {
    const $body = $('#localSalesBody').empty();

    if (!rows || !rows.length) {
        $body.append(`<tr class="ls-empty">
      <td colspan="6" class="px-3 py-3 text-gray-500">No rows yet.</td>
    </tr>`);
        $('#localTotalSales').text('AED 0.00');
        $('#localTotalCount').text('0 records');
        initTippy();
        return;
    }

    const esc = (s = '') => String(s).replace(/</g, '&lt;');
    const fmtAED = n => 'AED ' + (parseFloat(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

    let grandInc = 0;

    // Do NOT sort; respect backend order (id ASC)
    rows.forEach((r, i) => {
        const id = r.id;
        const ymd = (r.date || '').slice(0, 10);         // "YYYY-MM-DD"
        const dateUi = formatSheetDateUTC(ymd);             // e.g., "Thursday 10 April 2025"
        const client = esc(r.client || '');
        const brief = esc(r.description || '');
        const pstat = (r.payment_status || 'pending').toLowerCase();
        const rem = esc(r.remarks || '');

        // Use backend aggregate directly
        const rowInc = Number(r.total_inc_vat) || 0;
        grandInc += rowInc;

        // If items are present inline, render them; else lazy-load placeholder
        let itemRowsHtml = `<tr class="ls-items-placeholder">
        <td colspan="9" class="p-3 text-sm text-gray-500">Expand to load items…</td>
      </tr>`;
        if (Array.isArray(r.items)) {
            itemRowsHtml = buildEditableItemRowsHtml(r.items, pstat);
        }

        // MASTER row
        const $master = $(`
      <tr class="group hover:bg-gray-50 master-row" data-id="${id}" data-date="${ymd}">
        <td class="px-3 py-2 align-top">${i + 1}</td>
        <td class="px-3 py-2 align-top">${dateUi}</td>
        <td class="px-3 py-2 align-top">${client}</td>
        <td class="px-3 py-2 align-top">${brief}</td>
        <td class="px-3 py-2 align-top text-right font-semibold ls-total-cell">${fmtAED(rowInc)}</td>
        <td class="px-3 py-2 align-top text-center actions-cell">
          <div class="flex items-center justify-center gap-2">
            <button class="row-save px-2 py-1 text-sm rounded bg-green-600 hover:bg-green-700 text-white mr-2 hidden"
                    data-tippy-content="Save changes"><i class="bi bi-check2-circle"></i></button>

            <button class="ls-upload px-2 py-1 text-sm rounded bg-blue-500 hover:bg-blue-600 text-white"
                    data-id="${id}" data-tippy-content="Upload"><i class="bi-cloud-arrow-up-fill"></i></button>

            <button class="ls-view px-2 py-1 text-sm rounded bg-slate-700 hover:bg-slate-800 text-white"
                    data-id="${id}" data-tippy-content="View"><i class="bi bi-paperclip"></i></button>

            <button class="local-delete px-2 py-1 text-sm rounded bg-red-600 hover:bg-red-700 text-white"
                    data-id="${id}" data-tippy-content="Delete"><i class="bi bi-trash-fill"></i></button>
          </div>
        </td>
      </tr>
    `);

        // DETAIL row
        const $detail = $(`
      <tr class="detail-row" data-parent="${id}">
        <td colspan="6" class="pt-2 pb-4 bg-transparent">
          <div class="ls-detail-wrapper overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            <div class="px-4 py-2 bg-[#d7efff] border-b text-xs font-semibold text-gray-700 uppercase tracking-wider">Items</div>
            <table class="w-full text-sm">
              <thead class="text-gray-600">
                <tr>
                  <th class="px-4 py-3 text-left w-12">#</th>
                  <th class="px-4 py-3 text-left min-w-[18rem]">Description</th>
                  <th class="px-4 py-3 text-right w-28">No. of Units</th>
                  <th class="px-4 py-3 text-right w-28">Unit Price</th>
                  <th class="px-4 py-3 text-right w-36">Total w/o VAT</th>
                  <th class="px-4 py-3 text-right w-28">VAT</th>
                  <th class="px-4 py-3 text-right w-36">Total w/ VAT</th>
                  <th class="px-4 py-3 text-center w-40">Payment</th>
                  <th class="px-4 py-3 text-left min-w-[18rem]">Remarks</th>
                </tr>
              </thead>
              <tbody class="ls-items-body divide-y divide-gray-100">
                ${itemRowsHtml}
              </tbody>
            </table>
            <div class="p-3">
              <button class="add-item-btn mt-1 px-3 py-1 bg-blue-800 text-white rounded hover:bg-blue-900" data-target="${id}">+ Add Item</button>
            </div>
          </div>
        </td>
      </tr>
    `).addClass('hidden'); // collapsed by default

        $body.append($master, $detail);

        // Baselines & UI inits
        setItemsBaseline($detail, getItemsFromDetail($detail));
        updateRowDirtyUI($detail);
        $detail.find('.auto-grow').each(function () { autosizeTextarea(this); });
        refreshSerialVisibility($detail);
        autoGrowTextareas($detail);
    });

    // Totals / counts
    $('#localTotalSales').text(fmtAED(grandInc));
    $('#localTotalCount').text(`${rows.length} record${rows.length === 1 ? '' : 's'}`);

    initTippy();
}

// ---------- Local Sales: expand/collapse, modal, CRUD ----------
function initLocalLogic() {
    // toggle detail
    $(document)
        .off('click.lsRowToggle')
        .on('click.lsRowToggle', '#localSalesBody > tr:not(.detail-row)', function (e) {
            if ($(e.target).closest('.actions-cell,button,a,.bi,input,select,textarea,label').length) return;

            const id = $(this).data('id');
            const $detail = $(`tr.detail-row[data-parent="${id}"], tr.detail-row[data-id="${id}"]`);
            const wasHidden = $detail.hasClass('hidden');

            // close all details first
            $('#localSalesBody tr.detail-row').addClass('hidden');

            if (wasHidden) {
                // if already rendered with inputs (draft or previously loaded), just show
                if ($detail.find('.ls-items-body :input').length) {
                    $detail.removeClass('hidden');
                    return;
                }
                // first open → lazy load items (persisted rows)
                loadLocalItemsOnce($detail, id).always(() => {
                    $detail.removeClass('hidden');
                    autoGrowTextareas($detail);
                    updateRowDirtyUI($detail);
                });
            }
        });

    // open Quick-add modal
    $(document).off('click.lsAdd').on('click.lsAdd', '#localAddBtn', function () {
        $('#qDate').val('');
        $('#qClient').val('');
        $('#qDesc').val('');
        $('#localModal').removeClass('hidden').addClass('flex');
    });

    // close quick modal
    $(document).off('click.lsClose').on('click.lsClose', '#closeLocalModal,#cancelLocal', function () {
        $('#localModal').addClass('hidden').removeClass('flex');
    });

    $(document).off('submit.lsQuick').on('submit.lsQuick', '#localQuickForm', function (e) {
        e.preventDefault();
        const ymd = ($('#qDate').val() || '').trim();
        const dateUi = formatSheetDateUTC(ymd);
        const client = $('#qClient').val();
        const desc = $('#qDesc').val();

        $('#localModal').addClass('hidden').removeClass('flex');

        const draftId = 'draft-' + Date.now();
        // drop the "No rows yet." placeholder if present
        $('#localSalesBody .ls-empty').remove();
        // count only master rows (exclude detail rows and placeholder)
        const idx = $('#localSalesBody > tr').not('.detail-row,.ls-empty').length + 1;

        const [$m, $d] = buildLocalDraftRow({ id: draftId, idx, date: dateUi, client, desc });
        $m.attr('data-date', ymd);
        $('#localSalesBody').append($m).append($d);
        $d.removeClass('hidden');

        // start with one item; prefill description from header "Brief Description"
        const $first = addLocalItemRow($d);
        $first.find('.li-desc').val(desc);
        refreshSerialVisibility($d);
        // initial totals
        recalcItemTable($d);
        initTippy();
    });

    // discard draft
    $(document).off('click.lsDraftCancel').on('click.lsDraftCancel', '.draft-cancel', function () {
        const $m = $(this).closest('tr[data-draft="1"]');
        const id = $m.data('id');

        // remove the matching detail (covers draft + non-draft patterns)
        $(`tr.detail-row[data-parent="${id}"], tr.detail-row[data-id="${id}"]`).remove();
        $m.remove();

        // optional: clear any cached items for this id
        if (window.localItemsCache) delete window.localItemsCache[id];

        // reindex S.No (first cell)
        $('#localSalesBody > tr').not('.detail-row,.ls-empty').each(function (i) {
            $(this).children('td').eq(0).text(i + 1);
        });
    });

    // save draft -> POST to /local-sales
    $(document).off('click.lsDraftSave').on('click.lsDraftSave', '.draft-save', function () {
        const $m = $(this).closest('tr[data-draft="1"]');
        const id = $m.data('id');
        const $d = $(`tr.detail-row[data-id="${id}"]`);

        recalcItemTable($d);
        const agg = $d.data('agg') || {};

        // collect items (optional)
        const items = [];
        $d.find('.ls-items-body > tr').each(function () {
            items.push({
                description: $(this).find('.li-desc').val() || '',
                units: Number($(this).find('.li-units').val() || 0),
                unit_price: Number($(this).find('.li-unitprice').val() || 0),
                vat: Number($(this).find('.li-vat').val() || 0),
                status: ($(this).find('.li-status').val() || 'pending'),
                remarks: $(this).find('.li-remarks').val() || ''
            });
        });

        // derive top-level payment_status (any pending > partial > paid)
        const statuses = items.map(x => x.status);
        let payment_status = 'paid';
        if (statuses.includes('pending')) payment_status = 'pending';
        else if (statuses.includes('partial')) payment_status = 'partial';

        const payload = {
            date: String($m.data('date') || '').trim(),
            client: $m.children('td').eq(2).text().trim(),
            description: $m.children('td').eq(3).text().trim(), // brief description
            payment_status,

            // map aggregates to existing schema (no schema change)
            total_units: agg.total_units || 0,
            total_ex_vat: agg.total_ex_vat || 0,
            vat_amount: agg.vat_amount || 0,
            total_inc_vat: agg.total_inc_vat || 0,

            // legacy fields not applicable in itemized mode
            no_of_ctns: 0,
            units_per_ctn: 0,
            unit_price: 0,
            vat_percent: 5,

            // optional extra (server can ignore)
            items: JSON.stringify(items),
            remarks: items.map(x => x.remarks).filter(Boolean).join(' | ')
        };

        $.ajax({ url: '/local-sales', method: 'POST', data: payload })
            .done(() => {
                setItemsBaseline($d, getItemsFromDetail($d));
                updateRowDirtyUI($d);
                loadLocalSales();
                $(document).trigger('localSales:updated');
            })
            .fail(err => { console.error('Local save failed', err); alert('Failed to save.'); });
    });

    $('#localSalesBody')
        .off('click.lsRowSave', '.row-save')
        .on('click.lsRowSave', '.row-save', function () {
            const $master = $(this).closest('tr');
            const id = $master.data('id');
            const $detail = $(`tr.detail-row[data-parent="${id}"]`);

            // make sure totals are fresh
            recalcItemTable($detail);

            // 1) collect current editable values
            const items = getItemsFromDetail($detail); // uses YOUR function

            // 2) aggregates
            const sums = items.reduce((a, it) => {
                const ex = Number(it.units) * Number(it.unit_price);
                const inc = ex + Number(it.vat);
                a.units += Number(it.units);
                a.ex += ex;
                a.vat += Number(it.vat);
                a.inc += inc;
                return a;
            }, { units: 0, ex: 0, vat: 0, inc: 0 });

            // 3) roll-up payment status
            const sts = items.map(x => String(x.status || '').toLowerCase());
            let payment_status = 'paid';
            if (sts.includes('pending')) payment_status = 'pending';
            else if (sts.includes('partial')) payment_status = 'partial';

            // 4) PUT
            $.ajax({
                url: `/local-sales/${id}`,
                method: 'PUT',
                data: {
                    replace_items: 1,
                    items: JSON.stringify(items),
                    total_units: sums.units,
                    total_ex_vat: sums.ex,
                    vat_amount: sums.vat,
                    total_inc_vat: sums.inc,
                    payment_status
                }
            })
                .done(() => {
                    // 1) Read the CURRENT values from the DOM and normalize
                    const normalized = getItemsFromDetail($detail); // <- your function returns normalized items

                    // 2) Update the cache so reopening uses fresh items
                    window.localItemsCache = window.localItemsCache || {};
                    window.localItemsCache[id] = normalized;

                    // 3) Reset baseline + hide Save (clean state)
                    if (typeof setItemsBaseline === 'function') setItemsBaseline($detail, normalized);
                    if (typeof updateRowDirtyUI === 'function') updateRowDirtyUI($detail);

                    // discard stale cache so items re-fetch cleanly on next expand
                    if (window.localItemsCache) delete window.localItemsCache[id];
                    loadLocalSales(); // full redraw
                })
                .fail(xhr => {
                    const j = xhr.responseJSON;
                    const msg = j?.message || 'Failed to save changes.';
                    alert(msg);
                    console.error('Local update failed', xhr);
                });
        });

    // delete
    $(document).off('click.lsDelete').on('click.lsDelete', '.local-delete', function () {
        const $master = $(this).closest('tr');
        const id = $master.data('id');
        if (!confirm('Delete this row?')) return;

        $.ajax({ url: '/local-sales/' + id, method: 'DELETE' })
            .done(() => {
                $(`tr.detail-row[data-parent="${id}"]`).remove();
                $master.remove();
                // reindex S.No
                $('#localSalesBody > tr').not('.detail-row,.ls-empty').each(function (i) {
                    $(this).children('td').eq(0).text(i + 1);
                });
                $(document).trigger('localSales:updated');
            })
            .fail(err => {
                console.error('Local delete failed', err);
                alert('Failed to delete.');
            });
    });

    $('#localSalesBody')
        .off('click.lsAddItem', '.add-item-btn')
        .on('click.lsAddItem', '.add-item-btn', function () {
            const $detail = $(this).closest('tr.detail-row');
            const $newRow = addLocalItemRow($detail);

            refreshSerialVisibility($detail);
            recalcItemTable($detail);
            autoGrowTextareas($newRow);

            const id = $detail.data('parent') || $detail.data('id');
            $(`#localSalesBody > tr[data-id="${id}"] .row-save`).removeClass('hidden');

            // focus first editable field in the new row
            $newRow.find('.li-desc, .li-units, .li-unitprice, .li-vat')
                .filter(':input')
                .first()
                .focus();
        });

    // ONE unified delegate for edit → recalc → autosize → dirty UI
    $('#localSalesBody')
        .off('input.lsDirty change.lsDirty keyup.lsDirty paste.lsDirty', '.ls-items-body :input')
        .on('input.lsDirty change.lsDirty keyup.lsDirty paste.lsDirty', '.ls-items-body :input', function () {
            const $detail = $(this).closest('tr.detail-row');

            // recalcs totals + aggregates on the detail row
            recalcItemTable($detail);

            // autosize if it's a textarea we marked as growable
            if ($(this).is('textarea.ls-plain, textarea.auto-grow')) {
                autosizeTextarea(this);
            }

            // show/hide the Save button depending on real changes
            updateRowDirtyUI($detail);
        });

    // live auto-grow while typing
    $('#localSalesBody')
        .off('input.autogrow', 'textarea.ls-plain')
        .on('input.autogrow', 'textarea.ls-plain', function () {
            autosizeTextarea(this);
        });

    // After you append rows in renderLocalRows / addLocalItemRow:
    $('#localSalesBody .auto-grow').each(function () { autosizeTextarea(this); });

    // when opening the Upload modal, clear prior selection + labels
    $(document).off('click.lsUpload').on('click.lsUpload', '.ls-upload', function (e) {
        e.stopPropagation();
        const id = $(this).data('id');
        $('#lsUploadSaleId').val(id);
        $('#lsUploadForm .fp-input').val('');               // clear files
        $('#lsUploadForm [data-fp-label]').val('No file chosen'); // reset labels
        $('#lsUploadModal').removeClass('hidden').addClass('flex');
    });

    // Close upload modal
    $('#lsUploadClose,#lsUploadCancel').off('click.lsUploadClose').on('click.lsUploadClose', function () {
        $('#lsUploadModal').addClass('hidden').removeClass('flex');
    });

    // Submit upload
    $('#lsUploadForm').off('submit.lsUpload').on('submit.lsUpload', function (e) {
        e.preventDefault();
        const id = $('#lsUploadSaleId').val();
        const fd = new FormData(this);

        $.ajax({
            url: `/local-sales/${id}/attachments`,
            method: 'POST',
            data: fd,
            processData: false,
            contentType: false,
            headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') }
        })
            .done(() => {
                $('#lsUploadModal').addClass('hidden').removeClass('flex');
                $(document).trigger('localSales:attachmentsUpdated', { id });
                initTippy();
            })
            .fail(xhr => {
                alert(xhr?.responseJSON?.message || 'Upload failed.');
                console.error('ls upload fail', xhr);
            });
    });

    // --- Attachments: open viewer modal ---
    $(document).off('click.lsView').on('click.lsView', '.ls-view', function (e) {
        e.stopPropagation();
        const id = $(this).data('id');

        // try API; if it fails (404 etc), still open with all "Not Uploaded"
        $.getJSON(`/local-sales/${id}/attachments`)
            .done(res => {
                $('#lsViewBody').html(
                    lsMkAttRow('Invoice', res.invoice) +
                    lsMkAttRow('Bank Transfer Receipt', res.receipt) +
                    lsMkAttRow('Delivery Note', res.note)
                );
                $('#lsDownloadPdfBtn').attr('href', `/local-sales/${id}/attachments/pdf`);
                $('#lsViewModal').removeClass('hidden').addClass('flex');
            })
            .fail(() => {
                // open with all empty instead of alert
                $('#lsViewBody').html(
                    lsMkAttRow('Invoice', null) +
                    lsMkAttRow('Bank Transfer Receipt', null) +
                    lsMkAttRow('Delivery Note', null)
                );
                $('#lsDownloadPdfBtn').attr('href', `/local-sales/${id}/attachments/pdf`);
                $('#lsViewModal').removeClass('hidden').addClass('flex');
            });
    });

    $('#lsViewClose,#lsViewClose2').off('click.lsViewClose').on('click.lsViewClose', function () {
        $('#lsViewModal').addClass('hidden').removeClass('flex');
    });

    $(document).on('localSales:attachmentsUpdated', function (e, payload) {
        const id = payload?.id;
        if (!id) return;
        $.getJSON(`/local-sales/${id}/attachments`, function (res) {
            const hasAny = !!(res.invoice || res.receipt || res.note);
            const $btn = $(`#localSalesBody > tr[data-id="${id}"] .ls-view`);
            $btn.toggleClass('ring-2 ring-offset-1 ring-blue-300', hasAny);
        });
    });

    // open OS picker
    $(document).off('click.fpBrowse').on('click.fpBrowse', '.fp-browse', function () {
        const id = $(this).data('for');
        $('#' + id).trigger('click');
    });

    // show picked filename
    $(document).off('change.fpInput').on('change.fpInput', '.fp-input', function () {
        const id = this.id;
        const name = this.files && this.files.length ? this.files[0].name : 'No file chosen';
        $(`[data-fp-label="${id}"]`).val(name);
    });

}

// Format "YYYY-MM-DD" as "21 Aug 2025" using UTC to avoid TZ shifts
function formatSheetDateUTC(ymd) {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d)); // UTC safe
    return new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(dt);
}

// If you still need a normalized Y-M-D (strip any time)
function normalizeYMD(s) {
    return (s || '').slice(0, 10); // "YYYY-MM-DD"
}

function fileNameFromUrl(url) {
    if (!url) return '';
    try {
        const clean = url.split('?')[0]; // strip query
        const last = clean.substring(clean.lastIndexOf('/') + 1);
        return decodeURIComponent(last || '');
    } catch { return ''; }
}

// helper to render "Open" link or "Not Uploaded"
function lsMkAttRow(label, url) {
    const right = url
        ? `<span class="ml-2 text-gray-500 break-all">${fileNameFromUrl(url)}</span>
       <a class="text-blue-600 underline" href="${url}" target="_blank">Open</a>`
        : `<span class="text-gray-400">Not Uploaded</span>`;
    return `
    <div class="flex items-center justify-between gap-3">
      <div class="font-medium">${label}:</div>
      <div class="text-right">${right}</div>
    </div>`;
}

function buildEditableItemRowsHtml(items, defaultStatus = 'pending') {
    const esc = s => String(s || '').replace(/</g, '&lt;');
    const num = n => (Number(n) || 0);
    const fmt = n => (Number(n) || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return items.map((it, idx) => {
        const u = num(it.units);
        const up = num(it.unit_price);
        const v = num(it.vat);
        const ex = u * up;
        const inc = ex + v;
        const st = (it.status || defaultStatus).toLowerCase();

        return `
      <tr class="ls-item odd:bg-white even:bg-gray-50" data-idx="${idx + 1}">
        <td class="px-4 py-2 text-left"><span class="sn-text">${idx + 1}</span></td>
        <td class="px-4 py-2 align-top">
          <textarea class="li-desc ls-plain w-full text-gray-800 px-2 py-1" rows="1"
            placeholder="Description">${esc(it.description || '')}</textarea>
        </td>
        <td class="px-4 py-2 text-right">
          <input type="number" min="0" step="1" class="li-units w-full border rounded px-2 py-1 text-right" value="${u}">
        </td>
        <td class="px-4 py-2 text-right">
          <input type="number" min="0" step="0.01" class="li-unitprice w-full border rounded px-2 py-1 text-right" value="${up}">
        </td>
        <td class="px-4 py-3 text-right tabular-nums li-ex">${fmt(ex)}</td>
        <td class="px-4 py-2 text-right">
          <input type="number" min="0" step="0.01" class="li-vat w-full border rounded px-2 py-1 text-right" value="${v}">
        </td>
        <td class="px-4 py-3 text-right tabular-nums li-inc font-semibold">${fmt(inc)}</td>
        <td class="px-4 py-2 text-center">
          <select class="li-status w-full border rounded px-2 py-1">
            <option value="paid" ${st === 'paid' ? 'selected' : ''}>Paid</option>
            <option value="pending" ${st === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="partial" ${st === 'partial' ? 'selected' : ''}>Partially Paid</option>
          </select>
        </td>
        <td class="px-4 py-2 align-top">
          <textarea class="li-remarks ls-plain w-full text-gray-800 px-2 py-1" rows="1"
            placeholder="Remarks">${esc(it.remarks || '')}</textarea>
        </td>
      </tr>
    `;
    }).join('');
}

function loadLocalItemsOnce($detail, id) {
    if ($detail.data('loaded') === 1) {
        return $.Deferred().resolve(window.localItemsCache[id] || []).promise();
    }

    if (window.localItemsCache[id]) {
        renderItemsIntoDetail($detail, window.localItemsCache[id]);
        return $.Deferred().resolve(window.localItemsCache[id]).promise();
    }

    return $.getJSON(`/local-sales/${id}/items`)
        .done(res => {
            const items = Array.isArray(res?.data) ? res.data : [];
            window.localItemsCache[id] = items;      // cache fresh copy
            renderItemsIntoDetail($detail, items);   // use the new renderer
        })
        .fail(() => {
            $detail.find('.ls-items-body')
                .empty()
                .append(`<tr><td colspan="9" class="p-3 text-center text-red-600">Failed to load items.</td></tr>`);
        });
}

function toISODateSafe(s) {
    if (!s) return '';
    // force local midnight to avoid TZ shifts
    const d = new Date(`${s}T00:00:00`);
    return isNaN(d) ? s : d.toISOString().slice(0, 10);
}

// helper for status badge (include once)
function lsStatusBadge(status) {
    const s = (status || 'pending').toLowerCase();
    const cls =
        s === 'paid' ? 'bg-green-100 text-green-700' :
            s === 'partial' ? 'bg-blue-100 text-blue-700' :
                'bg-yellow-100 text-yellow-700';
    const label = s === 'partial' ? 'Partially Paid' : (s.charAt(0).toUpperCase() + s.slice(1));
    return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${cls}">${label}</span>`;
}

function initTippy() {
    try {
        if (typeof tippy === 'function') {
            tippy('[data-tippy-content]', { theme: 'light', delay: [150, 0], appendTo: document.body });
        }
    } catch { }
}

// Build master + rich detail (colspan = 5 to match your table)
function buildLocalDraftRow({ id, idx, date, client, desc }) {

    const $master = $(`
        <tr class="group hover:bg-gray-50 cursor-pointer" data-id="${id}" data-draft="1">
            <td class="px-3 py-2 align-top">${idx}</td>
            <td class="px-3 py-2 align-top">${date}</td>
            <td class="px-3 py-2 align-top">${client}</td>
            <td class="px-3 py-2 align-top">${desc}</td>
            <td class="px-3 py-2 align-top text-right font-semibold ls-total-cell">AED 0.00</td>
            <td class="px-3 py-2 align-top text-center actions-cell cursor-default">
                <div class="flex items-center justify-center gap-1">
                    <button type="button" class="draft-save px-2 py-1 text-sm rounded bg-green-600 hover:bg-green-700 text-white mr-2" title="Save" data-tippy-content="Save"><i class="bi bi-check2-circle"></i></button>
                    <button type="button" class="draft-cancel px-2 py-1 text-sm rounded bg-red-600 hover:bg-red-700 text-white" title="Discard" data-tippy-content="Discard"><i class="bi bi-x-circle"></i></button>
                </div>
            </td>
        </tr>
    `);

    const $detail = $(`
        <tr class="detail-row bg-gray-50/40" data-id="${id}" data-draft="1">
        <td colspan="6" class="px-3 py-3">
            <div class="rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Items
            </div>

            <table class="w-full text-sm">
                <thead class="bg-gray-50 text-gray-600">
                <tr>
                    <th class="px-4 py-3 text-left w-12">#</th>
                    <th class="px-4 py-3 text-left">Description</th>
                    <th class="px-4 py-3 text-right w-28">No. of Units</th>
                    <th class="px-4 py-3 text-right w-28">Unit Price</th>
                    <th class="px-4 py-3 text-right w-36">Total w/o VAT</th>
                    <th class="px-4 py-3 text-right w-28">VAT</th>
                    <th class="px-4 py-3 text-right w-36">Total w/ VAT</th>
                    <th class="px-4 py-3 text-center w-40">Payment Status</th>
                    <th class="px-4 py-3 text-left w-64">Remarks</th>
                </tr>
                </thead>
                <tbody class="ls-items-body divide-y divide-gray-100"></tbody>
            </table>

            <div class="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                <button class="add-item-btn inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700" data-target="${id}">
                <i class="bi bi-plus-lg"></i><span>Add Item</span>
                </button>

                <div class="text-xs text-gray-500">Totals auto-update as you type.</div>
            </div>
            </div>
        </td>
        </tr>
        `);

    return [$master, $detail];
}

function addLocalItemRow($detail) {
    const idx = $detail.find('.ls-items-body > tr').length + 1;
    const $row = $(`
    <tr class="ls-item" data-idx="${idx}">
      <td class="px-4 py-2 text-left"><span class="sn-text">${idx}</span></td>
      <td class="px-4 py-2 align-top">
        <textarea
            class="li-desc ls-plain w-full text-gray-800 bg-transparent
                border border-transparent rounded px-2 py-1
                focus:border-gray-300 focus:ring-0 resize-none"
            rows="1" placeholder="Description"></textarea>
        </td>
      <td class="px-4 py-2 text-right"><input type="number" min="0" step="1" class="li-units w-full border rounded px-2 py-1 text-right" value="0"></td>
      <td class="px-4 py-2 text-right"><input type="number" min="0" step="0.01" class="li-unitprice w-full border rounded px-2 py-1 text-right" value="0"></td>
      <td class="px-4 py-3 text-right tabular-nums li-ex">0.00</td>
      <td class="px-4 py-2 text-right"><input type="number" min="0" step="0.01" class="li-vat w-full border rounded px-2 py-1 text-right" value="0"></td>
      <td class="px-4 py-3 text-right tabular-nums li-inc">0.00</td>
      <td class="px-4 py-2 text-center">
        <select class="li-status w-full border rounded px-2 py-1">
          <option value="paid">Paid</option>
          <option value="pending" selected>Pending</option>
          <option value="partial">Partially Paid</option>
        </select>
      </td>
      <td class="px-4 py-2 align-top">
        <textarea
            class="li-remarks ls-plain w-full text-gray-800 bg-transparent
                border border-transparent rounded px-2 py-1
                focus:border-gray-300 focus:ring-0 resize-none"
            rows="1" placeholder="Remarks"></textarea>
        </td>
    </tr>
  `);
    $detail.find('.ls-items-body').append($row);
    return $row;
}

// you already have this:
function autosizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight || 0) + 'px';
}

function autoGrowTextareas($scope) {
    // $scope can be a detail row; default to document
    const $root = ($scope && $scope.length) ? $scope : $(document);
    $root.find('textarea.ls-plain').each((_, el) => autosizeTextarea(el));
}

function setItemsBaseline($detail, items) {
    $detail.data('baseline', JSON.stringify(normalizeItems(items || [])));
}

function getBaselineItems($detail) {
    try {
        const raw = $detail.data('baseline');
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

// --- render items into a detail row as EDITABLE inputs ---
function renderItemsIntoDetail($detail, items) {
    const normalized = normalizeItems(items || []);
    const html = buildEditableItemRowsHtml(normalized, 'pending');
    $detail.find('.ls-items-body').empty().append(html);

    refreshSerialVisibility($detail);
    $detail.attr('data-loaded', '1').data('loaded', 1);
    autoGrowTextareas($detail);
    setItemsBaseline($detail, normalized);
    updateRowDirtyUI($detail);
}

// --- Dirty tracking helpers ---
function normalizeItems(arr) {
    // keep only the fields that matter, normalize numbers
    return (arr || []).map(x => ({
        description: String(x.description || '').trim(),
        units: Number(x.units || 0),
        unit_price: Number(x.unit_price || 0),
        vat: Number(x.vat || 0),
        status: String(x.status || 'pending').toLowerCase(),
        remarks: String(x.remarks || '').trim(),
    }));
}

function getItemsFromDetail($detail) {
    const items = [];
    $detail.find('.ls-items-body > tr').each(function () {
        const $r = $(this);
        items.push({
            description: $r.find('.li-desc').val() || '',
            units: Number($r.find('.li-units').val() || 0),
            unit_price: Number($r.find('.li-unitprice').val() || 0),
            vat: Number($r.find('.li-vat').val() || 0),
            status: ($r.find('.li-status').val() || 'pending').toLowerCase(),
            remarks: $r.find('.li-remarks').val() || '',
        });
    });
    return normalizeItems(items);
}

function itemsEqual(a, b) {
    return JSON.stringify(normalizeItems(a)) === JSON.stringify(normalizeItems(b));
}

// show/hide the Save button based on diff vs baseline
function updateRowDirtyUI($detail) {
    const id = $detail.data('parent') || $detail.data('id');
    const $save = $(`#localSalesBody > tr[data-id="${id}"] .row-save`);

    const baselineStr = String($detail.data('baseline') || '[]'); // already normalized+stringified
    const currentStr = JSON.stringify(normalizeItems(getItemsFromDetail($detail)));

    $save.toggleClass('hidden', baselineStr === currentStr);
}

function refreshSerialVisibility($detail) {
    const $rows = $detail.find('.ls-items-body > tr');
    const single = $rows.length <= 1;
    $rows.find('.sn-text')[single ? 'addClass' : 'removeClass']('invisible');
}

function recalcItemTable($detail) {
    let sumUnits = 0, sumEx = 0, sumVat = 0, sumInc = 0;

    $detail.find('.ls-items-body > tr').each(function () {
        const $r = $(this);
        const u = Number($r.find('.li-units').val() || 0);
        const up = Number($r.find('.li-unitprice').val() || 0);
        const v = Number($r.find('.li-vat').val() || 0);
        const ex = u * up;
        const inc = ex + v;

        $r.find('.li-ex').text(ex.toFixed(2));
        $r.find('.li-inc').text(inc.toFixed(2));

        sumUnits += u; sumEx += ex; sumVat += v; sumInc += inc;
    });

    $detail.data('agg', {
        total_units: sumUnits,
        total_ex_vat: sumEx,
        vat_amount: sumVat,
        total_inc_vat: sumInc
    });

    const id = $detail.data('parent') || $detail.data('id');
    $(`#localSalesBody > tr[data-id="${id}"] .ls-total-cell`).text(fmtAED(sumInc));

    updateLocalTotalsCard();
}

function updateLocalTotalsCard() {
    let total = 0;
    $('#localSalesBody .ls-total-cell').each(function () {
        // parse "AED 1,234.56"
        const n = parseFloat($(this).text().replace(/[^\d.-]/g, '')) || 0;
        total += n;
    });
    $('#localTotalSales').text(fmtAED(total));
    const count = $('#localSalesBody > tr').not('.detail-row,.ls-empty').length;
    $('#localTotalCount').text(`${count} record${count === 1 ? '' : 's'}`);

    // NEW: persist for Summary
    try {
        window.localSalesTotal = total;                  // fast in-memory
        localStorage.setItem('localSalesTotal', String(total)); // survives refresh
    } catch { }
    $(document).trigger('localSales:updated');
}

// loader
function loadLocalSales() {
    const $body = $('#localSalesBody');
    if (!$body.length) return;
    $.get('/local-sales')
        .done(res => renderLocalRows(res.data || []))
        .fail(() => $body.html(`<tr><td colspan="6" class="px-3 py-3 text-red-600">Failed to load.</td></tr>`));
}

// Summery Sheet Logic

// ---- Summary helpers ----
const fmtAED = n => 'AED ' + (parseFloat(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

function hasRealTotals(x) {
    return !!x && (Number(x.material) > 0 || Number(x.shipping) > 0);
    // or: return Boolean(x) && (Number(x.material) > 0 || Number(x.shipping) > 0);
}

function getGtsTotalsFromStorage() {
    try {
        if (window.gtsTotals && typeof window.gtsTotals.material === 'number') return window.gtsTotals;
        const raw = localStorage.getItem('gtsTotals');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.material === 'number') return parsed;
    } catch { }
    return null;
}

// Fallback API for a hard refresh before user visits Local sheet
function fetchLocalSalesTotal() {
    return $.getJSON('summary/local-sales/total', { _t: Date.now() })
        .then(res => {
            const tot = Number(res?.total) || 0;
            try { localStorage.setItem('localSalesTotal', String(tot)); } catch { }
            return tot;
        })
        .catch(() => {
            // fallback to cache on network error
            try {
                const v = localStorage.getItem('localSalesTotal');
                return v != null ? (Number(v) || 0) : 0;
            } catch { return 0; }
        });
}

// Update Summary’s numbers (cards + chart)
function renderSummaryFromGtsTotals(
    { material = null, shipping = null, investment = null } = {},
    _src = 'unknown',
    _reqId = 0,
    opts = {}
) {
    if (_reqId && _reqId < (window._gtsAppliedReqId || 0)) {
        console.warn('[Summary render ignored: stale]', _src, { material, shipping, investment, _reqId });
        return;
    }

    var allowZero = !!(opts && opts.allowZero);

    // Normalize incoming, with safe fallbacks
    var mIn = (material == null)
        ? Number(_lastGoodSummary && _lastGoodSummary.material) || 0
        : Number(material) || 0;

    var sIn = (shipping == null)
        ? Number(_lastGoodSummary && _lastGoodSummary.shipping) || 0
        : Number(shipping) || 0;

    var invFromCache = Number((window.sheetTotals && window.sheetTotals.investment)) || 0;
    var invFromDom = (function () {
        var el = document.getElementById('totalInvestmentAmount-investment');
        return el ? (parseFloat((el.textContent || '').replace(/[^\d.-]/g, '')) || 0) : 0;
    })();

    var iIn = (investment == null)
        ? (invFromCache || invFromDom || Number(_lastGoodSummary && _lastGoodSummary.investment) || 0)
        : Number(investment) || 0;

    // Guard: if both m & s are zero but we have a last-good and NOT allowZero => keep last-good
    var bothZero = (mIn === 0 && sIn === 0);
    var hadGood = ((Number(_lastGoodSummary && _lastGoodSummary.material) > 0) ||
        (Number(_lastGoodSummary && _lastGoodSummary.shipping) > 0));

    var materialFinal = (bothZero && hadGood && !allowZero) ? Number(_lastGoodSummary.material) || 0 : mIn;
    var shippingFinal = (bothZero && hadGood && !allowZero) ? Number(_lastGoodSummary.shipping) || 0 : sIn;
    var investmentFinal = iIn;

    // Persist “last good” if any positive OR the caller explicitly allows zero (server fetch)
    if (allowZero || (materialFinal > 0 || shippingFinal > 0 || investmentFinal > 0)) {
        _lastGoodSummary = { material: materialFinal, shipping: shippingFinal, investment: investmentFinal };
    }

    // Paint the 3 cards
    $('#totalPurchaseMaterial').text(fmtAED(materialFinal));
    $('#totalShippingCost').text(fmtAED(shippingFinal));
    $('#totalInvestmentAmount-investment').text(fmtAED(investmentFinal));

    // Deriveds
    var cashOut = materialFinal + shippingFinal + investmentFinal;
    $('#cashOutAmount').text(fmtAED(cashOut));

    var cashInNow = (window._ciLast)
        ? (Number(window._ciLast.us && window._ciLast.us.material || 0)
            + Number(window._ciLast.sq && window._ciLast.sq.material || 0)
            + Number(window._ciLast.local && window._ciLast.local.material || 0)
            + ((window._ciLast.customers || []).reduce(function (s, c) {
                return s + Number(c.material || 0) + Number(c.shipping || 0);
            }, 0)))
        : getNum('#cashInAmount');

    var profit = cashInNow - cashOut;
    $('#profitAmount').text(fmtAED(profit));
    scheduleChartUpdate(cashInNow, cashOut, profit, !window._chartIntroPlayed);

    if (_reqId) window._gtsAppliedReqId = _reqId;

    console.log('[Summary render]', _src, {
        material: materialFinal, shipping: shippingFinal, investment: investmentFinal, _reqId
    });
}

// Bind the listener ONCE at file scope
(function bindGtsTotalsListenerOnce() {
    if (window.__gtsTotalsListenerBound) return;
    window.__gtsTotalsListenerBound = true;

    document.addEventListener('gts:totals-changed', (e) => {
        const active = localStorage.getItem('activeSheet');
        if (active === 'summary') {
            renderSummaryFromGtsTotals(e.detail);
        }
    });
})();

let summaryChart = null;
let cachedCashOut = 0;

// Helpers (put once near your summary code)
function getNum(sel) {
    const el = document.querySelector(sel);
    if (!el) return 0;
    return parseFloat((el.textContent || '').replace(/[^\d.-]/g, '')) || 0;
}

function getLocalSalesAmount() {
    // Prefer the Local Sales total card if present
    const txt = ($('#localTotalSales').text() || '').trim();
    if (txt) return parseFloat(txt.replace(/[^\d.-]/g, '')) || 0;

    // Fallback: sum master-row totals in the Local Sales sheet (if rendered)
    let sum = 0;
    $('#localSalesBody .ls-total-cell').each(function () {
        sum += parseFloat($(this).text().replace(/[^\d.-]/g, '')) || 0;
    });
    return sum;
}

// ONE global instance
window.summaryChart = window.summaryChart || null;

function ensureSummaryChart() {
    const canvas = document.getElementById('summaryChart');
    if (!canvas || typeof Chart === 'undefined') return null;

    if (window.summaryChart && typeof window.summaryChart.update === 'function') return window.summaryChart;

    const ctx = canvas.getContext('2d');
    window.summaryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Cash In', 'Cash Out', 'Profit'],
            datasets: [{
                label: 'AED',
                data: [0, 0, 0], // start at baseline
                backgroundColor: ['#22c55e', '#ef4444', '#3b82f6'],
                hoverBackgroundColor: ['#16a34a', '#dc2626', '#2563eb'],
                borderColor: ['#16a34a', '#dc2626', '#2563eb'],
                borderWidth: 1,
                categoryPercentage: 0.95,
                barPercentage: 0.9,
                barThickness: 92,
                maxBarThickness: 120,
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // we control animations on update
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => 'AED ' + (ctx.parsed.y || 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })
                    }
                }
            },
            scales: {
                y: { ticks: { callback: v => 'AED ' + Number(v).toLocaleString() }, grid: { color: 'rgba(0,0,0,0.06)' } },
                x: { grid: { display: false } }
            }
        }
    });
    return window.summaryChart;
}

let _chartDebounce;
let _chartIntroPlayed = false;   // only one true bottom→top intro
let _chartPendingTarget = null;

function scheduleChartUpdate(cashIn, cashOut, profit, fromZeroOnce = false) {
    _chartPendingTarget = [cashIn, cashOut, profit];

    // ignore early calls until we explicitly run the intro
    if (!_chartIntroPlayed && !fromZeroOnce) return;

    clearTimeout(_chartDebounce);
    _chartDebounce = setTimeout(() => {
        const ch = ensureSummaryChart();
        if (!ch) return;

        const target = _chartPendingTarget || [cashIn, cashOut, profit];

        // ---- ONE-TIME INTRO (bottom → top) ----
        if (fromZeroOnce && !_chartIntroPlayed) {
            _chartIntroPlayed = true;

            // IMPORTANT: animate bars from the baseline (y=0) pixel
            const fromBase = (ctx) => ctx.chart.scales.y.getPixelForValue(0);

            // don’t set data to zeros first (that causes extra flicker)
            ch.options.animation = { duration: 900, easing: 'easeOutCubic' };
            ch.options.animations = {
                y: { type: 'number', from: fromBase, duration: 900, easing: 'easeOutCubic' }, // top edge
                base: { type: 'number', from: fromBase, duration: 900, easing: 'easeOutCubic' }  // bottom edge
            };
            ch.data.datasets[0].data = target;
            ch.update();
            return;
        }

        // ---- NORMAL UPDATES (no flicker) ----
        ch.options.animation = { duration: 400, easing: 'easeOutCubic' };
        ch.options.animations = { y: { duration: 400 }, base: { duration: 400 } };
        ch.data.datasets[0].data = target;
        ch.update();
    }, 120);
}

function updateCashInBreakdown(data) {
    const breakdownTable = $('#cashInBreakdownTable');
    breakdownTable.empty();

    const sheets = ['rh', 'ff', 'bl', 'ws'];
    const labels = {
        rh: 'RH Sheet',
        ff: 'FF Sheet',
        bl: 'BL Sheet',
        ws: 'WS Sheet'
    };

    sheets.forEach(sheet => {
        const material = parseFloat(data[sheet + '_material']) || 0;
        const shipping = parseFloat(data[sheet + '_shipping']) || 0;
        const total = material + shipping;

        breakdownTable.append(`
            <tr>
                <td>${labels[sheet]}</td>
                <td>AED ${material.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>AED ${shipping.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td><strong>AED ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
            </tr>
        `);
    });
}

// --- one-time skeleton for Cash In cards (fixed order) ---
let _cashInBuildSeq = 0;
let _ciLast = null;

function loadCashInBreakdown() {
    if (!$('#sheet-summary').is(':visible')) return;
    const seq = ++_cashInBuildSeq;

    const localCached = getLocalSalesCached();
    const sqCached = getSqCached();
    const usCached = getUsCached();

    // ALWAYS fetch fresh; fall back to cache only if the fetch fails
    const localP = $.getJSON(typeof investmentUrl === 'function' ? investmentUrl('summary/local-sales/total') : '/summary/local-sales/total')
        .then(r => Number(r?.total) || 0)
        .catch(() => Number(localCached) || 0);

    const sqP = $.getJSON(typeof investmentUrl === 'function' ? investmentUrl('summary/sq/total') : '/summary/sq/total')
        .then(r => Number(r?.total) || 0)
        .catch(() => Number(sqCached) || 0);

    const usP = fetchUsTotalAlways(); // see below
    const rowsP = fetchCustomerSheetsRows(); // keep as is

    $.when(usP, sqP, localP, rowsP).done(function (usAmt, sqAmt, localAmt, rowsArg) {
        if (seq !== _cashInBuildSeq) return;

        const rows = Array.isArray(rowsArg?.rows) ? rowsArg.rows : [];
        const customerMaterial = rows.reduce((s, r) => s + Number(r.material || 0), 0);
        const customerShipping = rows.reduce((s, r) => s + Number(r.shipping || 0), 0);

        const finalData = {
            us: { name: 'US Client Payment', material: Number(usAmt) || 0 },
            sq: { name: 'SQ Sheet', material: Number(sqAmt) || 0 },
            local: { name: 'Local Sales', material: Number(localAmt) || 0 },
            customers: rows
        };

        const grand = (Number(usAmt) || 0) + (Number(sqAmt) || 0) + (Number(localAmt) || 0)
            + customerMaterial + customerShipping;

        _ciLast = finalData;
        renderCashInBreakdown(finalData, grand);
    });
}

// US total fetch (always)
function fetchUsTotalAlways() {
    // If you have a dedicated endpoint, use it here. If not, reuse the combined breakdown endpoint and extract.
    const url = (typeof investmentUrl === 'function')
        ? investmentUrl('summary/cash-in-breakdown')
        : '/summary/cash-in-breakdown';

    return $.getJSON(url)
        .then(list => {
            // find the US row
            const r = (Array.isArray(list) ? list : []).find(x => /US Client Payment/i.test(x.sheet || x.name || ''));
            return Number(r?.total || r?.material || 0) || 0;
        })
        .catch(() => Number(getUsCached()) || 0);
}

function updateProfitBreakdown(profit) {
    const charity = profit * 0.05;
    const remaining = profit - charity;
    const shareholder1 = remaining / 2;
    const shareholder2 = remaining / 2;

    $('#charityAmount').text('AED ' + charity.toLocaleString(undefined, { minimumFractionDigits: 2 }));
    $('#shareholder1Amount').text('AED ' + shareholder1.toLocaleString(undefined, { minimumFractionDigits: 2 }));
    $('#shareholder2Amount').text('AED ' + shareholder2.toLocaleString(undefined, { minimumFractionDigits: 2 }));
}

// ---- Shared Totals Cache + Broadcaster ----
window.sheetTotals = window.sheetTotals || { material: 0, shipping: 0, investment: 0 };

/**
 * Called by Materials page after recomputing totals.
 * Safe to call from anywhere; Summary will update if open.
 */
window.updateMaterialTotals = function (material, shipping, opts = {}) {
    const _src = opts.src || 'materials';
    const _reqId = opts.reqId || 0;

    // Coerce numbers
    material = Number(material) || 0;
    shipping = Number(shipping) || 0;

    // Update in-memory cache
    window.sheetTotals.material = material;
    window.sheetTotals.shipping = shipping;

    // Broadcast to other pages/tabs
    try {
        localStorage.setItem('gts:totals', JSON.stringify({
            material, shipping, ts: Date.now()
        }));
    } catch (e) {
        console.warn('localStorage broadcast skipped', e);
    }

    // If Summary is present on this page, update its cards now
    if (typeof renderSummaryFromGtsTotals === 'function') {
        renderSummaryFromGtsTotals({ material, shipping }, _src, _reqId);
    }
};

// ---- Summary bootstrapping / listeners ----
(function bootstrapSummarySync() {
    // helper
    function parseTotals(json) {
        try {
            const o = JSON.parse(json) || {};
            return {
                material: Number(o.material) || 0,
                shipping: Number(o.shipping) || 0
            };
        } catch { return { material: 0, shipping: 0 }; }
    }

    // 1) First paint from cached localStorage (if any)
    try {
        const saved = localStorage.getItem('gts:totals') || localStorage.getItem('gtsTotals');
        if (saved && typeof renderSummaryFromGtsTotals === 'function') {
            const { material, shipping } = parseTotals(saved);
            // ignore zero-only bootstrap to avoid flicker; server fetch will repaint
            if (material > 0 || shipping > 0) {
                renderSummaryFromGtsTotals({ material, shipping }, 'localStorage:init', 0 /* no allowZero */);
            }
        }
    } catch (e) {
        console.warn('init read of gts totals failed', e);
    }

    // 2) Live updates when Materials page writes new totals
    window.addEventListener('storage', (e) => {
        if (!e.newValue) return;
        if (e.key !== 'gts:totals' && e.key !== 'gtsTotals') return;

        const { material, shipping } = parseTotals(e.newValue);

        // ignore zero-only storage events (not authoritative)
        if (material === 0 && shipping === 0) return;

        if (typeof renderSummaryFromGtsTotals === 'function') {
            // optional: only repaint when Summary is visible
            if (!$('#sheet-summary').is(':visible')) return;

            renderSummaryFromGtsTotals(
                { material, shipping },
                'storage:event',
                0 /* no reqId sequencing needed here */
                // no opts.allowZero → keeps last-good if both are 0
            );
        }
    });
})();

let summaryInited = false;

function initSummaryLogic() {
    if (summaryInited) return;      // prevent multiple binds
    summaryInited = true;

    // Create new customer sheet modal handlers
    $('#openCreateCustomerModalBtn').off('click.createSheet')
        .on('click.createSheet', function () {
            $('#createCustomerSheetModal').removeClass('hidden').addClass('flex');
        });

    $('#cancelCustomerSheetModalBtn').off('click.createSheet')
        .on('click.createSheet', function () {
            $('#createCustomerSheetModal').addClass('hidden').removeClass('flex');
        });

    // Create Customer Sheet (idempotent)
    $('#createCustomerSheetForm')
        .off('submit.createSheet')
        .on('submit.createSheet', function (e) {
            e.preventDefault();

            if (window._creatingSheet) return;     // guard: avoid double submit
            window._creatingSheet = true;

            const sheetName = ($('#newCustomerSheetName').val() || '').trim();
            if (!sheetName) { window._creatingSheet = false; return; }

            $.ajax({
                url: '/customer/sheets/create',       // local server path
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
                data: { sheet_name: sheetName }
            })
                .done(function (res) {
                    if (!res?.success || !res?.data) {
                        alert(res?.message || 'Failed to create sheet');
                        return;
                    }

                    const dbId = res.data.id;
                    const slug = res.data.slug;
                    const name = res.data.sheet_name;
                    const domId = `customer-${slug}`;

                    // Remove any previous instances (defensive)
                    $(`#customerTabsContainer .sheet-tab[data-sheet="${domId}"]`).remove();
                    $(`#sheet-${domId}`).remove();

                    // Create ONE bottom tab
                    $('#customerTabsContainer').append(
                        `<button class="sheet-tab px-4 py-2 text-sm font-medium hover:bg-gray-100"
                 data-sheet="${domId}">${name}</button>`
                    );

                    // Build the sheet section (make sure this helper does NOT add another tab)
                    if (typeof window.addCustomerSheetUI === 'function') {
                        window.addCustomerSheetUI({ id: dbId, name, slug });
                    } else {
                        // Minimal fallback scaffold (unique hidden id!)
                        $('#sheetContainer').append(`
          <div id="sheet-${domId}" class="sheet-section hidden">
            <input type="hidden" id="customer-sheet-id-${dbId}" class="customer-sheet-id" value="${dbId}">
            <h2 class="text-xl font-bold mb-4">Customer Sheet: ${name}</h2>
          </div>
        `);
                    }

                    // Safety: kill any dup tabs if some other code also appended one
                    const seen = new Set();
                    $('#customerTabsContainer .sheet-tab').each(function () {
                        const key = $(this).data('sheet');
                        if (seen.has(key)) $(this).remove();
                        else seen.add(key);
                    });

                    // Close modal & reset
                    $('#createCustomerSheetModal').addClass('hidden').removeClass('flex');
                    $('#newCustomerSheetName').val('');

                    // Activate the new tab (triggers your existing .sheet-tab click logic)
                    localStorage.setItem('activeSheet', domId);
                    $(`.sheet-tab[data-sheet="${domId}"]`).trigger('click');
                })
                .fail(function (xhr) {
                    alert(xhr.responseJSON?.message || 'Server error creating sheet.');
                    console.error('Create sheet error:', xhr.responseJSON || xhr);
                })
                .always(function () {
                    window._creatingSheet = false;
                });
        });

    // Paint once from cache if we have real numbers (NO server call)
    const cached = getGtsTotalsFromStorage() || window.sheetTotals || {};
    if (hasRealTotals(cached)) {
        renderSummaryFromGtsTotals(
            { material: +cached.material || 0, shipping: +cached.shipping || 0, investment: +window.sheetTotals?.investment || 0 },
            'cache'
        );
    }

    refreshSummaryFromServer('initial-fetch');

    $(document)
        .off('click.summaryTab')
        .on('click.summaryTab', '.sheet-tab[data-sheet="summary"], #summaryTab', () => {
            // 1) give the cache paint its own request id
            window._gtsReqId = window._gtsReqId || 0;
            const reqId = ++window._gtsReqId;

            const cachedNow = getGtsTotalsFromStorage() || window.sheetTotals || {};
            const gts = {
                material: Number(cachedNow.material) || 0,
                shipping: Number(cachedNow.shipping) || 0
            };

            // cache paint + investment
            fetchInvestmentTotal().then(investment => {
                // extra safety: don't let cache overwrite a newer render
                if (reqId < (window._gtsAppliedReqId || 0)) return;
                window.sheetTotals = { ...window.sheetTotals, ...gts, investment };
                renderSummaryFromGtsTotals({ ...gts, investment }, 'tab-cache', reqId);
            });

            // 2) kick a fresh server repaint (it will use its own reqId internally)
            refreshSummaryFromServer('tab-fresh');
        });

    // Live updates from Materials → Summary (keep!)
    $(document)
        .off('gts:totalsUpdated.summary')
        .on('gts:totalsUpdated.summary', (_e, p) => {
            const gts = { material: +p.material || 0, shipping: +p.shipping || 0 };
            window.sheetTotals = { ...window.sheetTotals, ...gts };
            renderSummaryFromGtsTotals({ ...gts, investment: +window.sheetTotals?.investment || 0 }, 'bridge');
        });

    $(document)
        .off('click.sheetSwap')
        .on('click.sheetSwap', '.sheet-tab', function () {
            const key = $(this).data('sheet');
            // remember active sheet for other logic that reads it
            localStorage.setItem('activeSheet', key);

            // toggle sections (adjust IDs/selectors to your DOM)
            $('.sheet-section').addClass('hidden');
            $(`#sheet-${key}`).removeClass('hidden');
        });

    $(document)
        .off('customerSheets:totalsUpdated.summary')      // kill old namespace if present
        .off('customerSheets:totalsUpdated.summaryInit')
        .on('customerSheets:totalsUpdated.summaryInit', (/*e*/) => {
            if (!$('#sheet-summary').is(':visible')) return;

            // debounce to avoid thrash
            clearTimeout(window.__summaryDomBridgeDebounce);
            window.__summaryDomBridgeDebounce = setTimeout(() => {
                const all = (typeof getAllCustomerSheetTotals === 'function')
                    ? getAllCustomerSheetTotals()
                    : { material: 0, shipping: 0 };

                const mat = Number(all.material) || 0;
                const ship = Number(all.shipping) || 0;
                var inv = (_lastGoodSummary && _lastGoodSummary.investment != null
                    ? Number(_lastGoodSummary.investment) || 0
                    : (window.sheetTotals && window.sheetTotals.investment != null
                        ? Number(window.sheetTotals.investment) || 0
                        : 0));

                // only repaint when we actually have numbers; otherwise keep last good
                if (mat > 0 || ship > 0 || inv > 0) {
                    renderSummaryFromGtsTotals({ material: mat, shipping: ship, investment: inv }, 'bridge:init');
                } else if (_lastGoodSummary) {
                    renderSummaryFromGtsTotals(_lastGoodSummary, 'bridge:init-skip-zero');
                }
            }, 80);
        });
}

function refreshSummaryFromServer() {
    // temporary loading state (optional)
    $('#summaryMaterial, #summaryShipping, #summaryInvestment, #summaryRemaining').text('…');
    return fetchGtsTotalsForSummary(); // paints UI when fresh data arrives
}

function fetchInvestmentTotal() {
    return $.getJSON('/gts-investments/total')
        .then(res => Number(res?.total) || 0)
        .catch(() => 0);
}

// --- Summary totals: fetch from server (POST) ---
const TOTALS_URL =
  document.getElementById('summary-root')?.dataset.totalsUrl ||
  '/gts-materials/total';

function fetchGtsTotalsForSummary() {
  const reqId = ++_summaryReqId;

  return $.getJSON(TOTALS_URL)
    .done(function (res) {
      if (reqId !== _summaryReqId) return;

      const mat = Number(res?.material) || 0;
      const ship = Number(res?.shipping) || 0;
      const inv  = Number(window.sheetTotals?.investment) || 0;

      // Don’t let a “0/0” server blip wipe good UI
      const hadGood = (_lastGoodSummary.material > 0 || _lastGoodSummary.shipping > 0);
      const allowZero = !hadGood; // only allow zero on the very first authoritative paint

      renderSummaryFromGtsTotals(
        { material: mat, shipping: ship, investment: inv },
        'gtsTotals',
        reqId,
        { allowZero }
      );
    })
    .fail(function (xhr) {
      console.error('gtsTotals failed', xhr.status, xhr.responseText);
      // keep current UI on failure
    });
}

function renderCashInBreakdown(data = {}, precomputedGrand = null) {
    window._ciLast = data;

    let grand = precomputedGrand;
    if (grand == null) {
        grand =
            (Number(data.us?.material) || 0) +
            (Number(data.sq?.material) || 0) +
            (Number(data.local?.material) || 0);
        if (Array.isArray(data.customers)) {
            data.customers.forEach(c => {
                grand += Number(c.material || 0) + Number(c.shipping || 0);
            });
        }
    }

    $('#cashInAmount').text(fmtAED(grand));

    const cashOut = getNum('#cashOutAmount');
    const profit = grand - cashOut;
    $('#profitAmount').text(fmtAED(profit));

    // Chart: run intro on first paint only
    scheduleChartUpdate(grand, cashOut, profit, !window._chartIntroPlayed);

    // Table
    renderCashInTable(data, grand);
}

// --- Debounced refresher (file-scope) ---
let _cashInRefreshTimer = null;
function requestCashInRefresh() {
    clearTimeout(_cashInRefreshTimer);
    _cashInRefreshTimer = setTimeout(() => {
        if ($('#sheet-summary').is(':visible')) loadCashInBreakdown();
    }, 120);
}

// --- Bind once ---
$(function () {
    $(document)
        .off('us:totalsUpdated.summary sq:totalsUpdated.summary customerSheets:totalsUpdated.summary localSales:updated.summary')
        .on('us:totalsUpdated.summary sq:totalsUpdated.summary customerSheets:totalsUpdated.summary localSales:updated.summary', requestCashInRefresh);
});

// Easing + count-up helper (no flicker, preserves AED format)
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function animateNumberTo($el, finalValue, { duration = 1000, fromValue = null } = {}) {
    const start = (fromValue == null) ? (parseFloat(($el.text() || '').replace(/[^\d.-]/g, '')) || 0) : fromValue;
    const end = Number(finalValue || 0);
    const delta = end - start;
    const t0 = performance.now();

    return new Promise(resolve => {
        function step(now) {
            const t = Math.min(1, (now - t0) / duration);
            const v = start + delta * easeOutCubic(t);
            $el.text(fmtAED(v));
            if (t < 1) requestAnimationFrame(step); else resolve();
        }
        requestAnimationFrame(step);
    });
}

function playKpiAnimationOnce() {
    // If you want “every click”, clear this before calling (see below)
    if (localStorage.getItem('summaryKpiPlayed') === '1') return Promise.resolve();

    const cashIn = getNum('#cashInAmount');
    const cashOut = getNum('#cashOutAmount');
    const profit = getNum('#profitAmount');

    $('#cashInAmount').text(fmtAED(0));
    $('#cashOutAmount').text(fmtAED(0));
    $('#profitAmount').text(fmtAED(0));

    return Promise.all([
        animateNumberTo($('#cashInAmount'), cashIn, { duration: 900, fromValue: 0 }),
        animateNumberTo($('#cashOutAmount'), cashOut, { duration: 900, fromValue: 0 }),
        animateNumberTo($('#profitAmount'), profit, { duration: 900, fromValue: 0 })
    ]).then(() => localStorage.setItem('summaryKpiPlayed', '1'));
}

function renderCashInTable(cashInSources, precomputedGrand = null) {
    const $body = $('#cashInTableBody').empty();

    const rows = [];
    let grand = 0;

    const pushRow = (name, material = 0, shipping = 0, hasShipping = true) => {
        const m = Number(material || 0);
        const s = hasShipping === false ? 0 : Number(shipping || 0);
        const total = m + s;
        grand += total;
        rows.push({ name, m, s: hasShipping === false ? 0 : s, total });
    };

    // If you later provide per-customer lines (e.g., RH/FF/BL/WS)
    if (Array.isArray(cashInSources.customers)) {
        cashInSources.customers.forEach(c =>
            pushRow(c.name || 'Customer', c.material, c.shipping, c.hasShipping)
        );
    } else if (cashInSources.customer) {
        // single aggregated “Customer Sheets”
        const c = cashInSources.customer;
        pushRow(c.name || 'Customer Sheets', c.material, c.shipping, c.hasShipping);
    }

    if (cashInSources.us) {
        const u = cashInSources.us;
        pushRow(u.name || 'US Client Payment', u.material, 0, false);
    }
    if (cashInSources.sq) {
        const s = cashInSources.sq;
        pushRow(s.name || 'SQ Sheet', s.material, 0, false);
    }
    if (cashInSources.local) {
        const l = cashInSources.local;
        pushRow(l.name || 'Local Sales', l.material, 0, false);
    }

    // Build rows
    rows.forEach(r => {
        $body.append(`
      <tr>
        <td class="px-4 py-3 text-gray-700">${r.name}</td>
        <td class="px-4 py-3 text-right">${fmtAED(r.m)}</td>
        <td class="px-4 py-3 text-right">${fmtAED(r.s)}</td>
        <td class="px-4 py-3 text-right font-semibold">${fmtAED(r.total)}</td>
      </tr>
    `);
    });

    // Grand total
    const gt = precomputedGrand != null ? precomputedGrand : grand;
    $('#cashInTableGrand').text(fmtAED(gt));
}

function fetchCustomerSheetsRows() {
    return $.getJSON('/summary/customer-sheets/rows', { _t: Date.now() })
        .then(res => {
            // Accept either `{rows:[...]}` or plain array `[...]`
            const arr = Array.isArray(res?.rows) ? res.rows : (Array.isArray(res) ? res : []);
            // Normalize fields + numbers to be safe
            const rows = arr.map(r => ({
                name: r.name || r.sheet || '-',                 // display label
                material: Number(r.material) || 0,
                shipping: Number(r.shipping) || 0,
            }));
            return { rows };
        })
        .catch(xhr => {
            console.error('rows fetch failed:', xhr.status, xhr.responseText);
            return { rows: [] };
        });
}

function ensureKpiStickyBackdrop() {
    if (window.__kpiStickyBound) return;         // bind once
    const row = document.getElementById('kpiSticky');
    if (!row) return;                             // summary not mounted yet

    window.__kpiStickyBound = true;

    const sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    row.parentNode.insertBefore(sentinel, row);

    const io = new IntersectionObserver(([entry]) => {
        const stuck = entry.intersectionRatio === 0;
        row.classList.toggle('is-stuck', stuck);
    }, { threshold: [0, 1] });

    io.observe(sentinel);
}

function renderLoanOutstanding(rows) {
    const numAE = window.gtsFmt?.numAE || (n =>
        (Number(n) || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
    const aed = window.gtsFmt?.aed || (n => 'AED ' + numAE(n));

    const $sec = $('#loanOutstandingSection');
    const $body = $('#loanOutstandingBody').empty();
    $sec.removeClass('hidden');

    if (!Array.isArray(rows)) rows = [];

    // sort purely by name or by magnitude if you like; here keep by name
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    if (rows.length === 0) {
        $body.append(`<tr><td colspan="2" class="px-4 py-3 text-gray-600">No customer sheets found.</td></tr>`);
        $('#loanOutstandingGrand').text(aed(0));
        return;
    }

    // signed grand total (no filtering): e.g. -75809.50 + 1000 = -74809.50
    let grand = 0;

    rows.forEach(r => {
        const rem = Number(r.remaining || 0);
        grand += rem;

        // no color classes on rows now
        $body.append(`
      <tr>
        <td class="px-4 py-3 text-gray-700">${r.name}</td>
        <td class="px-4 py-3 text-right">${numAE(rem)}</td>
      </tr>
    `);
    });

    // footer remains blue via your blade class; just set the value:
    $('#loanOutstandingGrand').text(aed(grand));
}

// Read remaining balances already rendered in each customer sheet section
function collectLoanOutstandingFromDOM() {
    const rows = [];

    $('.sheet-section').each(function () {
        const $sec = $(this);

        // 1) Prefer explicit data attribute
        let name = ($sec.data('sheetName') || $sec.data('sheet-name') || '').toString().trim();

        // 2) Infer from id="sheet-customer-XXXX"
        if (!name) {
            const id = $sec.attr('id') || '';
            const m = id.match(/^sheet-customer-([a-z0-9_-]+)$/i);
            if (m) name = m[1].toUpperCase();
        }

        // 3) As LAST resort, only use a heading if it starts with "Customer Sheet:"
        if (!name) {
            const h = ($sec.find('h2').first().text() || '').trim();
            const m2 = h.match(/^Customer Sheet:\s*(.+)$/i);
            if (m2) name = m2[1].trim();
        }

        if (!name) name = 'UNKNOWN';

        // Read remaining balance value from the section
        const $rem = $sec.find('[id^="remainingBalance-"]').first();
        if (!$rem.length) return;

        const rem = parseFloat(($rem.text() || '').replace(/[^\d.-]/g, '')) || 0;
        if (rem > 0) rows.push({ name, remaining: rem });
    });

    rows.sort((a, b) => b.remaining - a.remaining);
    return rows;
}

function fetchLoanOutstandingRows() {
    const url = (window.routes && window.routes.loanOutstanding)
        || '/summary/customer-sheets/loans'; // fallback
    return $.ajax({
        url,
        data: { _t: Date.now() },
        dataType: 'json',
        cache: false
    }).fail((xhr) => {
        console.error('loan rows fetch failed:', xhr.status, xhr.responseText);
    });
}

function refreshLoanOutstandingHybrid() {
    fetchLoanOutstandingRows()
        .done(res => {
            const apiRows = Array.isArray(res?.rows) ? res.rows : [];
            if (apiRows.length) {
                renderLoanOutstanding(apiRows);
            } else {
                renderLoanOutstanding(collectLoanOutstandingFromDOM());
            }
        })
        .fail(() => {
            renderLoanOutstanding(collectLoanOutstandingFromDOM());
        });
}

(function (w) {
    w.gtsFmt = w.gtsFmt || {};
    if (typeof w.gtsFmt.numAE !== 'function') {
        w.gtsFmt.numAE = n => (Number(n) || 0).toLocaleString('en-AE', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }
    if (typeof w.gtsFmt.aed !== 'function') {
        w.gtsFmt.aed = n => 'AED ' + w.gtsFmt.numAE(n);
    }
    if (typeof w.gtsFmt.fmtAED !== 'function') {
        w.gtsFmt.fmtAED = w.gtsFmt.numAE; // numbers-only alias
    }
})(window);

function unhideAncestors($el) {
    $el.parents().each(function () {
        const $p = $(this);
        if ($p.css('display') === 'none') $p.css('display', 'block');
        $p.removeClass('hidden');
    });
}

// Beneficiary Sheet Logic

let benInited = false;
let benFirstPaintDone = false;

function initBenLogic() {
    if (benInited) return;
    // Guard: sheet HTML not mounted yet? bail and try again later.
    // (You can check the wrapper or a specific form. Wrapper is more robust.)
    if (!document.getElementById('sheet-beneficiary')) return;
    // or: if (!document.getElementById('benFormSH1')) return;

    benInited = true;

    // Submit handlers (delegated so it works if DOM is re-rendered)
    $(document)
        .off('submit.ben', '#benFormSH1')
        .on('submit.ben', '#benFormSH1', function (e) {
            e.preventDefault();
            submitBenForm($(this));
        });

    $(document)
        .off('submit.ben', '#benFormSH2')
        .on('submit.ben', '#benFormSH2', function (e) {
            e.preventDefault();
            submitBenForm($(this));
        });

    // If other sheets fire total updates, refresh profit when this tab is visible
    $(document)
        .off('us:totalsUpdated.ben sq:totalsUpdated.ben localSales:updated.ben customerSheets:totalsUpdated.ben')
        .on('us:totalsUpdated.ben sq:totalsUpdated.ben localSales:updated.ben customerSheets:totalsUpdated.ben', function () {
            if ($('#sheet-beneficiary').is(':visible')) computeAndRenderProfit();
        });

    // Edit / Save / Cancel
    $(document)
        .off('click.ben', '.ben-edit')
        .on('click.ben', '.ben-edit', function () {
            enterBenEdit($(this).closest('tr'));
        });

    $(document)
        .off('click.ben', '.ben-cancel')
        .on('click.ben', '.ben-cancel', function () {
            cancelBenEdit($(this).closest('tr'));
        });

    $(document)
        .off('click.ben', '.ben-save')
        .on('click.ben', '.ben-save', function () {
            saveBenEdit($(this).closest('tr'));
        });

    // Delete → open modal (no alerts)
    $(document)
        .off('click.ben', '.ben-del')
        .on('click.ben', '.ben-del', function () {
            openBenDeleteModal($(this).closest('tr'));
        });

    // Modal buttons
    $(document)
        .off('click.ben', '#benDelCancel, #benDelClose')
        .on('click.ben', '#benDelCancel, #benDelClose', closeBenDeleteModal);

    $(document)
        .off('click.ben', '#benDelConfirm')
        .on('click.ben', '#benDelConfirm', function () {
            if (!benDeleteId) return;
            deleteBenRow(benDeleteId).always(closeBenDeleteModal);
        });

    $(document)
        .off('input.benAutosize', '.ben-autosize-num')
        .on('input.benAutosize', '.ben-autosize-num', function () {
            benAutosizeNumber(this);
        });

    // Recompute charity KPI when other totals change (if visible)
    $(document)
        .off('us:totalsUpdated.ben2 sq:totalsUpdated.ben2 localSales:updated.ben2 customerSheets:totalsUpdated.ben2')
        .on('us:totalsUpdated.ben2 sq:totalsUpdated.ben2 localSales:updated.ben2 customerSheets:totalsUpdated.ben2', function () {
            if ($('#sheet-beneficiary').is(':visible')) computeAndRenderProfit();
        });

    // First paint: wait for BOTH data + KPIs, then render once
    $.when(loadBeneficiaries(), computeAndRenderProfit()).done(function () {
        benRenderAllocTable();      // single, clean initial render (no zero flicker)
        benFirstPaintDone = true;   // subsequent updates re-render on their own
    });
}

// ---------- small helpers ----------
const benFmtAED = n => 'AED ' + (Number(n) || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const benEsc = s => String(s ?? '').replace(/</g, '&lt;');
const pickNum = v => { const n = parseFloat(String(v || '').replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; };

const BEN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BEN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function benDate(dStr) {
    if (!dStr) return '';
    const d = new Date(dStr);
    if (isNaN(d)) return dStr;
    const wk = BEN_WEEKDAYS[d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0');
    const mon = BEN_MONTHS[d.getMonth()];
    return `${wk} ${dd} ${mon} ${d.getFullYear()}`;
}

// ---------- renderers ----------
function renderBenTable($tbody, rows) {
    $tbody.empty();
    if (!rows || rows.length === 0) {
        $tbody.append(`<tr><td colspan="7" class="px-4 py-4 text-center text-gray-500">No entries yet.</td></tr>`);
        return;
    }
    rows.forEach((r, i) => {
        const iso = r.date || ''; // keep raw ISO for editing
        $tbody.append(`
      <tr data-id="${r.id}" data-raw-date="${iso}" data-type="${(r.type || '').toLowerCase()}" data-charity="${r.charity || 0}">
        <td class="px-4 py-3">${i + 1}</td>
        <td class="px-4 py-3 ben-cell-date">${benEsc(benDate(iso))}</td>
        <td class="px-4 py-3 ben-cell-type">${benTypeBadge(r.type)}</td>
        <td class="px-4 py-3 text-right ben-cell-amount">${benFmtAED(Number(r.amount || 0))}</td>
        <td class="px-4 py-3 text-right ben-cell-charity">${benFmtAED(Number(r.charity || 0))}</td>
        <td class="px-4 py-3 ben-cell-remark">${benEsc(r.remarks || '')}</td>
        <td class="px-4 py-3 text-center">
          <div class="flex items-center justify-center gap-2">
            <button class="ben-edit p-1 rounded text-green-600 hover:bg-gray-100" title="Edit"><i class="bi bi-pencil-square"></i></button>
            <button class="ben-save p-1 rounded bg-green-600 hover:bg-green-700 text-white hidden" title="Save"><i class="bi bi-check2"></i></button>
            <button class="ben-cancel p-1 rounded bg-gray-600 hover:bg-gray-700 text-white hidden" title="Cancel"><i class="bi bi-x-lg"></i></button>
            <button class="ben-del p-1 rounded hover:bg-red-50 text-red-600" title="Delete"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>
    `);
    });
}

// ---------- data loads (beneficiaries) ----------
function loadBeneficiaries() {
    return $.getJSON('/beneficiaries/data', { _t: Date.now() }).done(data => {
        renderBenTable($('#benBodySH1'), data?.shareholder1?.rows || []);
        renderBenTable($('#benBodySH2'), data?.shareholder2?.rows || []);

        // Entries totals (sum of Amount column for each shareholder)
        const sh1EntriesTotal =
            (data && data.shareholder1 && typeof data.shareholder1.total === 'number')
                ? data.shareholder1.total
                : (data?.shareholder1?.rows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

        const sh2EntriesTotal =
            (data && data.shareholder2 && typeof data.shareholder2.total === 'number')
                ? data.shareholder2.total
                : (data?.shareholder2?.rows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

        $('#benSH1EntriesTotal').text(benFmtAED(sh1EntriesTotal));
        $('#benSH2EntriesTotal').text(benFmtAED(sh2EntriesTotal));

        const sh1CharityTotal =
            (data?.shareholder1?.rows || []).reduce((s, r) => s + (Number(r.charity) || 0), 0);
        const sh2CharityTotal =
            (data?.shareholder2?.rows || []).reduce((s, r) => s + (Number(r.charity) || 0), 0);

        $('#benSH1CharityTotal').text(benFmtAED(sh1CharityTotal));
        $('#benSH2CharityTotal').text(benFmtAED(sh2CharityTotal));

        $(document).trigger('beneficiaries:updated');
        if (benFirstPaintDone) benRenderAllocTable(); // render later updates only
    });
}

function submitBenForm($form) {
    const fd = $form.serialize();
    return $.ajax({
        url: '/beneficiaries',
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
        data: fd
    }).done(() => {
        $form[0].reset();
        loadBeneficiaries();
        computeAndRenderProfit(); // optional: profit might depend on payouts, keep fresh
    }).fail(xhr => {
        alert(xhr?.responseJSON?.message || 'Failed to add entry');
    });
}

let benDeleteId = null;

function openBenDeleteModal($tr) {
    benDeleteId = $tr.data('id');
    $('#benDelDate').text($tr.find('.ben-cell-date').text().trim());
    $('#benDelAmount').text($tr.find('.ben-cell-amount').text().trim());
    $('#benDelRemark').text($tr.find('.ben-cell-remark').text().trim());
    $('#benDeleteModal').removeClass('hidden').addClass('flex');
}

function closeBenDeleteModal() {
    benDeleteId = null;
    $('#benDeleteModal').addClass('hidden').removeClass('flex');
}

function deleteBenRow(id) {
    return $.ajax({
        url: '/beneficiaries/' + id,
        method: 'DELETE',
        headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') }
    }).done(() => {
        loadBeneficiaries();
        computeAndRenderProfit();
    }).fail(() => alert('Failed to delete entry.'));
}

function enterBenEdit($tr) {
    if ($tr.data('editing')) return;
    $tr.data('editing', 1);

    const rawDate = $tr.data('rawDate'); // jQuery maps data-raw-date -> rawDate
    const amount = pickNum($tr.find('.ben-cell-amount').text());
    const charity = Number($tr.data('charity') || 0);
    const remarks = $tr.find('.ben-cell-remark').text().trim();
    const type = ($tr.data('type') || '').toLowerCase();

    $tr.find('.ben-cell-date').html(
        `<input type="date" class="ben-edit-date w-auto border rounded-xl px-3 py-2
                              focus:border-blue-500 focus:ring-2 focus:ring-blue-200" style="min-width:16ch" value="${rawDate || ''}">`
    );

    // modern dropdown in edit cell
    $tr.find('.ben-cell-type').html(benTypeFieldHtml(type, 'ben-edit-type'));
    hydrateBenSelect($tr);  // set label & highlight

    // amount — auto width based on value length
    const amountStr = Number.isFinite(amount) ? amount.toFixed(2) : String(amount || 0);
    const amountCh = Math.max(18, amountStr.length + 4);
    $tr.find('.ben-cell-amount').html(
        `<input type="number" step="0.01" inputmode="decimal"
            class="ben-edit-amount ben-autosize-num w-autol border rounded-xl px-3 py-2 text-right
                   focus:border-blue-500 focus:ring-2 focus:ring-blue-200" style="width:${amountCh}ch" value="${amountStr}">`
    );

    // charity — auto width based on value length
    const charityStr = Number.isFinite(charity) ? charity.toFixed(2) : String(charity || 0);
    const charityCh = Math.max(16, charityStr.length + 4);
    $tr.find('.ben-cell-charity').html(
        `<input type="number" step="0.01" inputmode="decimal"
        class="ben-edit-charity ben-autosize-num w-auto border rounded-xl px-3 py-2 text-right
                focus:border-blue-500 focus:ring-2 focus:ring-blue-200" style="width:${charityCh}ch" value="${charityStr}">`
    );

    $tr.find('.ben-cell-remark').html(
        `<input type="text"
            class="ben-edit-remarks w-full border rounded-xl px-3 py-2
                   focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            value="${benEsc(remarks).replace(/"/g, '&quot;')}">`
    );

    $tr.find('.ben-edit, .ben-del').addClass('hidden');
    $tr.find('.ben-save, .ben-cancel').removeClass('hidden');
}

// autosize number inputs as user types
function benAutosizeNumber(el) {
    const base = parseInt(el.getAttribute('data-basech') || '16', 10);
    const v = (el.value || '').toString();
    const ch = Math.max(base, v.length + 4);   // a bit of padding
    el.style.width = ch + 'ch';
}

function cancelBenEdit($tr) {
    // simplest: reload the list to restore view state
    $tr.data('editing', 0);
    loadBeneficiaries();
}

function saveBenEdit($tr) {
    const id = $tr.data('id');
    const payload = {
        date: ($tr.find('.ben-edit-date').val() || '').trim(),
        type: ($tr.find('.ben-edit-type input[name="type"]').val() || 'cash'),
        amount: Number($tr.find('.ben-edit-amount').val() || 0),
        charity: Number($tr.find('.ben-edit-charity').val() || 0),
        remarks: ($tr.find('.ben-edit-remarks').val() || '').trim(),
    };

    return $.ajax({
        url: '/beneficiaries/' + id,
        method: 'PUT',
        data: payload,
        headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') }
    }).done(() => {
        $tr.data('editing', 0);
        loadBeneficiaries();
        computeAndRenderProfit();
    }).fail(xhr => {
        // keep inline; no alert requested — you can show a subtle error if you want
        console.error('Update failed', xhr?.responseJSON || xhr);
    });
}

// ---------- totals for Profit (fast with cache, with API fallbacks) ----------
function getLocalSalesCached() {
    try {
        const v = localStorage.getItem('localSalesTotal');
        return v !== null ? (Number(v) || 0) : null;
    } catch { return null; }
}

function fetchCashOutTotals() {
    // summary-data returns total_purchase_of_material + total_shipping_cost
    return $.getJSON('/summary-data').then(d => ({
        material: Number(d?.total_purchase_of_material || 0),
        shipping: Number(d?.total_shipping_cost || 0)
    })).catch(() => ({ material: 0, shipping: 0 }));
}

function fetchCustomerSheetsTotals() {
    return $.getJSON('summary/customer-sheets/totals', { _t: Date.now() })
        .then(d => ({
            material: Number(d?.material || 0),
            shipping: Number(d?.shipping || 0)
        }))
        .catch(() => ({ material: 0, shipping: 0 }));
}

function getUsCached() {
    // if you cache US somewhere else, read here; otherwise null
    try {
        const raw = localStorage.getItem('usTotal');
        if (raw != null) return pickNum(raw);
    } catch { }
    return null;
}
function fetchUsTotal() {
    // falls back to existing endpoint that includes totalAmount
    return $.getJSON('/us-client/data')
        .then(d => Number(d?.totalAmount) || 0).catch(() => 0);
}

// Compute and render Total Profit (Cash In - Cash Out)
function computeAndRenderProfit() {
    // cashOut: prefer cached gtsTotals
    const gts = getGtsTotalsFromStorage();
    const cashOutPromise = (gts)
        ? $.Deferred().resolve({ material: gts.material, shipping: gts.shipping }).promise()
        : fetchCashOutTotals();

    // cashIn parts: local, sq, us, customer sheets
    const localCached = getLocalSalesCached();
    const localP = (localCached !== null) ? $.Deferred().resolve(localCached).promise() : fetchLocalSalesTotal();

    const sqCached = getSqCached();
    const sqP = (sqCached !== null) ? $.Deferred().resolve(sqCached).promise() : fetchSqTotal();

    const usCached = getUsCached();
    const usP = (usCached !== null) ? $.Deferred().resolve(usCached).promise() : fetchUsTotal();

    const custP = fetchCustomerSheetsTotals(); // {material, shipping}

    $.when(cashOutPromise, localP, sqP, usP, custP).done(function (co, localAmt, sqAmt, usAmt, cust) {
        const cashOut = Number(co.material || 0) + Number(co.shipping || 0);
        const customerIn = Number(cust.material || 0) + Number(cust.shipping || 0);
        const cashIn = Number(localAmt || 0) + Number(sqAmt || 0) + Number(usAmt || 0) + customerIn;
        const profit = cashIn - cashOut;

        // cache US (nice-to-have)
        try {
            localStorage.setItem('usTotal', String(Number(usAmt || 0)));
        } catch { }

        $('#benTotalProfit').text(benFmtAED(profit));

        // Charity is 5% of profit
        const charityValue = Math.max(0, profit * 0.05);
        $('#benCharityKpi').text(benFmtAED(charityValue));

        // Each shareholder gets (profit - charity)/2
        const eachShare = Math.max(0, (profit - charityValue) / 2);

        // Top cards
        $('#benSH1Balance').text(benFmtAED(eachShare));
        $('#benSH2Balance').text(benFmtAED(eachShare));

        // Inline blocks under the add buttons
        $('#benSH1InlineBalance').text(benFmtAED(eachShare));
        $('#benSH2InlineBalance').text(benFmtAED(eachShare));

        if (benFirstPaintDone) benRenderAllocTable();
        renderBenPieChart();
    });
}

// === Allocation model (percent only; allocated comes from KPIs) ===
const BEN_ALLOC = {
    sh1: { label: 'Shareholder 1', percent: 47.5 },
    sh2: { label: 'Shareholder 2', percent: 47.5 },
    charity: { label: 'Charity', percent: 5 },
};

// Row color classes (file scope)
const BEN_ROW_CLASSES = {
    sh1: 'bg-amber-50 hover:bg-amber-100/60',
    sh2: 'bg-violet-50 hover:bg-violet-100/60',
    charity: 'bg-emerald-50 hover:bg-emerald-100/60',
};

function benRenderAllocTable() {
    const $body = $('#benAllocBody');
    if (!$body.length) return;
    $body.empty();

    const parseAED = (t) => parseFloat(String(t || '').replace(/[^\d.-]/g, '')) || 0;
    const txt = (sel) => ($(sel).length ? $(sel).text() : '');
    const fmt = benFmtAED;

    // Allocated (from KPI cards)
    const sh1Allocated = parseAED(txt('#benSH1Balance'));
    const sh2Allocated = parseAED(txt('#benSH2Balance'));
    const charityAllocated = parseAED(txt('#benCharityKpi')); // full 5%

    // Withdrawn (derived from tables)
    const sh1Withdrawn = parseAED(txt('#benSH1EntriesTotal'));
    const sh2Withdrawn = parseAED(txt('#benSH2EntriesTotal'));

    // Charity withdrawn = SH1 charity total + SH2 charity total
    let ch1 = parseAED(txt('#benSH1CharityTotal'));
    if (!ch1) {
        ch1 = 0;
        $('#benBodySH1 .ben-cell-charity').each(function () { ch1 += parseAED($(this).text()); });
    }
    let ch2 = parseAED(txt('#benSH2CharityTotal'));
    if (!ch2) {
        ch2 = 0;
        $('#benBodySH2 .ben-cell-charity').each(function () { ch2 += parseAED($(this).text()); });
    }
    const charityWithdrawn = ch1 + ch2;

    const rowCls = (k) => BEN_ROW_CLASSES[k] || '';
    const mkRow = (label, percent, allocated, withdrawn, cls = '') => {
        const balance = (allocated || 0) - (withdrawn || 0);
        const balCls = balance < 0 ? 'text-red-600' : 'text-gray-800';
        return `
      <tr class="${cls}">
        <td class="px-4 py-3">${label}</td>
        <td class="px-4 py-3 text-right">${percent}%</td>
        <td class="px-4 py-3 text-right">${fmt(allocated)}</td>
        <td class="px-4 py-3 text-right">${fmt(withdrawn)}</td>
        <td class="px-4 py-3 text-right ${balCls}">${fmt(balance)}</td>
      </tr>`;
    };

    // Final 3 rows
    $body.append(mkRow('Shareholder 1', 47.5, sh1Allocated, sh1Withdrawn, rowCls('sh1')));
    $body.append(mkRow('Shareholder 2', 47.5, sh2Allocated, sh2Withdrawn, rowCls('sh2')));
    $body.append(mkRow('Charity', 5, charityAllocated, charityWithdrawn, rowCls('charity')));
}

function benTypeLabel(t) {
    switch ((t || '').toLowerCase()) {
        case 'cash': return 'Cash';
        case 'bank_transfer': return 'Bank transfer';
        case 'adjustment': return 'Adjustment';
        default: return '—';
    }
}

function benTypeBadge(t) {
    const map = {
        cash: 'bg-yellow-100 text-yellow-800',
        bank_transfer: 'bg-blue-100 text-blue-800',
        adjustment: 'bg-purple-100 text-purple-800'
    };
    const cls = map[(t || '').toLowerCase()] || 'bg-gray-100 text-gray-800';
    return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${cls}">${benTypeLabel(t)}</span>`;
}

// Build the same modern dropdown for inline edit cells
function benTypeFieldHtml(value = 'cash', extraClass = '') {
    return `
    <div class="ben-select ${extraClass} relative" data-name="type">
      <input type="hidden" name="type" value="${(value || 'cash')}">
      <button type="button"
              class="ben-sel-btn w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-3 pr-10
                     text-gray-800 shadow-sm text-left
                     focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
        <span class="ben-sel-label"></span>
        <svg class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
             viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                clip-rule="evenodd" />
        </svg>
      </button>
      <div class="ben-sel-menu hidden absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
        <button type="button" class="ben-sel-opt w-full px-3 py-2 text-left hover:bg-gray-50" data-value="cash">Cash</button>
        <button type="button" class="ben-sel-opt w-full px-3 py-2 text-left hover:bg-gray-50" data-value="bank_transfer">Bank transfer</button>
        <button type="button" class="ben-sel-opt w-full px-3 py-2 text-left hover:bg-gray-50" data-value="adjustment">Adjustment</button>
      </div>
    </div>`;
}

// Hydrate labels & active option
function hydrateBenSelect(root = document) {
    $('.ben-select', root).each(function () {
        const $sel = $(this);
        const val = $sel.find('input[type="hidden"]').val() || 'cash';
        const $opt = $sel.find(`.ben-sel-opt[data-value="${val}"]`);
        $sel.find('.ben-sel-label').text($opt.text().trim() || 'Select');
        $sel.find('.ben-sel-opt').removeClass('bg-gray-100');
        $opt.addClass('bg-gray-100');
    });
}

// Bind once (delegated)
(function bindBenSelectOnce() {
    if (window.__benSelectBound) return;
    window.__benSelectBound = true;

    // Toggle menu
    $(document).on('click', '.ben-sel-btn', function (e) {
        e.stopPropagation();
        const $sel = $(this).closest('.ben-select');
        $('.ben-select.open').not($sel).removeClass('open').find('.ben-sel-menu').addClass('hidden');
        $sel.toggleClass('open');
        $sel.find('.ben-sel-menu').toggleClass('hidden');
    });

    // Pick option
    $(document).on('click', '.ben-sel-opt', function () {
        const $opt = $(this);
        const $sel = $opt.closest('.ben-select');
        const val = $opt.data('value');
        const label = $opt.text().trim();

        $sel.find('input[type="hidden"]').val(val).trigger('change');
        $sel.find('.ben-sel-label').text(label);
        $sel.find('.ben-sel-opt').removeClass('bg-gray-100');
        $opt.addClass('bg-gray-100');

        $sel.removeClass('open');
        $sel.find('.ben-sel-menu').addClass('hidden');
    });

    // Close on outside click
    $(document).on('click', function () {
        $('.ben-select.open').removeClass('open').find('.ben-sel-menu').addClass('hidden');
    });

    // Initial hydration on page load
    $(function () { hydrateBenSelect(document); });
})();

function ensureApexCharts(cb) {
    if (window.ApexCharts) return cb();
    let s = document.getElementById('apexcharts-cdn');
    if (!s) {
        s = document.createElement('script');
        s.id = 'apexcharts-cdn';
        s.src = 'https://cdn.jsdelivr.net/npm/apexcharts';
        document.head.appendChild(s);
    }
    s.addEventListener('load', () => cb());
    s.addEventListener('error', () => {
        console.warn('ApexCharts failed to load.');
        cb(false);
    });
}

function renderBenPieChart() {
    const $wrap = $('#benPieWrap');
    if (!$wrap.length) return;
    if (!$('#sheet-beneficiary').is(':visible')) return;

    const sh1 = pickNum($('#benSH1Balance').text());
    const sh2 = pickNum($('#benSH2Balance').text());
    const charity = pickNum($('#benCharityKpi').text());

    const series = [sh1, sh2, charity];
    const hasData = series.some(v => v > 0);

    ensureApexCharts(() => {
        if (!window.ApexCharts) return;

        // If a chart exists, just update it (no flicker).
        if (window.__benPie) {
            if (hasData) {
                window.__benPie.updateSeries(series, true);
            }
            return;
        }

        // No chart yet: only create it once we have real data (prevents first-paint flicker).
        if (!hasData) return;

        if (!$wrap.find('#benPie').length) {
            $wrap.append('<div id="benPie" class="w-full h-[260px]"></div>');
        }

        const options = {
            chart: { type: 'pie', height: 260, toolbar: { show: false }, animations: { enabled: true } },
            series,
            labels: ['Shareholder 1', 'Shareholder 2', 'Charity'],
            legend: { position: 'bottom' },
            dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(1)}%` },
            colors: ['#F59E0B', '#8B5CF6', '#10B981'], // amber, violet, emerald
            stroke: { width: 0 },
            tooltip: {
                y: {
                    formatter: (v) => 'AED ' + Number(v || 0).toLocaleString('en-AE', {
                        minimumFractionDigits: 2, maximumFractionDigits: 2
                    })
                }
            }
        };

        window.__benPie = new ApexCharts(document.querySelector('#benPie'), options);
        window.__benPie.render();
    });
}

// ---- Customer sheet tab rendering (inline or dropdown) ----

function getCustomerSheetsFromDOM() {
    // We assume each customer sheet section has id="sheet-customer-<slug>"
    const arr = [];
    $('[id^="sheet-customer-"]').each(function () {
        const fullId = this.id;             // "sheet-customer-XYZ"
        const sheet = fullId.slice('sheet-'.length); // "customer-XYZ"  <-- matches data-sheet needed
        let label = sheet.replace(/^customer-/, '').replace(/[-_]+/g, ' ').trim();
        if (label) label = label.toUpperCase();
        else label = 'CUSTOMER';
        arr.push({ sheet, label });
    });
    return arr;
}

function renderCustomerTabs() {
    const $wrap = $('#customerTabsContainer');
    if (!$wrap.length) return;

    const items = getCustomerSheetsFromDOM();
    $wrap.empty();

    if (items.length === 0) return;

    if (items.length <= 4) {
        // Inline buttons
        items.forEach(({ sheet, label }) => {
            $wrap.append(
                `<button class="sheet-tab px-4 py-2 text-sm font-medium hover:bg-gray-100"
                 data-sheet="${sheet}">${label}</button>`
            );
        });
        return;
    }

    // Dropdown (opens upwards)
    const activeSheet = localStorage.getItem('activeSheet');
    const selected = items.find(x => x.sheet === activeSheet);
    const btnLabel = selected ? selected.label : 'Customer Sheets';

    $wrap.html(`
    <div class="relative">
      <button id="custDropBtn" type="button"
        class="px-4 py-2 text-sm font-medium hover:bg-gray-100"
        aria-haspopup="true" aria-expanded="false">
        ${btnLabel}
        <i class="bi bi-caret-up-fill ml-1"></i>
      </button>

      <div id="custDropMenu"
           class="hidden absolute bottom-full mb-2 left-0 right-0
                  bg-white border shadow-lg rounded-md max-h-56 overflow-auto z-50">
        ${items.map(x => `
          <button class="sheet-tab block w-full text-left px-4 py-2 hover:bg-gray-50"
                  data-sheet="${x.sheet}">
            ${x.label}
          </button>
        `).join('')}
      </div>
    </div>
  `);
}