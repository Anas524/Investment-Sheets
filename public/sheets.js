// =======================
// GTS Investment Sheet JS
// =======================

const activeSheet = localStorage.getItem('activeSheet') || 'gts';

const sheetHeaders = {
    gts: {
        title: 'GTS Investment',
        icon: '/images/sub-logo.png',
    },
    us: {
        title: 'US Client Payment',
        icon: '/images/us-client-icon.png',
    },
    sq: {
        title: 'SQ Sheet',
        icon: '/images/sq-sheet-icon.png',
    },
    rh: {
        title: 'RH Sheet',
        icon: '/images/rh-sheet-icon.png',
    },
    ff: {
        title: 'FF Sheet',
        icon: '/images/ff-sheet-icon.png',
    },
    bl: {
        title: 'BL Sheet',
        icon: '/images/bl-sheet-icon.png',
    },
    ws: {
        title: 'WS Sheet',
        icon: '/images/ws-sheet-icon.png',
    },
    local: {
        title: 'Local Sales',
        icon: '/images/local-sales-icon.png',
    },
    summary: {
        title: 'Summary Sheet',
        icon: '/images/summary-sheet-icon.png',
    }
};

let selectedRowIndex = -1;
let currentAttachRow = null;
let pdfHtmlContent = '';

let selectedInvoice = '';
let selectedRowId = null;

let editingInvoice = '';

let multiEntryData = [];
let totalSteps = 0;
let currentStep = 0;

let manualMultiEntryIndex = null;

// US Sheet
let originalUSClients = [];

// SQ Sheet
let originalSQClients = [];

// RH Sheet
let editingRHSubSerial = null;
let originalRHClients = [];
let editingRHId = null;

let rhLoanEntries = [];
let editingLoanId = null;

// FF Sheet
let editingFFSubSerial = null;
let originalFFClients = [];
let editingFFId = null;

// BL Sheet
let editingBLSubSerial = null;
let originalBLClients = [];
let editingBLId = null;

$(document).ready(function () {

    $('.sheet-tab').on('click', function (e) {
        e.preventDefault();

        const sheet = $(this).data('sheet');
        localStorage.setItem('activeSheet', sheet);

        $('.sheet-tab').removeClass('active btn-primary text-light').addClass('btn-outline-secondary text-dark');
        $(this).addClass('active btn-primary text-light').removeClass('btn-outline-secondary text-dark');

        $('[id^="sheet-"]').hide();
        $(`#sheet-${sheet}`).show();

        const header = sheetHeaders[sheet];
        $('#headerTitle').text(header.title);
        $('#headerIcon').attr('src', header.icon);

        if (sheet === 'us') {
            loadUSClients();
        } else if (sheet === 'sq') {
            loadSQClients();
        } else if (sheet === 'rh') {
            loadRHClients();
            initRHLogic();
        } else if (sheet === 'ff') {
            loadFFClients();
            initFFLogic();
        } else if (sheet === 'bl') {
            loadBLClients();
            initBLLogic();
        } else if (sheet === 'ws') {
            loadBLClients();
            initBLLogic();
        } else if (sheet === 'local') {
            loadLocalSales();
            initLocalLogic();
        } else if (sheet === 'summary') {
            loadSummarySheet();
            loadCashInBreakdown();
            // initSummaryLogic();
        }
    });

    $(`.sheet-tab[data-sheet="${activeSheet}"]`).click();

    $(document).on('click', '.delete-btn', function () {
        const $row = $(this).closest('tr');
        selectedInvoice = $row.find('td:eq(4)').text().trim();
        selectedRowId = $row.data('id');

        const isMultiple = $row.find('td:eq(6)').html().includes('<br>'); // Check merged content in description

        if (isMultiple) {
            $('#deleteMessage').html(`This is a multiple entry.<br><b>Invoice:</b> ${selectedInvoice}<br>Enter sub-serial number or type "all" to delete all rows.`);
            $('#subSerialInputWrapper').show();
        } else {
            $('#deleteMessage').text('Are you sure you want to delete this row?');
            $('#subSerialInputWrapper').hide();
        }

        $('#deleteConfirmModal').modal('show');
    });

    $('#confirmDeleteBtn').on('click', function () {
        const isSubSerialInputVisible = $('#subSerialInputWrapper').is(':visible');
        const subSerial = $('#deleteSubSerialInput').val().trim().toLowerCase();

        let url = '';

        if (isSubSerialInputVisible) {
            if (!subSerial) {
                alert('Please enter a sub-serial number or "all".');
                return;
            }

            url = `/delete-investment-by-invoice/${encodeURIComponent(selectedInvoice)}?sub_serial=${subSerial}`;
        } else {
            if (!selectedRowId) {
                alert('Missing row ID. Cannot delete.');
                return;
            }

            url = `/delete-investment/${selectedRowId}`;
        }

        $.ajax({
            url: url,
            type: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
            },
            success: function () {
                location.reload();
            },
            error: function (xhr) {
                alert(xhr.responseJSON?.error || 'Failed to delete!');
            },
            complete: function () {
                $('#deleteConfirmModal').modal('hide');
                $('#deleteSubSerialInput').val('');
            }
        });
    });

    $(document).on('click', '.edit-btn', function () {
        const $row = $(this).closest('tr');
        const id = $row.data('id');
        const invoice = $row.find('td:eq(4)').text().trim();
        let subSerials = $row.data('subserials');

        if (typeof subSerials === 'string') {
            try {
                subSerials = JSON.parse(subSerials);
            } catch (e) {
                subSerials = [];
            }
        }

        if (Array.isArray(subSerials) && subSerials.length > 1) {
            // Show modal for sub-serial selection
            $('#editModalInvoice').val(invoice);
            $('#editSubSerialInput').val('');
            $('#editSubSerialModal').modal('show');
        } else {
            // Directly fetch single-entry row
            fetchAndFillEditForm(id);
        }
    });

    $('#confirmEditSubSerialBtn').on('click', function () {
        const invoice = $('#editModalInvoice').val().trim();
        const subSerial = $('#editSubSerialInput').val().trim();

        if (!invoice || !subSerial) {
            alert('Please enter sub-serial number.');
            return;
        }

        $.ajax({
            url: `/get-investment-by-invoice/${encodeURIComponent(invoice)}/${subSerial}`,
            type: 'GET',
            success: function (data) {
                if (!data || !data.id) {
                    alert("Sub-entry not found.");
                    return;
                }

                $('#editSubSerialModal').modal('hide');
                fetchAndFillEditForm(data.id);
            },
            error: function () {
                alert("Failed to fetch sub-entry.");
            }
        });
    });

    $(document).on('click', '.copy-btn', function () {
        const $row = $(this).closest('tr');
        const id = $row.data('id');
        const invoiceNumber = $row.find('td:eq(4)').text().trim();
        let subSerials = $row.data('subserials');

        // Parse subSerials if string
        if (typeof subSerials === 'string') {
            try {
                const parsed = JSON.parse(subSerials);
                if (Array.isArray(parsed)) {
                    subSerials = parsed;
                }
            } catch (e) {
                subSerials = [];
            }
        }

        if (Array.isArray(subSerials) && subSerials.length > 1) {
            // Multiple-entry row → ask which sub-entry to copy
            $('#copyModalInvoice').val(invoiceNumber);
            $('#copyModalInvoiceText').text(`Invoice: ${invoiceNumber}`);
            $('#copySubSerialInput').val('');
            $('#copySubSerialModal').modal('show');
        } else {
            // Normal row → copy directly
            $('#date').val($row.data('date'));
            $('#supplier').val($row.find('td:eq(2)').text().trim());
            $('#buyer').val($row.find('td:eq(3)').text().trim());
            $('#invoice').val($row.data('invoice'));
            $('#transaction').val($row.find('td:eq(5)').text().trim());
            $('#description').val($row.find('td:eq(6)').text().trim());
            $('#ctns').val($row.find('td:eq(7)').text().trim());
            $('#unitsPerCtn').val($row.find('td:eq(8)').text().trim());
            $('#unitPrice').val(parseFloat($row.find('td:eq(9)').text().replace(/[^\d.]/g, '')));
            $('#vatPercentage').val($row.data('vatpercentage'));
            $('#weight').val($row.find('td:eq(14)').text().trim());
            $('#shippingRatePerKg').val($row.data('shippingrate'));
            $('#remarks').val($row.find('td:eq(20)').text().trim());

            $('#investmentForm').removeData('edit-index').removeData('edit-id');
            $('#submitBtn').show();
            $('#saveChangesBtn').hide();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    $('#confirmCopySubSerialBtn').on('click', function () {
        const invoice = $('#copyModalInvoice').val().trim();
        const subSerial = $('#copySubSerialInput').val().trim();

        if (!invoice || !subSerial) {
            alert('Please enter a valid sub-serial number.');
            return;
        }

        $.ajax({
            url: `/get-investment-by-invoice/${encodeURIComponent(invoice)}/${subSerial}`,
            type: 'GET',
            success: function (data) {
                if (!data || !data.id) {
                    alert("Sub-entry not found.");
                    return;
                }

                $('#copySubSerialModal').modal('hide');

                // Fill form with copied values
                $('#date').val(data.date);
                $('#supplier').val(data.supplier_name);
                $('#buyer').val(data.buyer);
                $('#invoice').val(data.invoice_number);
                $('#transaction').val(data.transaction_mode);
                $('#description').val(data.description);
                $('#ctns').val(data.no_of_ctns);
                $('#unitsPerCtn').val(data.units_per_ctn);
                $('#unitPrice').val(data.unit_price);
                $('#vatPercentage').val(data.vat_percentage);
                $('#weight').val(data.weight);
                $('#shippingRatePerKg').val(data.shipping_rate_per_kg);
                $('#remarks').val(data.remarks);

                $('#investmentForm').removeData('edit-index').removeData('edit-id');
                $('#submitBtn').show();
                $('#saveChangesBtn').hide();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            },
            error: function () {
                alert("Failed to fetch sub-entry for copy.");
            }
        });
    });

    $(document).on('click', '.upload-btn', function () {
        currentAttachRow = $(this).closest('tr');
        const investmentId = currentAttachRow.data('id');
        $('#attachRowId').val(investmentId);
        $('#attachmentForm')[0].reset(); // Clear previous files
        $('#attachmentModal').modal('show');
    });

    $(document).on('click', '.view-btn', function () {
        const row = $(this).closest('tr');
        const id = row.data('id');

        $.ajax({
            url: `/get-attachments/${id}`,
            type: 'GET',
            success: function (data) {
                const container = $('#pdfContentForDownload');
                container.empty();

                const addImageBlock = (title, url) => {
                    if (!url) return '';

                    url = url.replace(/(attachments\/invoice\/)+/, 'attachments/invoice/');
                    url = url.replace(/(attachments\/receipt\/)+/, 'attachments/receipt/');
                    url = url.replace(/(attachments\/note\/)+/, 'attachments/note/');

                    return `
                            <div class="pdf-block">
                                <p class="pdf-title"><strong>${title}:</strong></p>
                                <img src="${url}" class="pdf-image" />
                            </div>
                        `;
                };

                let content = '';
                content += addImageBlock("Invoice", data.invoice);
                content += addImageBlock("Bank Transfer Receipt", data.receipt);
                content += addImageBlock("Delivery Note", data.note);

                container.html(content);
                $('#viewAttachmentModal').modal('show');
            },
            error: function () {
                alert("Failed to fetch attachments.");
            }
        });
    });

    $.ajaxSetup({
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        }
    });

    $('#investmentForm').on('submit', function (e) {
        e.preventDefault();

        const ctns = parseFloat($('#ctns').val()) || 0;
        const unitsPerCtn = parseFloat($('#unitsPerCtn').val()) || 0;
        const totalUnits = ctns * unitsPerCtn;

        // If totalUnits is 0, ask user to enter manually
        if (totalUnits === 0) {
            $('#manualUnitsModal').modal('show');
            return; // Stop here until manual entry is provided
        }

        // Otherwise, set the hidden field and trigger manual-submit
        $('#totalUnitsHidden').val(totalUnits);
        $('#investmentForm').trigger('manual-submit');
    });
    $('#investmentForm').on('manual-submit', function (e) {
        e.preventDefault();

        const invoice = $('#invoice').val().trim();
        const editIndex = $(this).data('edit-index');

        const date = $('#date').val();
        const supplier = $('#supplier').val();
        const buyer = $('#buyer').val();
        const transaction = $('#transaction').val();
        const unitPrice = parseFloat($('#unitPrice').val()) || 0;
        const description = $('#description').val();
        const ctns = parseFloat($('#ctns').val()) || 0;
        const unitsPerCtn = parseFloat($('#unitsPerCtn').val()) || 0;
        const totalUnits = parseFloat($('#totalUnitsHidden').val()) || 0;
        const weight = parseFloat($('#weight').val()) || 0;
        const vatPercentage = parseFloat($('#vatPercentage').val()) || 0;
        const shippingRatePerKg = parseFloat($('#shippingRatePerKg').val()) || 0;
        const remarks = $('#remarks').val();

        const totalMaterial = unitPrice * totalUnits;
        const shippingRate = ctns * weight * shippingRatePerKg;
        const dgd = (135 / 15) * ctns;
        const labour = ctns * 10;
        const shippingCost = shippingRate + dgd + labour;
        const vatAmount = (unitPrice * totalUnits) * (vatPercentage / 100);
        let totalMaterialWithVAT = totalMaterial + vatAmount;

        const formattedDate = date;

        $.ajax({
            url: '/save-investment',
            method: 'POST',
            data: {
                _token: $('meta[name="csrf-token"]').attr('content'),
                date,
                supplier_name: supplier,
                buyer,
                invoice_number: invoice,
                transaction_mode: transaction,
                unit_price: unitPrice,
                description,
                no_of_ctns: ctns,
                units_per_ctn: unitsPerCtn,
                total_units: totalUnits,
                weight,
                vat_percentage: vatPercentage,
                shipping_rate_per_kg: shippingRatePerKg,
                remarks
            },
            success: function (response) {
                const invoice = response.invoice_number;

                const lastSrNo = $('table tbody tr').last().find('td:eq(0)').text().trim();
                const newSrNo = isNaN(lastSrNo) ? 1 : parseInt(lastSrNo) + 1;

                const newRow = `
                        <tr data-date="${date}" data-shippingrate="${shippingRatePerKg}" data-vatpercentage="${vatPercentage}" data-invoice="${invoice}">
                            <td data-bs-toggle="tooltip" title="SR.NO">${newSrNo}</td>
                            <td data-bs-toggle="tooltip" title="DATE">${formattedDate}</td>
                            <td data-bs-toggle="tooltip" title="SUPPLIER NAME">${supplier}</td>
                            <td data-bs-toggle="tooltip" title="BUYER">${buyer}</td>
                            <td data-bs-toggle="tooltip" title="INVOICE NUMBER">${invoice}</td>
                            <td data-bs-toggle="tooltip" title="MODE OF TRANSACTION">${transaction}</td>
                            <td data-bs-toggle="tooltip" title="DESCRIPTION">${description}</td>
                            <td data-bs-toggle="tooltip" title="NO OF CTNS">${ctns}</td>
                            <td data-bs-toggle="tooltip" title="UNITS/CTN">${unitsPerCtn}</td>
                            <td data-bs-toggle="tooltip" title="UNIT PRICE">AED ${unitPrice.toFixed(2)}</td>
                            <td data-bs-toggle="tooltip" title="TOTAL NO OF UNITS">${totalUnits}</td>
                            <td data-bs-toggle="tooltip" title="VAT">AED ${vatAmount.toFixed(2)}</td>
                            <td data-bs-toggle="tooltip" title="TOTAL MATERIAL EXCLUDING VAT">AED ${totalMaterial.toFixed(2)}</td>
                            <td data-bs-toggle="tooltip" title="TOTAL MATERIAL INCLUDING VAT">AED ${totalMaterialWithVAT.toFixed(2)}</td>
                            <td data-bs-toggle="tooltip" title="WEIGHT IN KG">${weight}</td>
                            <td data-bs-toggle="tooltip" title="SHIPPING RATE">AED ${shippingRate.toFixed(2)}</td>
                            <td data-bs-toggle="tooltip" title="DGD">AED ${dgd.toFixed(2)}</td>
                            <td data-bs-toggle="tooltip" title="LABOUR">AED ${labour.toFixed(2)}</td>
                            <td data-bs-toggle="tooltip" title="SHIPPING COST">AED ${shippingCost.toFixed(2)}</td>
                            <td data-bs-toggle="tooltip" title="REMARKS">${remarks}</td>
                            <td>
                                <button class="btn btn-sm btn-success edit-btn mb-1">Edit</button>
                                <button class="btn btn-sm btn-danger delete-btn mb-1">Delete</button>
                                <button class="btn btn-sm btn-secondary copy-btn mb-1">Copy</button>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-light upload-btn mb-1 border">Upload</button>
                                <button class="btn btn-sm btn-dark view-btn mb-1">View</button>
                            </td>
                        </tr>`;

                $('table tbody').append(newRow);

                updateSummaryCards();
                $('[data-bs-toggle="tooltip"]').tooltip('dispose').tooltip();

                $('#investmentForm')[0].reset();
                $('#multiEntryModal').modal('hide');
                $('#submitBtn').show();
                $('#saveChangesBtn').hide();

                localStorage.setItem('scrollToBottomAfterReload', 'true');
                location.reload();
            },
            error: function (xhr) {
                console.error('Save Error:', xhr.responseText);
                alert('Failed to save investment!');
            }
        });
    });

    $('#saveChangesBtn').on('click', function () {
        const id = $('#investmentForm').data('edit-id');
        if (!id) {
            alert("Missing record ID to edit.");
            return;
        }

        // Collect fields
        const ctns = parseFloat($('#ctns').val()) || 0;
        const unitsPerCtn = parseFloat($('#unitsPerCtn').val()) || 0;
        let totalUnits = ctns * unitsPerCtn || parseFloat($('#totalUnitsHidden').val()) || 0;

        // Check if total units are still missing
        if (totalUnits === 0) {
            $('#manualUnitsModal').modal('show');

            // Save edit id to resume later
            $('#manualUnitsModal').data('edit-id', id);

            return; // Stop here
        }

        // Proceed with saving
        submitEdit(id, totalUnits);
    });

    $('[data-bs-toggle="tooltip"]').tooltip();

    $('#confirmManualUnitsBtn').on('click', function () {
        const manualUnits = parseFloat($('#manualTotalUnitsInput').val()) || 0;

        if (manualUnits <= 0) {
            alert('Please enter a valid total no of units.');
            return;
        }

        $('#totalUnitsHidden').val(manualUnits);
        $('#manualUnitsModal').modal('hide');

        // Check if we are in EDIT mode
        const editId = $('#manualUnitsModal').data('edit-id');

        if (editId) {
            // Clear edit id after use
            $('#manualUnitsModal').removeData('edit-id');
            // Proceed with saving the edit
            submitEdit(editId, manualUnits);
        } else {
            // Proceed with normal add new row
            $('#investmentForm').trigger('manual-submit');
        }
    });

    $('#openMultiEntryModalBtn').on('click', function () {
        isMultipleEntry = 1;
        $('#multiEntryModal').modal('show');
    });

    if (localStorage.getItem('scrollToBottomAfterReload') === 'true') {
        setTimeout(function () {
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });
            localStorage.removeItem('scrollToBottomAfterReload');
        }, 1000);
    }

    $('#attachmentForm').on('submit', function (e) {
        e.preventDefault();

        const id = $('#attachRowId').val();
        const formData = new FormData(this);

        $.ajax({
            url: `/upload-attachments/${id}`,
            type: 'POST',
            data: formData,
            contentType: false,
            processData: false,
            headers: {
                'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
            },
            success: function (res) {
                alert(res.message);
                $('#attachmentModal').modal('hide');
                location.reload(); // Reload to show updated view/download
            },
            error: function () {
                alert('Upload failed. Please try again.');
            }
        });
    });

    $('.column-filter').on('keyup change', function () {
        const index = $(this).data('index');
        const filterValue = $(this).val().toLowerCase();

        $('table tbody tr').each(function () {
            const cellText = $(this).find('td').eq(index).text().toLowerCase();
            $(this).toggle(cellText.includes(filterValue));
        });
    });

    $('#start-entry-btn').click(function () {
        totalSteps = parseInt($('#number-of-entries').val());
        if (!totalSteps || totalSteps < 1) return alert('Enter a valid number');

        $('#multi-step-wrapper').hide();
        $('#entry-fields-container').show();
        currentStep = 1;
        showEntryForm(currentStep);
    });

    $('#next-entry-btn').click(function () {
        const inputs = $('#entry-form-fields').find('input');
        let entry = {};

        inputs.each(function () {
            const name = $(this).attr('name');
            const val = $(this).val();
            entry[name] = val || '';
        });

        const ctns = parseFloat(entry.no_of_ctns) || 0;
        const unitsPerCtn = parseFloat(entry.units_per_ctn) || 0;
        const manualUnits = parseFloat(entry.manual_total_units) || 0;

        // Save current entry temporarily
        multiEntryData[currentStep - 1] = entry;

        // Check for missing CTNS or Units/CTN
        if ((ctns === 0 || unitsPerCtn === 0) && manualUnits === 0) {
            $('.manual-units-wrapper').show();
            return; // Still missing manual fallback – stop
        }

        // Proceed
        if (currentStep === totalSteps) {
            $('#next-entry-btn').addClass('d-none');
            $('#submit-multi-entry').removeClass('d-none');
        } else {
            currentStep++;
            showEntryForm(currentStep);
        }

        $('#prev-entry-btn').toggle(currentStep > 1);
    });

    $('#prev-entry-btn').click(function () {
        if (currentStep > 1) {
            currentStep--;
            showEntryForm(currentStep);
            $('#submit-multi-entry').addClass('d-none');
            $('#next-entry-btn').removeClass('d-none');
        }
        $('#prev-entry-btn').toggle(currentStep > 1);
    });

    $('#multi-entry-form').submit(function (e) {
        e.preventDefault();

        const invoiceNumber = $('#invoice').val().trim();
        if (!invoiceNumber) {
            alert("Please enter a valid invoice number.");
            return;
        }

        const date = $('#date').val();
        const supplier = $('#supplier').val();
        const buyer = $('#buyer').val();
        const transaction = $('#transaction').val();

        // Validate entries
        for (let i = 0; i < multiEntryData.length; i++) {
            const entry = multiEntryData[i];
            const ctns = parseFloat(entry.no_of_ctns) || 0;
            const unitsPerCtn = parseFloat(entry.units_per_ctn) || 0;
            const manualUnits = parseFloat(entry.manual_total_units) || 0;

            if ((ctns === 0 || unitsPerCtn === 0) && manualUnits === 0) {
                alert(`Entry ${i + 1}: Please provide either CTNS + Units/CTN or Total Units`);
                return;
            }
        }

        // Prepare all entries
        const preparedEntries = multiEntryData.map(entry => {
            const totalUnits =
                parseFloat(entry.total_units) ||
                ((parseFloat(entry.no_of_ctns) > 0 && parseFloat(entry.units_per_ctn) > 0)
                    ? parseFloat(entry.no_of_ctns) * parseFloat(entry.units_per_ctn)
                    : parseFloat(entry.manual_total_units) || 0);

            return {
                unit_price: entry.unit_price,
                vat_percentage: entry.vat_percentage,
                description: entry.description,
                no_of_ctns: entry.no_of_ctns,
                units_per_ctn: entry.units_per_ctn,
                total_units: totalUnits,
                weight: entry.weight,
                shipping_rate: entry.shipping_rate,
                remarks: entry.remarks
            };
        });

        // Only ONE request
        $.ajax({
            url: '/store-multiple-entry',
            method: 'POST',
            data: {
                _token: $('meta[name="csrf-token"]').attr('content'),
                date,
                supplier_name: supplier,
                buyer,
                invoice_number: invoiceNumber,
                transaction_mode: transaction,
                entries: preparedEntries
            },
            success: function () {
                $('#multiEntryModal').modal('hide');
                localStorage.setItem('scrollToBottomAfterReload', 'true');
                location.reload();
            },
            error: function (xhr) {
                console.error(xhr.responseText);
                alert('Error saving multiple entries.');
            }
        });
    });

    $('#filteredExcelBtn').on('click', function () {
        const wb = XLSX.utils.book_new();
        const wsData = [];

        // Table Headers
        const headers = [];
        $('table thead tr:eq(0) th').each(function (index) {
            if (index < 21) { // Ignore Action and Attachment
                headers.push($(this).text().trim());
            }
        });
        wsData.push(headers);

        // Filtered Visible Rows Only
        $('table tbody tr:visible').each(function () {
            const cells = $(this).find('td');
            const allColumns = [];

            cells.each(function (i) {
                if (i < 21) { // Skip last two columns
                    const text = $(this).text().trim();
                    let parts;

                    if (i >= 7 && i <= 20) {
                        // Number fields (like price, totals, etc.)
                        parts = text.match(/\d+\.\s(?:[^\d\n]*\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g);
                    } else {
                        // Description and other text fields
                        parts = text.match(/\d+\.\s[^\n]+/g);
                    }

                    allColumns.push(parts ? parts.map(p => p.trim()) : [text]);
                }
            });

            const maxLines = Math.max(...allColumns.map(col => col.length));

            for (let i = 0; i < maxLines; i++) {
                const row = [];

                allColumns.forEach((col, index) => {
                    row.push(i === 0 ? (col[i] || '') : (col.length > 1 ? (col[i] || '') : ''));
                });

                wsData.push(row);
            }
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Wrap text in Excel cells
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellRef]) continue;
                if (!ws[cellRef].s) ws[cellRef].s = {};
                ws[cellRef].s.alignment = { wrapText: true };
            }
        }

        XLSX.utils.book_append_sheet(wb, ws, "Filtered Data");
        XLSX.writeFile(wb, 'filtered_investment_data.xlsx');
    });

    $(document).on('input', '.ctns-input, .units-per-ctn-input', function () {
        const $row = $(this).closest('.row');
        const ctns = parseFloat($row.find('[name="no_of_ctns"]').val()) || 0;
        const units = parseFloat($row.find('[name="units_per_ctn"]').val()) || 0;

        if (ctns === 0 || units === 0) {
            $row.find('.manual-units-wrapper').show();
        } else {
            $row.find('.manual-units-wrapper').hide();
            $row.find('[name="manual_total_units"]').val('');
        }
    });

    // Toggle popup on input click
    $('#dateFilterTrigger').on('click', function () {
        const popup = $('#datePopup');
        const trigger = $(this);
        const popupHeight = popup.outerHeight();
        const offset = trigger.offset();
        const scrollTop = $(window).scrollTop();
        const windowHeight = $(window).height();

        let topPosition = offset.top + trigger.outerHeight() + 8; // below input by default

        // Check if popup will overflow screen bottom
        if ((topPosition - scrollTop + popupHeight) > windowHeight) {
            topPosition = offset.top - popupHeight - 10; // position above input
        }

        popup.css({
            top: topPosition,
            left: offset.left
        }).fadeIn();
    });

    // Hide when clicked outside
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#dateFilterTrigger, #datePopup').length) {
            $('#datePopup').fadeOut();
        }
    });

    // Apply filter
    $('#applyDateFilter').on('click', function () {
        const fromDate = $('#fromDate').val();
        const toDate = $('#toDate').val();

        if (!fromDate || !toDate) {
            alert('Please select both From and To dates.');
            return;
        }

        // Update placeholder in dd-mm-yyyy format
        const formatDate = d => {
            const parts = d.split("-");
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        };
        $('#dateFilterTrigger').val(`${formatDate(fromDate)} to ${formatDate(toDate)}`);

        $('#datePopup').fadeOut();

        // Apply filter to date column (index 1)
        $('table tbody tr').each(function () {
            const cell = $(this).find('td:eq(1)').text().trim();
            const rowDate = parseRowDate(cell);

            if (rowDate >= fromDate && rowDate <= toDate) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        // Show filtered download button only when filtered
        const totalRows = $('table tbody tr').length;
        const visibleRows = $('table tbody tr:visible').length;

        if (visibleRows > 0 && visibleRows < totalRows) {
            $('#filteredExcelBtn').removeClass('d-none');
        } else {
            $('#filteredExcelBtn').addClass('d-none');
        }
    });

    // Clear filter
    $('#clearDateFilter').on('click', function () {
        $('#fromDate').val('');
        $('#toDate').val('');
        $('#dateFilterTrigger').val('');
        $('#datePopup').fadeOut();

        // Show all rows
        $('table tbody tr').show();
        $('#filteredExcelBtn').addClass('d-none');
    });

    // Enable tooltip
    const toggleEl = document.querySelector('#customToggle');
    new bootstrap.Tooltip(toggleEl);

    // Toggle sideMenu
    $('#customToggle').on('click', function () {
        const offcanvas = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('sideMenu'));
        offcanvas.toggle();
    });

    // =======================
    // US CLIENT PAYMENT JS
    // =======================

    loadUSClients();

    $(document).on('click', '.delete-us-btn', function () {
        const id = $(this).data('id');
        $('#usDeleteId').val(id);
        $('#usDeleteModal').modal('show');
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
                $('#usDeleteModal').modal('hide');
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
        const amount = tr.find('td:eq(2)').text().replace('AED', '').trim();
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

    $('#downloadExcelBtn').on('click', function () {
        const activeSheet = localStorage.getItem('activeSheet') || 'gts';

        if (activeSheet === 'gts') {
            exportGTSExcel();
        } else if (activeSheet === 'us') {
            exportUSClientExcel();
        } else if (activeSheet === 'sq') {
            exportSQExcel();
        } else if (activeSheet === 'rh') {
            exportRHExcel();
        } else if (activeSheet === 'ff') {
            exportFFExcel();
        } else if (activeSheet === 'bl') {
            exportBLExcel();
        } else if (activeSheet === 'local') {
            exportLOCALExcel();
        } else {
            alert('No export available for this sheet.');
        }
    });

    $('#usDateFilterInput').on('click', function () {
        const $input = $(this);
        const $popup = $('#usDatePopup');
        const popupHeight = $popup.outerHeight();
        const inputOffset = $input.offset();
        const scrollTop = $(window).scrollTop();
        const windowHeight = $(window).height();

        let topPosition = inputOffset.top + $input.outerHeight() + 5; // default below

        // If there's not enough space below, show above
        if ((topPosition - scrollTop + popupHeight) > windowHeight) {
            topPosition = inputOffset.top - popupHeight - 5;
        }

        // Horizontal alignment (already fine)
        let leftPosition = inputOffset.left;
        const popupWidth = $popup.outerWidth();
        const windowWidth = $(window).width();
        if ((leftPosition + popupWidth) > windowWidth) {
            leftPosition = windowWidth - popupWidth - 10;
        }

        $popup.css({
            position: 'absolute',
            top: `${topPosition}px`,
            left: `${leftPosition}px`,
            zIndex: 9999
        }).appendTo('body').fadeIn();
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('#usDateFilterInput, #usDatePopup').length) {
            $('#usDatePopup').fadeOut();
        }
    });

    $('#applyUSDateFilter').on('click', function () {
        const from = $('#usFromDate').val();
        const to = $('#usToDate').val();
        if (!from || !to) return alert('Please select both dates.');

        const filtered = originalUSClients.filter(item => item.date >= from && item.date <= to);
        renderUSClients(filtered);

        $('#usFilteredExcelBtn').removeClass('d-none');
        $('#usDatePopup').fadeOut();

        $('#usDateFilterInput').val(`${from} to ${to}`);
    });

    $('#clearUSDateFilter').on('click', function () {
        renderUSClients(originalUSClients);
        $('#usFilteredExcelBtn').addClass('d-none');
        $('#usDateFilterInput').val('');
        $('#usDatePopup').fadeOut();
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


    // =======================
    // SQ Sheet JS
    // =======================


    loadSQClients();

    $(document).on('click', '.delete-sq-btn', function () {
        const id = $(this).data('id');
        $('#sqDeleteId').val(id);
        $('#sqDeleteModal').modal('show');
    });

    $('#confirmSqDeleteBtn').on('click', function () {
        const id = $('#sqDeleteId').val();

        $.ajax({
            url: `/sq-client/delete/${id}`,
            type: 'DELETE',
            data: { _token: $('meta[name="csrf-token"]').attr('content') },
            success: function (response) {
                $('#sqDeleteModal').modal('hide');
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
        const amount = tr.find('td:eq(2)').text().replace('AED', '').trim();
        const remarks = tr.find('td:eq(3)').text().trim();

        $('#sqDate').val(rawDate);
        $('#sqAmount').val(amount);
        $('#sqRemarks').val(remarks);

        $('button[type="submit"]').text('Update').data('editing', true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // $(document).on('click', '.copy-sq-btn', function () {
    //     const tr = $(this).closest('tr');
    //     const rawDate = tr.find('td:eq(1)').text().trim();
    //     const parsedDate = new Date(rawDate);

    //     if (isNaN(parsedDate.getTime())) return alert('Invalid date');

    //     const yyyy = parsedDate.getFullYear();
    //     const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
    //     const dd = String(parsedDate.getDate()).padStart(2, '0');

    //     $('#sqDate').val(`${yyyy}-${mm}-${dd}`);
    //     $('#sqAmount').val(tr.find('td:eq(2)').text().replace('AED', '').trim());
    //     $('#sqRemarks').val(tr.find('td:eq(3)').text().trim());

    //     $('#sqSubmitBtn').text('Submit').removeData('editing-id');
    //     window.scrollTo({ top: 0, behavior: 'smooth' });
    // });

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

    // $(document).on('click', '.copy-sq-btn', function () {
    //     const tr = $(this).closest('tr');
    //     const rawDate = tr.find('td:eq(1)').text().trim();

    //     const parsedDate = new Date(rawDate);
    //     if (isNaN(parsedDate.getTime())) return alert('Invalid date format.');

    //     const yyyy = parsedDate.getFullYear();
    //     const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
    //     const dd = String(parsedDate.getDate()).padStart(2, '0');
    //     const formattedDate = `${yyyy}-${mm}-${dd}`;

    //     const amount = tr.find('td:eq(2)').text().replace('AED', '').trim();
    //     const remarks = tr.find('td:eq(3)').text().trim();

    //     $('#sqDate').val(formattedDate);
    //     $('#sqAmount').val(amount);
    //     $('#sqRemarks').val(remarks);

    //     $('button[type="submit"]').text('Submit').removeData('editing');
    //     window.scrollTo({ top: 0, behavior: 'smooth' });
    // });

    $('#sqDateFilterInput').on('click', function () {
        const $input = $(this);
        const $popup = $('#sqDatePopup');
        const popupHeight = $popup.outerHeight();
        const inputOffset = $input.offset();
        const scrollTop = $(window).scrollTop();
        const windowHeight = $(window).height();

        let topPosition = inputOffset.top + $input.outerHeight() + 5;
        if ((topPosition - scrollTop + popupHeight) > windowHeight) {
            topPosition = inputOffset.top - popupHeight - 5;
        }

        let leftPosition = inputOffset.left;
        const popupWidth = $popup.outerWidth();
        const windowWidth = $(window).width();
        if ((leftPosition + popupWidth) > windowWidth) {
            leftPosition = windowWidth - popupWidth - 10;
        }

        $popup.css({
            position: 'absolute',
            top: `${topPosition}px`,
            left: `${leftPosition}px`,
            zIndex: 9999
        }).appendTo('body').fadeIn();
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('#sqDateFilterInput, #sqDatePopup').length) {
            $('#sqDatePopup').fadeOut();
        }
    });

    $('#applySQDateFilter').on('click', function () {
        const from = $('#sqFromDate').val();
        const to = $('#sqToDate').val();
        if (!from || !to) return alert('Please select both dates.');

        const filtered = originalSQClients.filter(item => item.date >= from && item.date <= to);
        renderSQClients(filtered);

        $('#sqFilteredExcelBtn').removeClass('d-none');
        $('#sqDatePopup').fadeOut();

        $('#sqDateFilterInput').val(`${from} to ${to}`);
    });

    $('#clearSQDateFilter').on('click', function () {
        renderSQClients(originalSQClients);
        $('#sqFilteredExcelBtn').addClass('d-none');
        $('#sqDateFilterInput').val('');
        $('#sqDatePopup').fadeOut();
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

    // Enable drag scroll on elements with .drag-scroll
    $('.drag-scroll').each(function () {
        const $container = $(this);
        const $tbody = $container.find('tbody');
        let isDown = false;
        let startX;
        let scrollLeft;

        $tbody.on('mousedown', function (e) {
            isDown = true;
            $container.addClass('dragging');
            startX = e.pageX - $container.offset().left;
            scrollLeft = $container.scrollLeft();
            e.preventDefault();
        });

        $(document).on('mouseup', function () {
            isDown = false;
            $container.removeClass('dragging');
        });

        $(document).on('mousemove', function (e) {
            if (!isDown) return;
            const x = e.pageX - $container.offset().left;
            const walk = (x - startX) * 1; // Adjust scroll speed multiplier here
            $container.scrollLeft(scrollLeft - walk);
        });
    });

});

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

// GTS Investment Sheet Functions

function submitEdit(id, totalUnits) {
    const date = $('#date').val();
    const supplier = $('#supplier').val();
    const buyer = $('#buyer').val();
    const invoice = $('#invoice').val();
    const transaction = $('#transaction').val();
    const unitPrice = parseFloat($('#unitPrice').val()) || 0;
    const description = $('#description').val();
    const ctns = parseFloat($('#ctns').val()) || 0;
    const unitsPerCtn = parseFloat($('#unitsPerCtn').val()) || 0;
    const weight = parseFloat($('#weight').val()) || 0;
    const vatPercentage = parseFloat($('#vatPercentage').val()) || 0;
    const shippingRatePerKg = parseFloat($('#shippingRatePerKg').val()) || 0;
    const remarks = $('#remarks').val();

    const totalMaterial = unitPrice * totalUnits;
    const shippingRate = ctns * weight * shippingRatePerKg;
    const dgd = (135 / 15) * ctns;
    const labour = ctns * 10;
    const shippingCost = shippingRate + dgd + labour;
    const vatAmount = (vatPercentage > 0 && totalUnits > 0 && unitPrice > 0) ? (unitPrice * totalUnits) * (vatPercentage / 100) : 0;
    const totalMaterialWithVAT = totalMaterial + vatAmount;

    $.ajax({
        url: `/update-investment/${id}`,
        type: 'PUT',
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        },
        data: {
            date,
            supplier_name: supplier,
            buyer,
            invoice_number: invoice,
            transaction_mode: transaction,
            unit_price: unitPrice,
            description,
            no_of_ctns: ctns,
            units_per_ctn: unitsPerCtn,
            total_units: totalUnits,
            vat_percentage: vatPercentage,
            vat_amount: vatAmount,
            total_material: totalMaterial,
            total_material_including_vat: totalMaterialWithVAT,
            weight,
            shipping_rate_per_kg: shippingRatePerKg,
            shipping_rate: shippingRate,
            dgd,
            labour,
            shipping_cost: shippingCost,
            remarks
        },
        success: function () {
            updateSummaryCards();
            $('[data-bs-toggle="tooltip"]').tooltip('dispose').tooltip();
            $('#investmentForm')[0].reset();
            $('#investmentForm').removeData('edit-id');
            $('#submitBtn').show();
            $('#saveChangesBtn').hide();
            localStorage.setItem('scrollToBottomAfterReload', 'true');
            location.reload();
        },
        error: function (err) {
            alert('Error updating row in database.');
            console.error(err);
        }
    });
}

function exportGTSExcel() {
    const wb = XLSX.utils.book_new();
    const wsData = [];

    const headers = [];
    $('#sheet-gts table thead tr:eq(0) th').each(function (index) {
        if (index < 21) headers.push($(this).text().trim());
    });
    wsData.push(headers);

    $('#sheet-gts table tbody tr').each(function () {
        const cells = $(this).find('td');
        const allColumns = [];

        cells.each(function (i) {
            if (i < 21) {
                const text = $(this).text().trim();
                let parts;

                if (i === 6) {
                    parts = text.match(/\d+\.\s[^\n]+/g);
                } else if (i >= 7 && i <= 20) {
                    parts = text.match(/\d+\.\s[^.\n]*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g);
                } else {
                    parts = text.match(/\d+\.\s[^\n]+/g);
                }

                allColumns.push(parts ? parts.map(p => p.trim()) : [text]);
            }
        });

        const maxLines = Math.max(...allColumns.map(col => col.length));

        for (let i = 0; i < maxLines; i++) {
            const row = [];
            allColumns.forEach((col) => {
                row.push(col[i] || '');
            });
            wsData.push(row);
        }
    });

    wsData.push([]);
    wsData.push(['Total Material Excl. VAT', $('#totalMaterialAED').text()]);
    wsData.push(['Total Material Incl. VAT', $('#totalMaterialInclVAT').text()]);
    wsData.push(['Total VAT Amount', $('#totalVAT').text()]);
    wsData.push(['Total Shipment', $('#totalShipmentAED').text()]);
    wsData.push(['Grand Total', $('#grandTotalAED').text()]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellRef]) continue;
            if (!ws[cellRef].s) ws[cellRef].s = {};
            ws[cellRef].s.alignment = { wrapText: true };
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Investment Sheet");
    XLSX.writeFile(wb, 'investment_Sheet.xlsx');
}

function showEntryForm(step) {
    const entry = multiEntryData[step - 1] || {};

    const html = `
        <div class="step-label mb-2"><strong>Entry ${step}</strong></div>
        <div class="row g-3 entry-row" data-step="${step}">
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="unit_price" placeholder="Unit Price" value="${entry.unit_price || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="vat_percentage" placeholder="VAT %" value="${entry.vat_percentage || ''}">
            </div>
            <div class="col-md-4">
                <input type="text" class="form-control" name="description" placeholder="Description" value="${entry.description || ''}">
            </div>

            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="no_of_ctns" placeholder="No of CTNS" value="${entry.no_of_ctns || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="units_per_ctn" placeholder="Units/CTN" value="${entry.units_per_ctn || ''}">
            </div>

            <div class="col-md-4 manual-units-wrapper" style="display: none;">
                <label class="text-danger small mb-1"><b>⚠️ Total No of Units (required if CTNS or Units/CTN missing)</b></label>
                <input type="number" step="any" class="form-control" name="manual_total_units" placeholder="Enter Total No of Units" value="${entry.manual_total_units || ''}">
            </div>

            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="weight" placeholder="Weight in KG" value="${entry.weight || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="shipping_rate" placeholder="Shipping Rate/KG" value="${entry.shipping_rate || ''}">
            </div>
            <div class="col-md-8">
                <input type="text" class="form-control" name="remarks" placeholder="Remarks" value="${entry.remarks || ''}">
            </div>
        </div>
    `;
    $('#entry-form-fields').html(html);
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

// Fetch and load US Client data
function loadUSClients() {
    $.get('/us-client/data', function (data) {
        const tbody = $('#us-client-body');
        tbody.empty();

        data.clients.forEach((item, index) => {
            const dateFormatted = item.date ? formatDate(item.date) : '';
            const amountFormatted = !isNaN(parseFloat(item.amount)) ? `AED ${parseFloat(item.amount).toFixed(2)}` : 'AED 0.00';

            const row = `
                <tr data-id="${item.id}" data-date="${item.date}">
                    <td>${index + 1}</td>
                    <td>${dateFormatted}</td>
                    <td>${amountFormatted}</td>
                    <td>${item.remarks || ''}</td>
                    <td>
                        <button class="btn btn-sm btn-success edit-us-btn">Edit</button>
                        <button class="btn btn-sm btn-danger delete-us-btn" data-id="${item.id}">Delete</button>
                    </td>
                </tr>`;
            tbody.append(row);
        });

        // Update Total Amount
        const total = !isNaN(parseFloat(data.totalAmount)) ? `AED ${parseFloat(data.totalAmount).toFixed(2)}` : 'AED 0.00';
        $('#us-total-amount').text(total);
    });
}

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
    $.get('/us-client/data', function (data) {
        originalUSClients = data.clients;
        renderUSClients(data.clients);
        $('#us-total-amount').text(
            'AED ' + parseFloat(data.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })
        );
    });
}

function renderUSClients(clients) {
    const tbody = $('#us-client-body');
    tbody.empty();

    clients.forEach((item) => {
        const originalIndex = originalUSClients.findIndex(c => c.id === item.id);
        const srNo = originalIndex !== -1 ? originalIndex + 1 : '-';

        const row = `
            <tr data-id="${item.id}" data-date="${item.date}">
                <td>${srNo}</td>
                <td>${formatDate(item.date)}</td>
                <td class="format-aed">AED ${parseFloat(item.amount).toFixed(2)}</td>
                <td>${item.remarks || ''}</td>
                <td>
                    <button class="btn btn-sm btn-success edit-us-btn" data-bs-toggle="tooltip" title="Edit"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-danger delete-us-btn" data-bs-toggle="tooltip" data-id="${item.id}" title="Delete"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        tbody.append(row);
    });

    applyNumberFormatting();

    $('[data-bs-toggle="tooltip"]').tooltip();
}

// SQ Sheet Logic Initialization
function loadSQClients() {
    $.get('/sq-client/data', function (data) {
        originalSQClients = data.clients;
        renderSQClients(data.clients);
        $('#sq-total-amount').text(
            'AED ' + parseFloat(data.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })
        );
    });
}

function renderSQClients(clients) {
    const tbody = $('#sq-client-body');
    tbody.empty();

    clients.forEach((item) => {
        const originalIndex = originalSQClients.findIndex(c => c.id === item.id);
        const srNo = originalIndex !== -1 ? originalIndex + 1 : '-';

        const row = `
            <tr data-id="${item.id}" data-date="${item.date}">
                <td>${srNo}</td>
                <td>${formatDate(item.date)}</td>
                <td class="format-aed">AED ${parseFloat(item.amount).toFixed(2)}</td>
                <td>${item.remarks || ''}</td>
                <td>
                    <button class="btn btn-sm btn-success edit-sq-btn" data-bs-toggle="tooltip" title="Edit"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-danger delete-sq-btn" data-bs-toggle="tooltip" data-id="${item.id}" title="Delete"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        tbody.append(row);
    });

    applyNumberFormatting();

    $('[data-bs-toggle="tooltip"]').tooltip();
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

// RH Sheet Logic Initialization
let rhMultiEntryData = [];
let rhCurrentStep = 1;

let editingRHGroup = null;

function initRHLogic() {
    $.ajaxSetup({
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        }
    });
    $('#rhSubmitBtn').on('click', function (e) {
        e.preventDefault();
        const noOfCtns = parseFloat($('#rhNoOfCtns').val());
        const unitsPerCtn = parseFloat($('#rhUnitsPerCtn').val());

        if ((!noOfCtns || noOfCtns === 0) && (!unitsPerCtn || unitsPerCtn === 0)) {
            $('#rhManualTotalUnitsInput').val('');
            $('#rhManualUnitsModal').data('source', 'submit');
            $('#rhManualUnitsModal').modal('show');
            return;
        }

        sendRHEntry();
    });

    $('#rhConfirmManualUnitsBtn').on('click', function () {
        const manualUnits = parseFloat($('#rhManualTotalUnitsInput').val());
        if (!manualUnits || manualUnits <= 0) {
            alert('Please enter a valid total number of units.');
            return;
        }

        $('#rhTotalUnitsHidden').val(manualUnits);
        $('#rhManualTotalUnitsInput').val('');
        $('#rhManualUnitsModal').modal('hide');

        const mode = $('#rhManualUnitsModal').data('source');
        if (mode === 'edit') {
            sendRHEntryEdit();
        } else {
            sendRHEntry();
        }
    });

    // Open Multiple Entry Modal
    $('#openRHMultiEntryModalBtn').on('click', function () {
        rhMultiEntryData = [];
        rhCurrentStep = 1;
        $('#rh-multi-step-wrapper').show();
        $('#rh-entry-fields-container').hide();
        $('#rh-number-of-entries').val('');
        $('#rhMultiEntryModal').modal('show');
    });

    $('#rh-start-entry-btn').on('click', function () {
        const count = parseInt($('#rh-number-of-entries').val());
        if (!count || count < 1) {
            alert("Enter valid number");
            return;
        }
        rhMultiEntryData = new Array(count).fill({});
        rhCurrentStep = 1;
        showRHEntryForm(rhCurrentStep);
        $('#rh-multi-step-wrapper').hide();
        $('#rh-entry-fields-container').show();
    });

    $('#rh-next-entry-btn').on('click', function () {
        const $row = $('.entry-row[data-step="' + rhCurrentStep + '"]');
        const noOfCtns = parseFloat($row.find('[name="no_of_ctns"]').val()) || 0;
        const unitsPerCtn = parseFloat($row.find('[name="units_per_ctn"]').val()) || 0;

        // If either CTNS or Units/CTN is missing
        if (!noOfCtns || !unitsPerCtn) {
            // Check if input already added
            if ($row.find('[name="manual_total_units"]').length === 0) {
                $row.append(`
                <div class="col-md-6">
                    <input type="number" step="any" class="form-control border-danger mt-2" name="manual_total_units" placeholder="⚠️ Total No of Units (required if CTNS or Units/CTN missing)">
                </div>
            `);
                return; // Stop here until user enters manual value
            }

            const manualUnits = parseFloat($row.find('[name="manual_total_units"]').val()) || 0;
            if (!manualUnits || manualUnits <= 0) {
                alert("Please enter Total No of Units.");
                return;
            }
        }

        storeRHEntryData(rhCurrentStep);
        if (rhCurrentStep < rhMultiEntryData.length) {
            rhCurrentStep++;
            showRHEntryForm(rhCurrentStep);
        } else {
            $('#rh-next-entry-btn').hide();
            $('#rh-submit-multi-entry').removeClass('d-none');
        }
    });

    $('#rh-prev-entry-btn').on('click', function () {
        storeRHEntryData(rhCurrentStep);
        if (rhCurrentStep > 1) {
            rhCurrentStep--;
            showRHEntryForm(rhCurrentStep);
        }
    });

    $('#rh-multi-entry-form').on('submit', function (e) {
        e.preventDefault();
        storeRHEntryData(rhCurrentStep);

        const supplier = $('#rhClientForm').find('[name="supplier_name"]').val().trim();
        const date = $('#rhDate').val();

        if (!supplier || !date) {
            alert("Supplier name and date are required.");
            return;
        }

        $.ajax({
            url: '/rh-client/save-multiple',
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
            },
            data: {
                date: date,
                supplier_name: supplier,
                entries: rhMultiEntryData,
                multiple_entry: true
            },
            success: function () {
                $('#rhMultiEntryModal').modal('hide');
                alert('Multiple entries saved!');
                loadRHClients();
                $('html, body').animate({
                    scrollTop: $('#rh-client-body').closest('table').offset().top - 100
                }, 500);
            },
            error: function (xhr) {
                console.error(xhr.responseText);
                alert("Error saving multiple entries.");
            }
        });
    });

    function showRHEntryForm(step) {
        const entry = rhMultiEntryData[step - 1] || {};
        const html = `
        <div class="step-label mb-2"><strong>Entry ${step}</strong></div>
        <div class="row g-3 entry-row" data-step="${step}">
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="unit_price" placeholder="Unit Price" value="${entry.unit_price || ''}">
            </div>
            <div class="col-md-4">
                <input type="text" class="form-control" name="description" placeholder="Description" value="${entry.description || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="no_of_ctns" placeholder="No of CTNS" value="${entry.no_of_ctns || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="units_per_ctn" placeholder="Units/CTN" value="${entry.units_per_ctn || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="weight" placeholder="Weight in KG" value="${entry.weight || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="shipping_rate_per_kg" placeholder="Shipping Rate/KG" value="${entry.shipping_rate_per_kg || ''}">
            </div>
        </div>
    `;
        $('#rh-entry-form-fields').html(html);
    }

    function storeRHEntryData(step) {
        const $row = $('.entry-row[data-step="' + step + '"]');

        rhMultiEntryData[step - 1] = {
            unit_price: parseFloat($row.find('[name="unit_price"]').val()) || 0,
            description: $row.find('[name="description"]').val() || '',
            no_of_ctns: parseFloat($row.find('[name="no_of_ctns"]').val()) || 0,
            units_per_ctn: parseFloat($row.find('[name="units_per_ctn"]').val()) || 0,
            weight: parseFloat($row.find('[name="weight"]').val()) || 0,
            shipping_rate_per_kg: parseFloat($row.find('[name="shipping_rate_per_kg"]').val()) || 0,
            manual_total_units: parseFloat($row.find('[name="manual_total_units"]').val()) || 0
        };
    }

    $(document).on('click', '.edit-rh-btn', function () {
        const $row = $(this).parents('tr[data-id]');
        const id = $row.data('id');
        const subSerials = $row.data('subserials');

        if (Array.isArray(subSerials) && subSerials.length > 1) {
            editingRHGroup = {
                date: $row.data('date'),
                supplier: $row.data('supplier'),
                subSerials: subSerials
            };
            editingRHId = id;

            $('#rhEditSubSerialInput').val('');
            $('#rhEditSubEntryModal').modal('show');
        } else {
            editingRHId = id;
            $('#rhDate').val($row.data('date'));
            $('#supplierName').val($row.data('supplier'));
            $('#rhDescription').val($row.find('td:eq(3)').text().trim());
            $('#rhNoOfCtns').val($row.find('td:eq(4)').text().trim());
            $('#rhUnitsPerCtn').val($row.find('td:eq(5)').text().trim());
            $('#rhUnitPrice').val($row.find('td:eq(6)').text().replace('AED', '').trim());
            $('#rhWeight').val($row.find('td:eq(8)').text().trim());
            $('#rhShippingRate').val($row.data('shipping-rate-per-kg'));

            $('#rhSubmitBtn').addClass('d-none');
            $('#rhSaveChangesBtn').removeClass('d-none');
            $('html, body').animate({ scrollTop: 0 }, 300);
        }
    });

    $('#confirmRHSubSerialEditBtn').on('click', function () {
        const subSerial = parseInt($('#rhEditSubSerialInput').val().trim());

        if (!subSerial || !editingRHGroup) {
            alert("Please enter a valid sub-serial number.");
            return;
        }

        $.getJSON('/rh-client/data-all', function (fullData) {
            const row = fullData.find(entry =>
                entry.date.trim() === editingRHGroup.date.trim() &&
                entry.supplier_name.trim().toLowerCase() === editingRHGroup.supplier.trim().toLowerCase() &&
                parseInt(entry.sub_serial) === parseInt(subSerial)
            );

            if (!row) {
                alert("Could not load data.");
                return;
            }

            editingRHId = row.id;
            editingRHSubSerial = subSerial;

            // Populate fields
            $('html, body').animate({ scrollTop: 0 }, 300);
            $('#rhDate').val(row.date);
            $('#supplierName').val(row.supplier_name);
            $('#rhDescription').val(row.description || '');
            $('#rhNoOfCtns').val(row.no_of_ctns || '');
            $('#rhUnitsPerCtn').val(row.units_per_ctn || '');
            $('#rhUnitPrice').val(row.unit_price || '');
            $('#rhWeight').val(row.weight || '');
            $('#rhShippingRate').val(row.shipping_rate_per_kg || '');

            editingRHId = row.id;
            editingRHSubSerial = subSerial;

            $('#rhSubmitBtn').addClass('d-none');
            $('#rhSaveChangesBtn').removeClass('d-none');

            $('#rhEditSubEntryModal').modal('hide');
            $('#rhEditSubSerialInput').val('');
        });
    });

    $('#rhSaveChangesBtn').on('click', function () {
        if (!editingRHId) return alert("Missing record ID.");

        const data = {
            date: $('#rhDate').val(),
            supplier_name: $('#supplierName').val(),
            description: $('#rhDescription').val(),
            no_of_ctns: $('#rhNoOfCtns').val(),
            units_per_ctn: $('#rhUnitsPerCtn').val(),
            unit_price: $('#rhUnitPrice').val(),
            weight: $('#rhWeight').val(),
            shipping_rate_per_kg: $('#rhShippingRate').val(),
            _token: $('meta[name="csrf-token"]').attr('content')
        };

        const url = editingRHSubSerial
            ? `/rh-client/update-subentry/${editingRHId}/${editingRHSubSerial}`
            : `/rh-client/update/${editingRHId}`;

        $.ajax({
            url: url,
            type: 'PUT',
            data: data,
            success: function () {
                alert('Updated successfully!');
                editingRHId = null;
                editingRHSubSerial = null;
                $('#rhClientForm')[0].reset();
                $('#rhSubmitBtn').removeClass('d-none');
                $('#rhSaveChangesBtn').addClass('d-none');
                loadRHClients();
            },
            error: function () {
                alert('Update failed.');
            }
        });
    });

    $('#confirmRHSubSerialEditBtn').on('click', function () {
        const subSerial = parseInt($('#rhEditSubSerialInput').val().trim());

        if (!subSerial || !editingRHGroup) {
            alert("Please enter a valid sub-serial number.");
            return;
        }

        $.ajax({
            url: '/rh-client/data', // You already have this route returning all data
            method: 'GET',
            success: function (data) {
                const match = data.find(item =>
                    item.date === editingRHGroup.date &&
                    item.supplier_name === editingRHGroup.supplier &&
                    item.sub_serials?.length > 1 &&
                    item.sub_serials.includes(subSerial)
                );

                if (!match) {
                    alert("Sub-serial not found.");
                    return;
                }

                // Find exact record from backend
                $.getJSON('/rh-client/data-all', function (fullData) {
                    const row = fullData.find(entry =>
                        entry.date === editingRHGroup.date &&
                        entry.supplier_name === editingRHGroup.supplier &&
                        parseInt(entry.sub_serial) === subSerial
                    );

                    if (!row) {
                        alert("Could not load data.");
                        return;
                    }

                    $('html, body').animate({ scrollTop: 0 }, 300);
                    $('#rhDate').val(row.date);
                    $('#supplierName').val(row.supplier_name);
                    $('#description').val(row.description || '');
                    $('#noOfCtns').val(row.no_of_ctns || '');
                    $('#unitsPerCtn').val(row.units_per_ctn || '');
                    $('#unitPrice').val(row.unit_price || '');
                    $('#weightInKg').val(row.weight || '');
                    $('#shippingRatePerKg').val(row.shipping_rate_per_kg || '');

                    editingRHId = row.id;
                    $('#rhClientForm').data('edit-id', editingRHId);

                    $('#rhSubmitBtn').addClass('d-none');
                    $('#rhSaveChangesBtn').removeClass('d-none');

                    $('#rhEditSubEntryModal').modal('hide');
                    $('#rhEditSubSerialInput').val('');
                });

            }
        });
    });

    $(document).on('click', '.delete-rh-btn', function () {
        const $row = $(this).closest('tr');
        const subSerials = JSON.parse($row.attr('data-subserials') || '[]');

        const isMultiple = subSerials.length > 1;
        const id = $row.data('id');
        const date = $row.data('date');
        const supplier = $row.data('supplier');

        $('#rhDeleteRowId').val(id);
        $('#rhDeleteDate').val(date);
        $('#rhDeleteSupplier').val(supplier);

        if (isMultiple) {
            $('#rhDeleteMessage').html(`
            This is a multiple entry.<br>
            <b>Date:</b> ${date}<br>
            <b>Supplier:</b> ${supplier}<br>
            Enter sub-serial number (e.g., <strong>1</strong>) or type <strong>all</strong>.
        `);
            $('#rhSubSerialInputWrapper').show();
            setTimeout(() => {
                $('#rhDeleteSubSerialInput').focus();
            }, 100);
        } else {
            $('#rhDeleteMessage').text('Are you sure you want to delete this RH entry?');
            $('#rhSubSerialInputWrapper').hide();
        }

        $('#rhDeleteModal').modal('show');
    });

    $('#confirmRHDeleteBtn').on('click', function () {
        const isMultiple = $('#rhSubSerialInputWrapper').is(':visible');
        const subSerial = $('#rhDeleteSubSerialInput').val().trim().toLowerCase();
        const id = $('#rhDeleteRowId').val();
        const date = $('#rhDeleteDate').val();
        const supplier = $('#rhDeleteSupplier').val();

        let url = '';
        let method = '';
        let data = {};

        if (isMultiple) {
            if (!subSerial) {
                alert("Please enter sub-serial number or 'all'");
                return;
            }

            // POST method for delete-multiple
            url = '/rh-client/delete-multiple';
            method = 'POST';
            data = {
                date: date,
                supplier_name: supplier,
                sub_serial: subSerial,
                _token: $('meta[name="csrf-token"]').attr('content')
            };
        } else {
            // Laravel DELETE method with CSRF
            url = `/rh-client/delete/${id}`;
            method = 'POST';
            data = {
                _method: 'DELETE', // Use _method override
                _token: $('meta[name="csrf-token"]').attr('content')
            };
        }

        $.ajax({
            url: url,
            type: method,
            data: data,
            success: function () {
                $('#rhDeleteModal').modal('hide');
                $('#rhDeleteSubSerialInput').val('');
                loadRHClients();
                alert("Deleted successfully.");
            },
            error: function (xhr) {
                console.error(xhr.responseText);
                alert("Failed to delete entry.");
            }
        });
    });

    $('#rhDeleteModal').on('shown.bs.modal', function () {
        setTimeout(() => {
            $('#rhDeleteSubSerialInput').focus();
        }, 100);
    });

    $('#rhFilteredExcelBtn').on('click', function () {
        const fromDate = $('#rhFromDate').val();
        const toDate = $('#rhToDate').val();

        if (!fromDate || !toDate) {
            alert('Please select both dates.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const headers = [];

        $('#rh-export-table thead tr:eq(0) th').each(function (i) {
            if (i !== 19) headers.push($(this).text().trim()); // Exclude Action column
        });

        const wsData = [headers];

        $('#rh-client-body tr:visible').each(function () {
            const rawDateStr = $(this).find('td:eq(1)').text().trim();
            const formattedRowDate = convertToISO(rawDateStr);

            if (!formattedRowDate) return;

            if (formattedRowDate >= fromDate && formattedRowDate <= toDate) {
                const rowData = [];
                $(this).find('td').each(function (i) {
                    if (i !== 19) {
                        rowData.push($(this).text().trim().replace(/<br\s*\/?>/gi, '\n'));
                    }
                });
                wsData.push(rowData);
            }
        });

        if (wsData.length === 1) {
            alert("No data in selected date range.");
            return;
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "RH Sheet");
        XLSX.writeFile(wb, 'rh_sheet_filtered.xlsx');
    });

    $('#applyRHDateFilter').on('click', function () {
        const fromDate = $('#rhFromDate').val();
        const toDate = $('#rhToDate').val();

        if (!fromDate || !toDate) {
            alert('Please select both From and To dates.');
            return;
        }

        $('#rh-client-body tr').each(function () {
            const rawDateStr = $(this).find('td:eq(1)').text().trim(); // Example: "Wednesday, 15 May 2025"
            const formattedRowDate = convertToISO(rawDateStr); // Will be: "2025-05-15"

            if (!formattedRowDate) {
                $(this).hide();
                return;
            }

            if (formattedRowDate >= fromDate && formattedRowDate <= toDate) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        $('#rhFilteredExcelBtn').removeClass('d-none');
        $('#rhDatePopupBox').fadeOut();
        $('#rhDateFilterInput').val(`${fromDate} to ${toDate}`);
    });

    $('#clearRHDateFilter').on('click', function () {
        $('#rh-client-body tr').show(); // Show all rows again
        $('#rhFilteredExcelBtn').addClass('d-none');
        $('#rhDateFilterInput').val('');
        $('#rhDatePopupBox').fadeOut();
    });

    $('#rhDateFilterInput').on('click', function () {
        const $input = $(this);
        const $popup = $('#rhDatePopupBox'); // changed ID from #rhDatePopup
        const popupHeight = $popup.outerHeight();
        const popupWidth = $popup.outerWidth();
        const inputOffset = $input.offset();
        const windowHeight = $(window).height();
        const windowWidth = $(window).width();

        let topPosition = inputOffset.top + $input.outerHeight() + 5;
        if ((topPosition + popupHeight) > $(window).scrollTop() + windowHeight) {
            topPosition = inputOffset.top - popupHeight - 5;
        }

        let leftPosition = inputOffset.left;
        if ((leftPosition + popupWidth) > windowWidth) {
            leftPosition = windowWidth - popupWidth - 10;
        }

        $popup.css({
            position: 'absolute',
            top: `${topPosition}px`,
            left: `${leftPosition}px`,
            zIndex: 9999
        }).appendTo('body').fadeIn();
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('#rhDateFilterInput, #rhDatePopupBox').length) {
            $('#rhDatePopupBox').fadeOut();
        }
    });

    $(document).on('click', '.copy-rh-btn', function () {
        const $row = $(this).closest('tr[data-id]');
        const subSerials = $row.data('subserials');

        const isMultiple = Array.isArray(subSerials) && subSerials.length > 1;

        if (isMultiple) {
            window.copyRHGroup = {
                sr_no: $row.data('sr-no'),
                subSerials: subSerials,
                date: $row.data('date'),
                supplier: $row.data('supplier')
            };
            $('#rhCopySubSerialInput').val('');
            $('#rhCopySubEntryModal').modal('show');
        } else {
            $('#rhDate').val($row.data('date'));
            $('#supplierName').val($row.data('supplier'));
            $('#rhDescription').val($row.attr('data-description') || '');
            $('#rhNoOfCtns').val($row.attr('data-no-of-ctns') || '');
            $('#rhUnitsPerCtn').val($row.attr('data-units-per-ctn') || '');
            $('#rhUnitPrice').val($row.attr('data-unit-price') || '');
            $('#rhWeight').val($row.attr('data-weight') || '');
            $('#rhShippingRate').val($row.attr('data-shipping-rate-per-kg') || '');

            $('#rhSubmitBtn').removeClass('d-none');
            $('#rhSaveChangesBtn').addClass('d-none');
            $('html, body').animate({ scrollTop: 0 }, 300);
        }
    });

    $('#confirmRHSubSerialCopyBtn').on('click', function () {
        const subSerial = parseInt($('#rhCopySubSerialInput').val().trim());

        if (!subSerial || !window.copyRHGroup) {
            alert("Please enter a valid sub-serial number.");
            return;
        }

        $.getJSON('/rh-client/data-all', function (fullData) {
            const matchedRow = fullData.find(entry =>
                entry.sr_no &&
                entry.sub_serial &&
                parseInt(entry.sr_no) === parseInt(copyRHGroup.sr_no) &&
                parseInt(entry.sub_serial) === subSerial
            );

            if (!matchedRow) {
                alert("Sub-serial not found.");
                return;
            }

            $('html, body').animate({ scrollTop: 0 }, 300);
            $('#rhDate').val(matchedRow.date);
            $('#supplierName').val(matchedRow.supplier_name);
            $('#rhDescription').val(matchedRow.description || '');
            $('#rhNoOfCtns').val(matchedRow.no_of_ctns || '');
            $('#rhUnitsPerCtn').val(matchedRow.units_per_ctn || '');
            $('#rhUnitPrice').val(matchedRow.unit_price || '');
            $('#rhWeight').val(matchedRow.weight || '');
            $('#rhShippingRate').val(matchedRow.shipping_rate_per_kg || '');

            $('#rhSubmitBtn').removeClass('d-none');
            $('#rhSaveChangesBtn').addClass('d-none');

            $('#rhCopySubEntryModal').modal('hide');
            $('#rhCopySubSerialInput').val('');
        });
    });

    $(function () {
        $('[data-bs-toggle="tooltip"]').tooltip();
    });

    // Handle form submission
    $('#rhLoanForm').on('submit', function (e) {
        e.preventDefault();

        const date = $('#rhLoanDate').val();
        const description = $('#rhLoanDescription').val();
        const amount = parseFloat($('#rhLoanAmount').val());

        if (!date || !description || isNaN(amount) || amount <= 0) {
            alert('Please fill in all fields correctly.');
            return;
        }

        const payload = {
            _token: $('meta[name="csrf-token"]').attr('content'),
            date,
            description,
            amount
        };

        if (editingLoanId) {
            // Update existing
            $.ajax({
                url: `/rh-loan/update/${editingLoanId}`,
                type: 'PUT',
                data: payload,
                success: function () {
                    resetLoanForm();
                    reloadLoanData();
                },
                error: function () {
                    alert('An error occurred while updating.');
                }
            });
        } else {
            // Create new
            $.ajax({
                url: '/rh-loan/save',
                type: 'POST',
                data: payload,
                success: function () {
                    resetLoanForm();
                    reloadLoanData();
                },
                error: function () {
                    alert('An error occurred while saving.');
                }
            });
        }
    });

    $.get('/rh-loan/entries', function (data) {
        rhLoanEntries = data;
        renderRhLoanTable();
    });

    $(document).on('click', '.rh-delete-loan-btn', function () {
        const id = $(this).data('id');
        $('#deleteLoanId').val(id);
        $('#deleteLoanModal').modal('show');
    });

    $('#confirmDeleteLoanBtn').on('click', function () {
        const id = $('#deleteLoanId').val();

        $.ajax({
            url: `/rh-loan/delete/${id}`,
            type: 'DELETE',
            data: {
                _token: $('meta[name="csrf-token"]').attr('content')
            },
            success: function () {
                $('#deleteLoanModal').modal('hide');

                // Reload data after delete
                $.get('/rh-loan/entries', function (data) {
                    rhLoanEntries = data;
                    renderRhLoanTable();
                });
            }
        });
    });

    $(document).on('click', '.rh-edit-loan-btn', function () {
        const $row = $(this).closest('tr');
        editingLoanId = $(this).data('id');

        // Fill the form
        $('#rhLoanDate').val($row.find('td:eq(1)').data('date'));
        $('#rhLoanDescription').val($row.find('td:eq(2)').text().trim());
        const amountText = $row.find('td:eq(3)').text().replace(/[^\d.-]/g, '');
        $('#rhLoanAmount').val(parseFloat(amountText));

        // Change button text
        $('#rhLoanSubmitBtn').text('Save Changes').removeClass('btn-success').addClass('btn-success');
    });

}

function loadRHClients() {
    $.ajax({
        url: '/rh-client/data',
        type: 'GET',
        success: function (data) {
            if (!Array.isArray(data)) {
                console.error('Invalid data format:', data);
                alert('Invalid response from server.');
                return;
            }

            data.sort((a, b) => a.sr_no - b.sr_no);

            $('#rh-client-body').empty();
            let totalMaterialSum = 0;
            let totalShipmentSum = 0;
            let grandTotalSum = 0;

            data.forEach((item, index) => {
                totalMaterialSum += item.total_material_sum || 0;
                totalShipmentSum += item.shipping_cost_sum || 0;
                grandTotalSum = totalMaterialSum + totalShipmentSum;

                const isMultipleEntry = item.sub_serials && item.sub_serials.length > 1;

                const formatWithSubSerial = (combinedValue) => {
                    if (!combinedValue) return '';
                    const values = combinedValue.split('<br>');
                    return values.join('<br>');
                };

                const $row = $('<tr></tr>').attr({
                    'data-id': item.id,
                    'data-date': item.date,
                    'data-supplier': item.supplier_name,
                    'data-sr-no': item.sr_no,
                    'data-subserials': JSON.stringify(item.sub_serials || []),
                });

                if (isMultipleEntry) {
                    $row.addClass('multi-entry-row');
                } else {
                    $row.attr({
                        'data-description': item.description?.toString() || '',
                        'data-no-of-ctns': item.no_of_ctns?.toString() || '',
                        'data-units-per-ctn': item.units_per_ctn?.toString() || '',
                        'data-unit-price': item.unit_price?.toString() || '',
                        'data-weight': item.weight?.toString() || '',
                        'data-shipping-rate-per-kg': item.shipping_rate_per_kg?.toString() || ''
                    });
                }

                $row.append(`<td data-bs-toggle="tooltip" title="SR.NO">${index + 1}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Date">${formatRHDate(item.date)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Supplier Name">${item.supplier_name || ''}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Description">${formatWithSubSerial(item.description_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="No. of CTNS" class="format-aed">${formatWithSubSerial(item.no_of_ctns_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Units/CTN" class="format-aed">${formatWithSubSerial(item.units_per_ctn_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Unit Price" class="format-aed">${formatWithSubSerial(item.unit_price_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Total No. of Units" class="format-aed">${formatWithSubSerial(item.total_units_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Weight in KG" class="format-aed">${formatWithSubSerial(item.weight_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Total Material" class="format-aed">${formatWithSubSerial(item.total_material_combined)}</td>`);
                if (isMultipleEntry) {
                    $row.append(`<td data-bs-toggle="tooltip" title="Invoice Total Material" class="format-aed">AED ${Number(item.total_material_sum || 0).toFixed(2)}</td>`);
                } else {
                    $row.append(`<td></td>`);
                }
                $row.append(`<td data-bs-toggle="tooltip" title="Shipping Rate" class="format-aed">${formatWithSubSerial(item.shipping_rate_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="DGD" class="format-aed">${formatWithSubSerial(item.dgd_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Labeling Charges" class="format-aed">${formatWithSubSerial(item.labeling_charges_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Labour" class="format-aed">${formatWithSubSerial(item.labour_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Shipping Cost" class="format-aed">${formatWithSubSerial(item.shipping_cost_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Total" class="format-aed">${formatWithSubSerial(item.total_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Cost/Unit AED" class="format-aed">${formatWithSubSerial(item.cost_per_unit_aed_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Cost/Unit USD" class="format-aed">${formatWithSubSerial(item.cost_per_unit_usd_combined)}</td>`);
                $row.append(`
                    <td>
                        <button class="btn btn-sm btn-success edit-rh-btn" data-bs-toggle="tooltip" title="Edit"><i class="bi bi-pencil-square"></i></button>
                        <button class="btn btn-sm btn-danger delete-rh-btn" data-id="${item.id}" data-bs-toggle="tooltip" title="Delete"><i class="bi bi-trash"></i></button>
                        <button class="btn btn-sm btn-secondary copy-rh-btn" data-bs-toggle="tooltip" title="Copy"><i class="bi bi-files"></i></button>
                    </td>
                `);

                $('#rh-client-body').append($row);
            });
            // Update the summary card with the calculated totals
            $('#rh-total-material').text('AED ' + totalMaterialSum.toLocaleString(undefined, { minimumFractionDigits: 2 }));
            $('#rh-total-shipment').text('AED ' + totalShipmentSum.toLocaleString(undefined, { minimumFractionDigits: 2 }));
            $('#rh-grand-total').text('AED ' + grandTotalSum.toLocaleString(undefined, { minimumFractionDigits: 2 }));

            applyNumberFormatting();

            $('[data-bs-toggle="tooltip"]').tooltip();
        },
        error: function (xhr) {
            console.error("Load RH Clients Error:", xhr.responseText);
            alert("Failed to load RH client data.");
        }
    });
}

function formatRHDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('en-GB', options);  // "Wednesday, 21 May 2025"
}

function exportRHExcel() {
    const wb = XLSX.utils.book_new();
    const wsData = [];

    // Get headers (exclude the filter row)
    const headers = [];
    $('#sheet-rh table thead tr:eq(0) th').each(function (index) {
        if (index < 19) headers.push($(this).text().trim());
    });
    wsData.push(headers);

    $('#sheet-rh table tbody tr').each(function () {
        const cells = $(this).find('td');
        const allColumns = [];

        cells.each(function (i) {
            if (i < 19) {
                const raw = $(this).html().trim().replace(/<br\s*\/?>/gi, '\n'); // convert line breaks to newline
                const lines = raw.split('\n').map(v => v.trim()).filter(Boolean);

                // Ensure at least 1 line exists for alignment
                allColumns.push(lines.length ? lines : ['']);
            }
        });

        const maxLines = Math.max(...allColumns.map(col => col.length));

        for (let i = 0; i < maxLines; i++) {
            const row = [];
            allColumns.forEach(col => {
                row.push(col[i] !== undefined ? col[i] : '');
            });
            wsData.push(row);
        }
    });

    // Add summary
    wsData.push([]);
    wsData.push(['Total Material', $('#rh-total-material').text()]);
    wsData.push(['Total Shipment', $('#rh-total-shipment').text()]);
    wsData.push(['Grand Total', $('#rh-grand-total').text()]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply wrap text to all cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws[cellRef]) {
                if (!ws[cellRef].s) ws[cellRef].s = {};
                ws[cellRef].s.alignment = { wrapText: true };
            }
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, "RH Sheet");
    XLSX.writeFile(wb, 'rh_sheet.xlsx');
}

// common funtion
function convertToISO(dateStr) {
    // Input: "Wednesday, 15 May 2025"
    const match = dateStr.match(/\d{1,2} \w+ \d{4}/); // => "15 May 2025"
    if (!match) return null;

    const parsed = new Date(match[0]);
    if (isNaN(parsed)) return null;

    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`; // Return in yyyy-mm-dd
}

function sendRHEntry() {
    const form = $('#rhClientForm')[0];
    const formData = new FormData(form);

    $.ajax({
        url: '/rh-client/save',
        method: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        success: function (response) {
            if (response.success) {
                $('#rhClientForm')[0].reset();
                $('#rhTotalUnitsHidden').val('');
                loadRHClients();
                $('html, body').animate({
                    scrollTop: $('#rh-client-body').closest('table').offset().top - 100
                }, 500);
            } else {
                alert('Save failed. Check response.');
            }
        },
        error: function (xhr) {
            alert('Error saving entry');
            console.log(xhr.responseText);
        }
    });
}

function sendRHEntryEdit() {
    if (editingRHId === null || isNaN(editingRHId)) {
        alert("Missing record ID.");
        return;
    }

    const noOfCtns = parseFloat($('#rhNoOfCtns').val()) || 0;
    const unitsPerCtn = parseFloat($('#rhUnitsPerCtn').val()) || 0;
    const manualTotalUnits = parseFloat($('#rhTotalUnitsHidden').val()) || 0;

    let totalUnits = 0;
    if (noOfCtns > 0 && unitsPerCtn > 0) {
        totalUnits = noOfCtns * unitsPerCtn;
    } else if (manualTotalUnits > 0) {
        totalUnits = manualTotalUnits;
    } else {
        $('#rhManualUnitsModal').data('source', 'edit');
        $('#rhManualUnitsModal').modal('show');
        return;
    }

    const data = {
        date: $('#rhDate').val(),
        supplier_name: $('#supplierName').val(),
        description: $('#rhDescription').val(),
        no_of_ctns: noOfCtns,
        units_per_ctn: unitsPerCtn,
        unit_price: $('#rhUnitPrice').val(),
        weight: $('#rhWeight').val(),
        shipping_rate_per_kg: $('#rhShippingRate').val(),
        total_units: totalUnits,
        _token: $('meta[name="csrf-token"]').attr('content')
    };

    const url = window.editingRHSubSerial
        ? `/rh-client/update-subentry/${editingRHId}/${editingRHSubSerial}`
        : `/rh-client/update/${editingRHId}`;

    $.ajax({
        url: url,
        type: 'PUT',
        data: data,
        success: function () {
            alert('Updated successfully!');
            editingRHId = null;
            editingRHSubSerial = null;
            $('#rhClientForm')[0].reset();
            $('#rhTotalUnitsHidden').val('');
            $('#rhSubmitBtn').removeClass('d-none');
            $('#rhSaveChangesBtn').addClass('d-none');
            loadRHClients();
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        },
        error: function () {
            alert('Update failed.');
        }
    });
}

// Render table and update totals
function renderRhLoanTable() {
    const tbody = $('#rhLoanTable tbody');
    tbody.empty();

    let totalPaid = 0;
    rhLoanEntries.forEach((entry, index) => {
        totalPaid += parseFloat(entry.amount);
        const row = `
            <tr data-id="${entry.id}">
                <td data-bs-toggle="tooltip" title="SR.NO">${index + 1}</td>
                <td data-bs-toggle="tooltip" title="Date" data-date="${entry.date}">${formatDate(entry.date)}</td>
                <td data-bs-toggle="tooltip" title="Description">${entry.description}</td>
                <td data-bs-toggle="tooltip" title="Amount">
                    AED ${parseFloat(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td>
                    <button class="btn btn-sm btn-success ms-1 rh-edit-loan-btn" data-bs-toggle="tooltip" title="Edit" data-id="${entry.id}">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-danger ms-2 rh-delete-loan-btn" data-bs-toggle="tooltip" title="Delete" data-id="${entry.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        $('[data-bs-toggle="tooltip"]').tooltip();
        tbody.append(row);
    });

    // Update summary cards
    $('#rhLoanTotalPaid').text(`AED ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

    const rhSheetTotal = parseFloat($('#rh-grand-total').text().replace(/[^\d.-]/g, '')) || 0;
    $('#rhLoanTotalSheet').text(`AED ${rhSheetTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

    const balance = totalPaid - rhSheetTotal;
    $('#rhLoanBalance').text(`AED ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
}

// Utility function
function formatDate(dateString) {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Reset form to Add mode
function resetLoanForm() {
    editingLoanId = null;
    $('#rhLoanForm')[0].reset();
    $('#rhLoanSubmitBtn').text('Add Entry').removeClass('btn-primary').addClass('btn-success');
}

// Reload table
function reloadLoanData() {
    $.get('/rh-loan/entries', function (data) {
        rhLoanEntries = data;
        renderRhLoanTable();
    });
}

// FF Sheet Logic Initialization
let ffMultiEntryData = [];
let ffCurrentStep = 1;

let editingFFGroup = null;

function initFFLogic() {
    $.ajaxSetup({
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        }
    });

    $('#ffSubmitBtn').on('click', function (e) {
        e.preventDefault();

        const noOfCtns = parseFloat($('#ffNoOfCtns').val());
        const unitsPerCtn = parseFloat($('#ffUnitsPerCtn').val());

        if ((!noOfCtns || noOfCtns === 0) && (!unitsPerCtn || unitsPerCtn === 0)) {
            $('#ffManualTotalUnitsInput').val('');
            $('#ffManualUnitsModal').data('source', 'submit');
            $('#ffManualUnitsModal').modal('show');
            return;
        }

        // Otherwise, send directly
        sendFFEntry();
    });

    $('#ffConfirmManualUnitsBtn').on('click', function () {
        const manualUnits = parseFloat($('#ffManualTotalUnitsInput').val());

        if (!manualUnits || manualUnits <= 0) {
            alert('Please enter a valid total number of units.');
            return;
        }

        $('#ffTotalUnitsHidden').val(manualUnits);
        $('#ffManualTotalUnitsInput').val('');
        $('#ffManualUnitsModal').modal('hide');

        const mode = $('#ffManualUnitsModal').data('source');
        if (mode === 'edit') {
            sendFFEntryEdit();
        } else {
            sendFFEntry();
        }
    });

    // Open Multiple Entry Modal
    $('#openFFMultiEntryModalBtn').on('click', function () {
        ffMultiEntryData = [];
        ffCurrentStep = 1;
        $('#ff-multi-step-wrapper').show();
        $('#ff-entry-fields-container').hide();
        $('#ff-number-of-entries').val('');
        $('#ffMultiEntryModal').modal('show');
    });

    $('#ff-start-entry-btn').on('click', function () {
        const count = parseInt($('#ff-number-of-entries').val());
        if (!count || count < 1) {
            alert("Enter valid number");
            return;
        }
        ffMultiEntryData = new Array(count).fill({});
        ffCurrentStep = 1;
        showFFEntryForm(ffCurrentStep);
        $('#ff-multi-step-wrapper').hide();
        $('#ff-entry-fields-container').show();
    });

    $('#ff-next-entry-btn').on('click', function () {
        const $row = $('.entry-row[data-step="' + ffCurrentStep + '"]');
        const noOfCtns = parseFloat($row.find('[name="no_of_ctns"]').val()) || 0;
        const unitsPerCtn = parseFloat($row.find('[name="units_per_ctn"]').val()) || 0;

        if ((!noOfCtns || noOfCtns === 0) && (!unitsPerCtn || unitsPerCtn === 0)) {
            const manualInput = $row.find('[name="manual_total_units"]');
            if (manualInput.length === 0) {
                $row.append(`
                <div class="col-md-6">
                    <input type="number" step="any" class="form-control border-danger mt-2" name="manual_total_units" placeholder="⚠️ Total No of Units (required if CTNS or Units/CTN missing)">
                </div>
            `);
                return;
            }

            const manualUnits = parseFloat(manualInput.val());
            if (!manualUnits || manualUnits <= 0) {
                alert("Please enter Total No of Units.");
                return;
            }
        }

        storeFFEntryData(ffCurrentStep);
        if (ffCurrentStep < ffMultiEntryData.length) {
            ffCurrentStep++;
            showFFEntryForm(ffCurrentStep);
        } else {
            $('#ff-next-entry-btn').hide();
            $('#ff-submit-multi-entry').removeClass('d-none');
        }
    });

    $('#ff-prev-entry-btn').on('click', function () {
        storeFFEntryData(ffCurrentStep);
        if (ffCurrentStep > 1) {
            ffCurrentStep--;
            showFFEntryForm(ffCurrentStep);
        }
    });

    $('#ff-multi-entry-form').submit(function (e) {
        e.preventDefault();
        storeFFEntryData(ffCurrentStep);
        const supplier = $('#ffClientForm').find('[name="supplier_name"]').val().trim();
        const date = $('#ffDate').val();

        if (!supplier || !date) {
            alert("Supplier name and date are required.");
            return;
        }

        $.ajax({
            url: '/ff-client/save-multiple',
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
            },
            data: {
                date: date,
                supplier_name: supplier,
                entries: ffMultiEntryData,
                multiple_entry: true  // This flag tells backend it's grouped entry
            },
            success: function () {
                $('#ffMultiEntryModal').modal('hide');
                alert('Multiple entries saved!');
                loadFFClients();
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            },
            error: function (xhr) {
                console.error(xhr.responseText);
                alert("Error saving multiple entries.");
            }
        });
    });

    function showFFEntryForm(step) {
        const entry = ffMultiEntryData[step - 1] || {};
        const html = `
        <div class="step-label mb-2"><strong>Entry ${step}</strong></div>
        <div class="row g-3 entry-row" data-step="${step}">
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="unit_price" placeholder="Unit Price" value="${entry.unit_price || ''}">
            </div>
            <div class="col-md-4">
                <input type="text" class="form-control" name="description" placeholder="Description" value="${entry.description || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="no_of_ctns" placeholder="No of CTNS" value="${entry.no_of_ctns || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="units_per_ctn" placeholder="Units/CTN" value="${entry.units_per_ctn || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="weight" placeholder="Weight in KG" value="${entry.weight || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="shipping_rate_per_kg" placeholder="Shipping Rate/KG" value="${entry.shipping_rate_per_kg || ''}">
            </div>
        </div>
    `;
        $('#ff-entry-form-fields').html(html);
    }

    function storeFFEntryData(step) {
        const $row = $('.entry-row[data-step="' + step + '"]');

        ffMultiEntryData[step - 1] = {
            unit_price: parseFloat($row.find('[name="unit_price"]').val()) || 0,
            description: $row.find('[name="description"]').val() || '',
            no_of_ctns: parseFloat($row.find('[name="no_of_ctns"]').val()) || 0,
            units_per_ctn: parseFloat($row.find('[name="units_per_ctn"]').val()) || 0,
            weight: parseFloat($row.find('[name="weight"]').val()) || 0,
            shipping_rate_per_kg: parseFloat($row.find('[name="shipping_rate_per_kg"]').val()) || 0,
            manual_total_units: parseFloat($row.find('[name="manual_total_units"]').val()) || 0
        };
    }

    $(document).on('click', '.edit-ff-btn', function () {
        const $row = $(this).parents('tr[data-id]');
        const id = $row.data('id');
        const subSerials = $row.data('subserials');

        if (subSerials && subSerials.length > 1) {
            editingFFGroup = {
                sr_no: $row.data('sr-no'),
                subSerials: subSerials
            };
            editingFFId = id;

            $('#ffEditSubSerialInput').val('');
            $('#ffEditSubEntryModal').modal('show');
        } else {
            editingFFId = id;
            $('#ffDate').val($row.data('date'));
            $('#ffSupplierName').val($row.data('supplier'));
            $('#ffDescription').val($row.find('td:eq(3)').text().trim());
            $('#ffNoOfCtns').val($row.find('td:eq(4)').text().trim());
            $('#ffUnitsPerCtn').val($row.find('td:eq(5)').text().trim());
            $('#ffUnitPrice').val($row.find('td:eq(6)').text().replace('AED', '').trim());
            $('#ffWeight').val($row.find('td:eq(8)').text().trim());
            $('#ffShippingRate').val($row.data('shipping-rate-per-kg'));

            $('#ffSubmitBtn').addClass('d-none');
            $('#ffSaveChangesBtn').removeClass('d-none');
            $('html, body').animate({ scrollTop: 0 }, 300);
        }
    });

    $('#confirmFFSubSerialEditBtn').on('click', function () {
        const subSerial = parseInt($('#ffEditSubSerialInput').val().trim());

        if (!subSerial || !editingFFGroup || !editingFFGroup.sr_no) {
            alert("Missing serial number or sub-serial.");
            return;
        }

        const srNo = parseInt(editingFFGroup.sr_no);

        console.log("🔍 Looking for entry with:", { sr_no: srNo, sub_serial: subSerial });

        $.getJSON('/ff-client/data-all', function (fullData) {
            const row = fullData.find(entry =>
                parseInt(entry.sr_no) === srNo &&
                parseInt(entry.sub_serial) === subSerial
            );

            if (!row) {
                alert("Could not load data.");
                return;
            }

            editingFFId = row.id;
            editingFFSubSerial = subSerial;

            // Populate form fields
            $('html, body').animate({ scrollTop: 0 }, 300);
            $('#ffDate').val(row.date);
            $('#ffsupplierName').val(row.supplier_name || '');
            $('#ffDescription').val(row.description || '');
            $('#ffNoOfCtns').val(row.no_of_ctns || '');
            $('#ffUnitsPerCtn').val(row.units_per_ctn || '');
            $('#ffUnitPrice').val(row.unit_price || '');
            $('#ffWeight').val(row.weight || '');
            $('#ffShippingRate').val(row.shipping_rate_per_kg || '');

            $('#ffSubmitBtn').addClass('d-none');
            $('#ffSaveChangesBtn').removeClass('d-none');

            $('#ffEditSubEntryModal').modal('hide');
            $('#ffEditSubSerialInput').val('');
        });
    });

    $('#ffSaveChangesBtn').on('click', function () {
        sendFFEntryEdit();
    });

    $(document).on('click', '.delete-ff-btn', function () {
        const $row = $(this).closest('tr');
        const id = $row.data('id');
        const date = $row.data('date');

        let supplier = $row.data('supplier');
        if (!supplier) {
            supplier = $row.find('td:eq(2)').text().trim();
        }

        const subSerials = JSON.parse($row.attr('data-subserials') || '[]');
        const isMultiple = subSerials.length > 1;

        $('#ffDeleteRowId').val(id);
        $('#ffDeleteDate').val(date);
        $('#ffDeleteSupplier').val(supplier);

        if (isMultiple) {
            $('#ffDeleteMessage').html(`
            This is a multiple entry.<br>
            <b>Date:</b> ${date}<br>
            <b>Supplier:</b> ${supplier}<br>
            Enter sub-serial number (e.g., <strong>1</strong>) or type <strong>all</strong>.
            `);
            $('#ffSubSerialInputWrapper').show();
            setTimeout(() => {
                $('#ffDeleteSubSerialInput').focus();
            }, 100);
        } else {
            $('#ffDeleteMessage').text('Are you sure you want to delete this FF entry?');
            $('#ffSubSerialInputWrapper').hide();
        }

        $('#ffDeleteModal').modal('show');
    });

    $('#confirmFFDeleteBtn').on('click', function () {
        const isMultiple = $('#ffSubSerialInputWrapper').is(':visible');
        const subSerial = $('#ffDeleteSubSerialInput').val().trim().toLowerCase();
        const id = $('#ffDeleteRowId').val();
        const date = $('#ffDeleteDate').val();
        const supplier = $('#ffDeleteSupplier').val();

        console.log("Deleting with:", { id, date, supplier, subSerial });

        let url = '';
        let method = '';
        let data = {};

        if (isMultiple) {
            if (!subSerial) {
                alert("Please enter sub-serial number or 'all'");
                return;
            }

            // POST method for delete-multiple
            url = '/ff-client/delete-multiple';
            method = 'POST';
            data = {
                date: date,
                supplier_name: supplier,
                sub_serial: subSerial,
                _token: $('meta[name="csrf-token"]').attr('content')
            };
        } else {
            // Laravel DELETE method with CSRF
            url = `/ff-client/delete/${id}`;
            method = 'POST';
            data = {
                _method: 'DELETE', // Use _method override
                _token: $('meta[name="csrf-token"]').attr('content')
            };
        }

        $.ajax({
            url: url,
            type: method,
            data: data,
            success: function () {
                $('#ffDeleteModal').modal('hide');
                $('#ffDeleteSubSerialInput').val('');
                loadFFClients();
                alert("Deleted successfully.");
            },
            error: function (xhr) {
                console.error(xhr.responseText);
                alert("Failed to delete entry.");
            }
        });
    });

    $('#ffDeleteModal').on('shown.bs.modal', function () {
        setTimeout(() => {
            $('#ffDeleteSubSerialInput').focus();
        }, 100);
    });

    $('#ffFilteredExcelBtn').on('click', function () {
        const fromDate = $('#ffFromDate').val();
        const toDate = $('#ffToDate').val();

        if (!fromDate || !toDate) {
            alert('Please select both dates.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const headers = [];

        $('#ff-export-table thead tr:eq(0) th').each(function (i) {
            if (i !== 19) headers.push($(this).text().trim()); // Exclude Action column
        });

        const wsData = [headers];

        $('#ff-client-body tr:visible').each(function () {
            const rawDateStr = $(this).find('td:eq(1)').text().trim();
            const formattedRowDate = convertToISO(rawDateStr);

            if (!formattedRowDate) return;

            if (formattedRowDate >= fromDate && formattedRowDate <= toDate) {
                const rowData = [];
                $(this).find('td').each(function (i) {
                    if (i !== 19) {
                        rowData.push($(this).text().trim().replace(/<br\s*\/?>/gi, '\n'));
                    }
                });
                wsData.push(rowData);
            }
        });

        if (wsData.length === 1) {
            alert("No data in selected date range.");
            return;
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "FF Sheet");
        XLSX.writeFile(wb, 'ff_sheet_filtered.xlsx');
    });

    $('#applyFFDateFilter').on('click', function () {
        const fromDate = $('#ffFromDate').val();
        const toDate = $('#ffToDate').val();

        if (!fromDate || !toDate) {
            alert('Please select both From and To dates.');
            return;
        }

        $('#ff-client-body tr').each(function () {
            const rawDateStr = $(this).find('td:eq(1)').text().trim(); // Example: "Wednesday, 15 May 2025"
            const formattedRowDate = convertToISO(rawDateStr); // Will be: "2025-05-15"

            if (!formattedRowDate) {
                $(this).hide();
                return;
            }

            if (formattedRowDate >= fromDate && formattedRowDate <= toDate) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        $('#ffFilteredExcelBtn').removeClass('d-none');
        $('#ffDatePopupBox').fadeOut();
        $('#ffDateFilterInput').val(`${fromDate} to ${toDate}`);
    });

    $('#clearFFDateFilter').on('click', function () {
        $('#ff-client-body tr').show(); // Show all rows again
        $('#ffFilteredExcelBtn').addClass('d-none');
        $('#ffDateFilterInput').val('');
        $('#ffDatePopupBox').fadeOut();
    });

    $('#ffDateFilterInput').on('click', function () {
        const $input = $(this);
        const $popup = $('#ffDatePopupBox'); // changed ID from #ffDatePopup
        const popupHeight = $popup.outerHeight();
        const popupWidth = $popup.outerWidth();
        const inputOffset = $input.offset();
        const windowHeight = $(window).height();
        const windowWidth = $(window).width();

        let topPosition = inputOffset.top + $input.outerHeight() + 5;
        if ((topPosition + popupHeight) > $(window).scrollTop() + windowHeight) {
            topPosition = inputOffset.top - popupHeight - 5;
        }

        let leftPosition = inputOffset.left;
        if ((leftPosition + popupWidth) > windowWidth) {
            leftPosition = windowWidth - popupWidth - 10;
        }

        $popup.css({
            position: 'absolute',
            top: `${topPosition}px`,
            left: `${leftPosition}px`,
            zIndex: 9999
        }).appendTo('body').fadeIn();
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('#ffDateFilterInput, #ffDatePopupBox').length) {
            $('#ffDatePopupBox').fadeOut();
        }
    });

    $(document).on('click', '.copy-ff-btn', function () {
        const $row = $(this).closest('tr[data-id]');
        const subSerials = $row.data('subserials');

        // Check if this is a multiple-entry row
        const isMultiple = Array.isArray(subSerials) && subSerials.length > 1;

        if (isMultiple) {
            window.copyFFGroup = {
                sr_no: $row.data('sr-no'),
                subSerials: subSerials,
                date: $row.data('date'),
                supplier: $row.data('supplier')
            };
            $('#ffCopySubSerialInput').val('');
            $('#ffCopySubEntryModal').modal('show');
        } else {
            // Handle normal (non-multiple) row copy
            $('#ffDate').val($row.data('date'));
            $('#ffSupplierName').val($row.data('supplier'));
            $('#ffDescription').val($row.attr('data-description') || '');
            $('#ffNoOfCtns').val($row.attr('data-no-of-ctns') || '');
            $('#ffUnitsPerCtn').val($row.attr('data-units-per-ctn') || '');
            $('#ffUnitPrice').val($row.attr('data-unit-price') || '');
            $('#ffWeight').val($row.attr('data-weight') || '');
            $('#ffShippingRate').val($row.attr('data-shipping-rate-per-kg') || '');

            // Copy mode - show submit, hide save
            $('#ffSubmitBtn').removeClass('d-none');
            $('#ffSaveChangesBtn').addClass('d-none');
            $('html, body').animate({ scrollTop: 0 }, 300);
        }
    });

    $('#confirmFFSubSerialCopyBtn').on('click', function () {
        const subSerial = parseInt($('#ffCopySubSerialInput').val().trim());

        if (!subSerial || !window.copyFFGroup) {
            alert("Please enter a valid sub-serial number.");
            return;
        }

        $.getJSON('/ff-client/data-all', function (fullData) {
            const matchedRow = fullData.find(entry =>
                entry.sr_no &&
                entry.sub_serial &&
                parseInt(entry.sr_no) === parseInt(copyFFGroup.sr_no) &&
                parseInt(entry.sub_serial) === subSerial
            );

            if (!matchedRow) {
                alert("Sub-serial not found.");
                return;
            }

            // Populate form fields
            $('html, body').animate({ scrollTop: 0 }, 300);
            $('#ffDate').val(matchedRow.date);
            $('#ffSupplierName').val(matchedRow.supplier_name);
            $('#ffDescription').val(matchedRow.description || '');
            $('#ffNoOfCtns').val(matchedRow.no_of_ctns || '');
            $('#ffUnitsPerCtn').val(matchedRow.units_per_ctn || '');
            $('#ffUnitPrice').val(matchedRow.unit_price || '');
            $('#ffWeight').val(matchedRow.weight || '');
            $('#ffShippingRate').val(matchedRow.shipping_rate_per_kg || '');

            // Set to copy mode (submit not save)
            $('#ffSubmitBtn').removeClass('d-none');
            $('#ffSaveChangesBtn').addClass('d-none');

            $('#ffCopySubEntryModal').modal('hide');
            $('#ffCopySubSerialInput').val('');
        });
    });

    $(function () {
        $('[data-bs-toggle="tooltip"]').tooltip();
    });
}

function loadFFClients() {
    $.ajax({
        url: '/ff-client/data',
        type: 'GET',
        success: function (data) {
            if (!Array.isArray(data)) {
                console.error('Invalid data format:', data);
                alert('Invalid response from server.');
                return;
            }

            data.sort((a, b) => a.sr_no - b.sr_no);

            $('#ff-client-body').empty();
            let totalMaterialSum = 0;
            let totalShipmentSum = 0;
            let grandTotalSum = 0;

            data.forEach(item => {
                totalMaterialSum += item.total_material_sum || 0;
                totalShipmentSum += item.shipping_cost_sum || 0;
                grandTotalSum = totalMaterialSum + totalShipmentSum;

                const isMultipleEntry = item.sub_serials && item.sub_serials.length > 1;

                const formatWithSubSerial = (combinedValue) => {
                    if (!combinedValue) return '';
                    const values = combinedValue.split('<br>');
                    return values.join('<br>');
                };

                const $row = $('<tr></tr>').attr({
                    'data-id': item.id,
                    'data-date': item.date,
                    'data-sr-no': item.sr_no,
                    'data-supplier-name': item.supplier_name,
                    'data-subserials': JSON.stringify(item.sub_serials || [])
                });

                if (isMultipleEntry) {
                    $row.addClass('multi-entry-row');
                } else {
                    $row.attr({
                        'data-description': item.description?.toString() || '',
                        'data-no-of-ctns': item.no_of_ctns?.toString() || '',
                        'data-units-per-ctn': item.units_per_ctn?.toString() || '',
                        'data-unit-price': item.unit_price?.toString() || '',
                        'data-weight': item.weight?.toString() || '',
                        'data-shipping-rate-per-kg': item.shipping_rate_per_kg?.toString() || ''
                    });
                }

                $row.append(`<td data-bs-toggle="tooltip" title="SR.NO">${item.sr_no}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Date">${formatFFDate(item.date)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Supplier Name">${item.supplier_name || ''}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Description">${formatWithSubSerial(item.description_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="No. of CTNS" class="format-aed">${formatWithSubSerial(item.no_of_ctns_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Units/CTN" class="format-aed">${formatWithSubSerial(item.units_per_ctn_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Unit Price" class="format-aed">${formatWithSubSerial(item.unit_price_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Total No. of Units" class="format-aed">${formatWithSubSerial(item.total_units_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Weight in KG" class="format-aed">${formatWithSubSerial(item.weight_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Total Material" class="format-aed">${formatWithSubSerial(item.total_material_combined)}</td>`);
                if (isMultipleEntry) {
                    $row.append(`<td data-bs-toggle="tooltip" title="Invoice Total Material" class="format-aed">AED ${Number(item.total_material_sum || 0).toFixed(2)}</td>`);
                } else {
                    $row.append(`<td></td>`);
                }
                $row.append(`<td data-bs-toggle="tooltip" title="Shipping Rate" class="format-aed">${formatWithSubSerial(item.shipping_rate_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="DGD" class="format-aed">${formatWithSubSerial(item.dgd_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Labeling Charges" class="format-aed">${formatWithSubSerial(item.labeling_charges_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Labour"class="format-aed">${formatWithSubSerial(item.labour_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Shipping Cost" class="format-aed">${formatWithSubSerial(item.shipping_cost_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Total" class="format-aed">${formatWithSubSerial(item.total_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Cost/Unit AED" class="format-aed">${formatWithSubSerial(item.cost_per_unit_aed_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Cost/Unit USD" class="format-aed">${formatWithSubSerial(item.cost_per_unit_usd_combined)}</td>`);
                $row.append(`
                    <td>
                        <button class="btn btn-sm btn-success edit-ff-btn" data-bs-toggle="tooltip" title="Edit"><i class="bi bi-pencil-square"></i></button>
                        <button class="btn btn-sm btn-danger delete-ff-btn" data-id="${item.id}" data-bs-toggle="tooltip" title="Delete"><i class="bi bi-trash"></i></button>
                        <button class="btn btn-sm btn-secondary copy-ff-btn" data-bs-toggle="tooltip" title="Copy"><i class="bi bi-files"></i></button>
                    </td>
                `);

                $('#ff-client-body').append($row);
            });
            // Update the summary card with the calculated totals
            $('#ff-total-material').text('AED ' + totalMaterialSum.toLocaleString(undefined, { minimumFractionDigits: 2 }));
            $('#ff-total-shipment').text('AED ' + totalShipmentSum.toLocaleString(undefined, { minimumFractionDigits: 2 }));
            $('#ff-grand-total').text('AED ' + grandTotalSum.toLocaleString(undefined, { minimumFractionDigits: 2 }));

            applyNumberFormatting();

            $('[data-bs-toggle="tooltip"]').tooltip();
        },
        error: function (xhr) {
            console.error("Load FF Clients Error:", xhr.responseText);
            alert("Failed to load FF client data.");
        }
    });
}

function formatFFDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('en-GB', options);  // "Wednesday, 21 May 2025"
}

function exportFFExcel() {
    const wb = XLSX.utils.book_new();
    const wsData = [];

    // Get headers (exclude the filter row)
    const headers = [];
    $('#sheet-ff table thead tr:eq(0) th').each(function (index) {
        if (index < 19) headers.push($(this).text().trim());
    });
    wsData.push(headers);

    $('#sheet-ff table tbody tr').each(function () {
        const cells = $(this).find('td');
        const allColumns = [];

        cells.each(function (i) {
            if (i < 19) {
                const raw = $(this).html().trim().replace(/<br\s*\/?>/gi, '\n'); // convert line breaks to newline
                const lines = raw.split('\n').map(v => v.trim()).filter(Boolean);

                // Ensure at least 1 line exists for alignment
                allColumns.push(lines.length ? lines : ['']);
            }
        });

        const maxLines = Math.max(...allColumns.map(col => col.length));

        for (let i = 0; i < maxLines; i++) {
            const row = [];
            allColumns.forEach(col => {
                row.push(col[i] !== undefined ? col[i] : '');
            });
            wsData.push(row);
        }
    });

    // Add summary
    wsData.push([]);
    wsData.push(['Total Material', $('#ff-total-material').text()]);
    wsData.push(['Total Shipment', $('#ff-total-shipment').text()]);
    wsData.push(['Grand Total', $('#ff-grand-total').text()]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply wrap text to all cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws[cellRef]) {
                if (!ws[cellRef].s) ws[cellRef].s = {};
                ws[cellRef].s.alignment = { wrapText: true };
            }
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, "FF Sheet");
    XLSX.writeFile(wb, 'ff_sheet.xlsx');
}

function sendFFEntry() {
    const form = $('#ffClientForm')[0];
    const formData = new FormData(form);

    $.ajax({
        url: '/ff-client/save',
        method: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        success: function (response) {
            if (response.success) {
                $('#ffClientForm')[0].reset();
                $('#ffTotalUnitsHidden').val('');
                loadFFClients();
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            } else {
                alert('Save failed. Check response.');
            }
        },
        error: function (xhr) {
            alert('Error saving entry');
            console.log(xhr.responseText);
        }
    });
}

function sendFFEntryEdit() {
    console.log("editingFFId:", editingFFId);

    if (editingFFId === null || isNaN(editingFFId)) {
        alert("Missing record ID.");
        return;
    }

    const noOfCtns = parseFloat($('#ffNoOfCtns').val()) || 0;
    const unitsPerCtn = parseFloat($('#ffUnitsPerCtn').val()) || 0;
    const manualTotalUnits = parseFloat($('#ffTotalUnitsHidden').val()) || 0;

    // Calculate total units
    let totalUnits = 0;
    if (noOfCtns > 0 && unitsPerCtn > 0) {
        totalUnits = noOfCtns * unitsPerCtn;
    } else if (manualTotalUnits > 0) {
        totalUnits = manualTotalUnits;
    } else {
        // Save flag so we know we're editing
        $('#ffManualUnitsModal').data('source', 'edit');
        $('#ffManualUnitsModal').modal('show');
        return;
    }

    const data = {
        date: $('#ffDate').val(),
        supplier_name: $('#ffSupplierName').val(),
        description: $('#ffDescription').val(),
        no_of_ctns: noOfCtns,
        units_per_ctn: unitsPerCtn,
        unit_price: $('#ffUnitPrice').val(),
        weight: $('#ffWeight').val(),
        shipping_rate_per_kg: $('#ffShippingRate').val(),
        total_units: totalUnits,
        _token: $('meta[name="csrf-token"]').attr('content')
    };

    const url = window.editingFFSubSerial
        ? `/ff-client/update-subentry/${editingFFId}/${editingFFSubSerial}`
        : `/ff-client/update/${editingFFId}`;

    $.ajax({
        url: url,
        type: 'PUT',
        data: data,
        success: function () {
            alert('Updated successfully!');
            editingFFId = null;
            editingFFSubSerial = null;
            $('#ffClientForm')[0].reset();
            $('#ffTotalUnitsHidden').val('');
            $('#ffSubmitBtn').removeClass('d-none');
            $('#ffSaveChangesBtn').addClass('d-none');
            loadFFClients();
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        },
        error: function () {
            alert('Update failed.');
        }
    });
}

// BL Sheet Logic Initialization
let blMultiEntryData = [];
let blCurrentStep = 1;

let editingBLGroup = null;

function initBLLogic() {
    $.ajaxSetup({
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        }
    });

    $('#blSubmitBtn').on('click', function (e) {
        e.preventDefault();

        const noOfCtns = parseFloat($('#blNoOfCtns').val());
        const unitsPerCtn = parseFloat($('#blUnitsPerCtn').val());

        if ((!noOfCtns || noOfCtns === 0) && (!unitsPerCtn || unitsPerCtn === 0)) {
            $('#blManualTotalUnitsInput').val('');
            $('#blManualUnitsModal').data('source', 'submit');
            $('#blManualUnitsModal').modal('show');
            return;
        }

        // Otherwise, send directly
        sendBLEntry();
    });

    $('#blConfirmManualUnitsBtn').on('click', function () {
        const manualUnits = parseFloat($('#blManualTotalUnitsInput').val());

        if (!manualUnits || manualUnits <= 0) {
            alert('Please enter a valid total number of units.');
            return;
        }

        $('#blTotalUnitsHidden').val(manualUnits);
        $('#blManualTotalUnitsInput').val('');
        $('#blManualUnitsModal').modal('hide');

        const mode = $('#blManualUnitsModal').data('source');
        if (mode === 'edit') {
            sendBLEntryEdit();
        } else {
            sendBLEntry();
        }
    });

    // Open Multiple Entry Modal
    $('#openBLMultiEntryModalBtn').on('click', function () {
        blMultiEntryData = [];
        blCurrentStep = 1;
        $('#bl-multi-step-wrapper').show();
        $('#bl-entry-fields-container').hide();
        $('#bl-number-of-entries').val('');
        $('#blMultiEntryModal').modal('show');
    });

    $('#bl-start-entry-btn').on('click', function () {
        const count = parseInt($('#bl-number-of-entries').val());
        if (!count || count < 1) {
            alert("Enter valid number");
            return;
        }
        blMultiEntryData = new Array(count).fill({});
        blCurrentStep = 1;
        showBLEntryForm(blCurrentStep);
        $('#bl-multi-step-wrapper').hide();
        $('#bl-entry-fields-container').show();
    });

    $('#bl-next-entry-btn').on('click', function () {
        const $row = $('.entry-row[data-step="' + blCurrentStep + '"]');
        const noOfCtns = parseFloat($row.find('[name="no_of_ctns"]').val()) || 0;
        const unitsPerCtn = parseFloat($row.find('[name="units_per_ctn"]').val()) || 0;

        if ((!noOfCtns || noOfCtns === 0) && (!unitsPerCtn || unitsPerCtn === 0)) {
            const manualInput = $row.find('[name="manual_total_units"]');
            if (manualInput.length === 0) {
                $row.append(`
                <div class="col-md-6">
                    <input type="number" step="any" class="form-control border-danger mt-2" name="manual_total_units" placeholder="⚠️ Total No of Units (required if CTNS or Units/CTN missing)">
                </div>
            `);
                return;
            }

            const manualUnits = parseFloat(manualInput.val());
            if (!manualUnits || manualUnits <= 0) {
                alert("Please enter Total No of Units.");
                return;
            }
        }

        storeBLEntryData(blCurrentStep);
        if (blCurrentStep < blMultiEntryData.length) {
            blCurrentStep++;
            showBLEntryForm(blCurrentStep);
        } else {
            $('#bl-next-entry-btn').hide();
            $('#bl-submit-multi-entry').removeClass('d-none');
        }
    });

    $('#bl-prev-entry-btn').on('click', function () {
        storeBLEntryData(blCurrentStep);
        if (blCurrentStep > 1) {
            blCurrentStep--;
            showBLEntryForm(blCurrentStep);
        }
    });

    $('#bl-multi-entry-form').submit(function (e) {
        e.preventDefault();
        storeBLEntryData(blCurrentStep);
        const supplier = $('#blClientForm').find('[name="supplier_name"]').val().trim();
        const date = $('#blDate').val();

        if (!supplier || !date) {
            alert("Supplier name and date are required.");
            return;
        }

        $.ajax({
            url: '/bl-client/save-multiple',
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
            },
            data: {
                date: date,
                supplier_name: supplier,
                entries: blMultiEntryData,
                multiple_entry: true  // This flag tells backend it's grouped entry
            },
            success: function () {
                $('#blMultiEntryModal').modal('hide');
                alert('Multiple entries saved!');
                loadBLClients();
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            },
            error: function (xhr) {
                console.error(xhr.responseText);
                alert("Error saving multiple entries.");
            }
        });
    });

    function showBLEntryForm(step) {
        const entry = blMultiEntryData[step - 1] || {};
        const html = `
        <div class="step-label mb-2"><strong>Entry ${step}</strong></div>
        <div class="row g-3 entry-row" data-step="${step}">
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="unit_price" placeholder="Unit Price" value="${entry.unit_price || ''}">
            </div>
            <div class="col-md-4">
                <input type="text" class="form-control" name="description" placeholder="Description" value="${entry.description || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="no_of_ctns" placeholder="No of CTNS" value="${entry.no_of_ctns || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="units_per_ctn" placeholder="Units/CTN" value="${entry.units_per_ctn || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="weight" placeholder="Weight in KG" value="${entry.weight || ''}">
            </div>
            <div class="col-md-4">
                <input type="number" step="any" class="form-control" name="shipping_rate_per_kg" placeholder="Shipping Rate/KG" value="${entry.shipping_rate_per_kg || ''}">
            </div>
        </div>
    `;
        $('#bl-entry-form-fields').html(html);
    }

    function storeBLEntryData(step) {
        const $row = $('.entry-row[data-step="' + step + '"]');

        blMultiEntryData[step - 1] = {
            unit_price: parseFloat($row.find('[name="unit_price"]').val()) || 0,
            description: $row.find('[name="description"]').val() || '',
            no_of_ctns: parseFloat($row.find('[name="no_of_ctns"]').val()) || 0,
            units_per_ctn: parseFloat($row.find('[name="units_per_ctn"]').val()) || 0,
            weight: parseFloat($row.find('[name="weight"]').val()) || 0,
            shipping_rate_per_kg: parseFloat($row.find('[name="shipping_rate_per_kg"]').val()) || 0,
            manual_total_units: parseFloat($row.find('[name="manual_total_units"]').val()) || 0
        };
    }

    $(document).on('click', '.edit-bl-btn', function () {
        const $row = $(this).parents('tr[data-id]');
        const id = $row.data('id');
        const subSerials = $row.data('subserials');

        if (subSerials && subSerials.length > 1) {
            editingBLGroup = {
                date: $row.data('date'),
                supplier: $row.data('supplier'),
                subSerials: subSerials
            };
            editingBLId = id;

            $('#blEditSubSerialInput').val('');
            $('#blEditSubEntryModal').modal('show');
        } else {
            editingBLId = id;
            $('#blDate').val($row.data('date'));
            $('#supplierName').val($row.data('supplier'));
            $('#blDescription').val($row.find('td:eq(3)').text().trim());
            $('#blNoOfCtns').val($row.find('td:eq(4)').text().trim());
            $('#blUnitsPerCtn').val($row.find('td:eq(5)').text().trim());
            $('#blUnitPrice').val($row.find('td:eq(6)').text().replace('AED', '').trim());
            $('#blWeight').val($row.find('td:eq(8)').text().trim());
            $('#blShippingRate').val($row.data('shipping-rate-per-kg'));

            $('#blSubmitBtn').addClass('d-none');
            $('#blSaveChangesBtn').removeClass('d-none');
            $('html, body').animate({ scrollTop: 0 }, 300);
        }
    });

    $('#confirmBLSubSerialEditBtn').on('click', function () {
        const subSerial = parseInt($('#blEditSubSerialInput').val().trim());

        if (!subSerial || !editingBLGroup) {
            alert("Please enter a valid sub-serial number.");
            return;
        }

        // Get sr_no from the table row with matching date and supplier
        const $row = $(`tr[data-date="${editingBLGroup.date}"][data-supplier="${editingBLGroup.supplier}"]`);
        const srNo = parseInt($row.data('sr-no'));
        const rowId = $row.data('id');

        if (!srNo || isNaN(srNo)) {
            alert("Serial number not found for the selected row.");
            return;
        }

        editingBLGroup.sr_no = srNo;
        editingBLId = rowId;

        console.log("Looking for sub-serial:", {
            subSerial,
            sr_no: srNo
        });

        $.getJSON('/bl-client/data-all', function (fullData) {
            const row = fullData.find(entry =>
                parseInt(entry.sr_no) === srNo &&
                parseInt(entry.sub_serial) === subSerial
            );

            if (!row) {
                alert("Could not load data.");
                return;
            }

            editingBLId = row.id;
            editingBLSubSerial = subSerial;

            // Populate fields
            $('html, body').animate({ scrollTop: 0 }, 300);
            $('#blDate').val(row.date);
            $('#supplierName').val(row.supplier_name);
            $('#blDescription').val(row.description || '');
            $('#blNoOfCtns').val(row.no_of_ctns || '');
            $('#blUnitsPerCtn').val(row.units_per_ctn || '');
            $('#blUnitPrice').val(row.unit_price || '');
            $('#blWeight').val(row.weight || '');
            $('#blShippingRate').val(row.shipping_rate_per_kg || '');

            $('#blSubmitBtn').addClass('d-none');
            $('#blSaveChangesBtn').removeClass('d-none');
            $('#blEditSubEntryModal').modal('hide');
            $('#blEditSubSerialInput').val('');
        });
    });

    $('#blSaveChangesBtn').on('click', function () {
        sendBLEntryEdit();
    });

    $(document).on('click', '.delete-bl-btn', function () {
        const $row = $(this).closest('tr');
        const id = $row.data('id');
        const date = $row.data('date');

        let supplier = $row.data('supplier');
        if (!supplier) {
            supplier = $row.find('td:eq(2)').text().trim();
        }

        const subSerials = JSON.parse($row.attr('data-subserials') || '[]');
        const isMultiple = subSerials.length > 1;

        $('#blDeleteRowId').val(id);
        $('#blDeleteDate').val(date);
        $('#blDeleteSupplier').val(supplier);

        if (isMultiple) {
            $('#blDeleteMessage').html(`
            This is a multiple entry.<br>
            <b>Date:</b> ${date}<br>
            <b>Supplier:</b> ${supplier}<br>
            Enter sub-serial number (e.g., <strong>1</strong>) or type <strong>all</strong>.
            `);
            $('#blSubSerialInputWrapper').show();
            setTimeout(() => {
                $('#blDeleteSubSerialInput').focus();
            }, 100);
        } else {
            $('#blDeleteMessage').text('Are you sure you want to delete this BL entry?');
            $('#blSubSerialInputWrapper').hide();
        }

        $('#blDeleteModal').modal('show');
    });

    $('#confirmBLDeleteBtn').on('click', function () {
        const isMultiple = $('#blSubSerialInputWrapper').is(':visible');
        const subSerial = $('#blDeleteSubSerialInput').val().trim().toLowerCase();
        const id = $('#blDeleteRowId').val();
        const date = $('#blDeleteDate').val();
        const supplier = $('#blDeleteSupplier').val();

        console.log("Deleting with:", { id, date, supplier, subSerial });

        let url = '';
        let method = '';
        let data = {};

        if (isMultiple) {
            if (!subSerial) {
                alert("Please enter sub-serial number or 'all'");
                return;
            }

            // POST method for delete-multiple
            url = '/bl-client/delete-multiple';
            method = 'POST';
            data = {
                date: date,
                supplier_name: supplier,
                sub_serial: subSerial,
                _token: $('meta[name="csrf-token"]').attr('content')
            };
        } else {
            // Laravel DELETE method with CSRF
            url = `/bl-client/delete/${id}`;
            method = 'POST';
            data = {
                _method: 'DELETE', // Use _method override
                _token: $('meta[name="csrf-token"]').attr('content')
            };
        }

        $.ajax({
            url: url,
            type: method,
            data: data,
            success: function () {
                $('#blDeleteModal').modal('hide');
                $('#blDeleteSubSerialInput').val('');
                loadBLClients();
                alert("Deleted successfully.");
            },
            error: function (xhr) {
                console.error(xhr.responseText);
                alert("Failed to delete entry.");
            }
        });
    });

    $('#blDeleteModal').on('shown.bs.modal', function () {
        setTimeout(() => {
            $('#blDeleteSubSerialInput').focus();
        }, 100);
    });

    $('#blFilteredExcelBtn').on('click', function () {
        const fromDate = $('#blFromDate').val();
        const toDate = $('#blToDate').val();

        if (!fromDate || !toDate) {
            alert('Please select both dates.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const headers = [];

        $('#bl-export-table thead tr:eq(0) th').each(function (i) {
            if (i !== 19) headers.push($(this).text().trim()); // Exclude Action column
        });

        const wsData = [headers];

        $('#bl-client-body tr:visible').each(function () {
            const rawDateStr = $(this).find('td:eq(1)').text().trim();
            const formattedRowDate = convertToISO(rawDateStr);

            if (!formattedRowDate) return;

            if (formattedRowDate >= fromDate && formattedRowDate <= toDate) {
                const rowData = [];
                $(this).find('td').each(function (i) {
                    if (i !== 19) {
                        rowData.push($(this).text().trim().replace(/<br\s*\/?>/gi, '\n'));
                    }
                });
                wsData.push(rowData);
            }
        });

        if (wsData.length === 1) {
            alert("No data in selected date range.");
            return;
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "BL Sheet");
        XLSX.writeFile(wb, 'bl_sheet_filtered.xlsx');
    });

    $('#applyBLDateFilter').on('click', function () {
        const fromDate = $('#blFromDate').val();
        const toDate = $('#blToDate').val();

        if (!fromDate || !toDate) {
            alert('Please select both From and To dates.');
            return;
        }

        $('#bl-client-body tr').each(function () {
            const rawDateStr = $(this).find('td:eq(1)').text().trim(); // Example: "Wednesday, 15 May 2025"
            const formattedRowDate = convertToISO(rawDateStr); // Will be: "2025-05-15"

            if (!formattedRowDate) {
                $(this).hide();
                return;
            }

            if (formattedRowDate >= fromDate && formattedRowDate <= toDate) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        $('#blFilteredExcelBtn').removeClass('d-none');
        $('#blDatePopupBox').fadeOut();
        $('#blDateFilterInput').val(`${fromDate} to ${toDate}`);
    });

    $('#clearBLDateFilter').on('click', function () {
        $('#bl-client-body tr').show(); // Show all rows again
        $('#blFilteredExcelBtn').addClass('d-none');
        $('#blDateFilterInput').val('');
        $('#blDatePopupBox').fadeOut();
    });

    $('#blDateFilterInput').on('click', function () {
        const $input = $(this);
        const $popup = $('#blDatePopupBox'); // changed ID from #blDatePopup
        const popupHeight = $popup.outerHeight();
        const popupWidth = $popup.outerWidth();
        const inputOffset = $input.offset();
        const windowHeight = $(window).height();
        const windowWidth = $(window).width();

        let topPosition = inputOffset.top + $input.outerHeight() + 5;
        if ((topPosition + popupHeight) > $(window).scrollTop() + windowHeight) {
            topPosition = inputOffset.top - popupHeight - 5;
        }

        let leftPosition = inputOffset.left;
        if ((leftPosition + popupWidth) > windowWidth) {
            leftPosition = windowWidth - popupWidth - 10;
        }

        $popup.css({
            position: 'absolute',
            top: `${topPosition}px`,
            left: `${leftPosition}px`,
            zIndex: 9999
        }).appendTo('body').fadeIn();
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('#blDateFilterInput, #blDatePopupBox').length) {
            $('#blDatePopupBox').fadeOut();
        }
    });

    $(document).on('click', '.copy-bl-btn', function () {
        const $row = $(this).closest('tr[data-id]');
        const subSerials = $row.data('subserials');

        // Check if this is a multiple-entry row
        const isMultiple = Array.isArray(subSerials) && subSerials.length > 1;

        if (isMultiple) {
            window.copyBLGroup = {
                sr_no: $row.data('sr-no'),
                subSerials: subSerials,
                date: $row.data('date'),
                supplier: $row.data('supplier')
            };
            $('#blCopySubSerialInput').val('');
            $('#blCopySubEntryModal').modal('show');
        } else {
            // Handle normal (non-multiple) row copy
            $('#blDate').val($row.data('date'));
            $('#supplierName').val($row.data('supplier'));
            $('#blDescription').val($row.attr('data-description') || '');
            $('#blNoOfCtns').val($row.attr('data-no-of-ctns') || '');
            $('#blUnitsPerCtn').val($row.attr('data-units-per-ctn') || '');
            $('#blUnitPrice').val($row.attr('data-unit-price') || '');
            $('#blWeight').val($row.attr('data-weight') || '');
            $('#blShippingRate').val($row.attr('data-shipping-rate-per-kg') || '');

            // Copy mode - show submit, hide save
            $('#blSubmitBtn').removeClass('d-none');
            $('#blSaveChangesBtn').addClass('d-none');
            $('html, body').animate({ scrollTop: 0 }, 300);
        }
    });

    $('#confirmBLSubSerialCopyBtn').on('click', function () {
        const subSerial = parseInt($('#blCopySubSerialInput').val().trim());

        if (!subSerial || !window.copyBLGroup) {
            alert("Please enter a valid sub-serial number.");
            return;
        }

        $.getJSON('/bl-client/data-all', function (fullData) {
            const matchedRow = fullData.find(entry =>
                entry.sr_no &&
                entry.sub_serial &&
                parseInt(entry.sr_no) === parseInt(copyBLGroup.sr_no) &&
                parseInt(entry.sub_serial) === subSerial
            );

            if (!matchedRow) {
                alert("Sub-serial not found.");
                return;
            }

            // Populate form fields
            $('html, body').animate({ scrollTop: 0 }, 300);
            $('#blDate').val(matchedRow.date);
            $('#supplierName').val(matchedRow.supplier_name);
            $('#blDescription').val(matchedRow.description || '');
            $('#blNoOfCtns').val(matchedRow.no_of_ctns || '');
            $('#blUnitsPerCtn').val(matchedRow.units_per_ctn || '');
            $('#blUnitPrice').val(matchedRow.unit_price || '');
            $('#blWeight').val(matchedRow.weight || '');
            $('#blShippingRate').val(matchedRow.shipping_rate_per_kg || '');

            // Set to copy mode (submit not save)
            $('#blSubmitBtn').removeClass('d-none');
            $('#blSaveChangesBtn').addClass('d-none');

            $('#blCopySubEntryModal').modal('hide');
            $('#blCopySubSerialInput').val('');
        });
    });

    $(function () {
        $('[data-bs-toggle="tooltip"]').tooltip();
    });
}

function loadBLClients() {
    $.ajax({
        url: '/bl-client/data',
        type: 'GET',
        success: function (data) {
            if (!Array.isArray(data)) {
                console.error('Invalid data format:', data);
                alert('Invalid response from server.');
                return;
            }

            data.sort((a, b) => a.sr_no - b.sr_no);

            $('#bl-client-body').empty();
            let totalMaterialSum = 0;
            let totalShipmentSum = 0;
            let grandTotalSum = 0;

            data.forEach(item => {
                totalMaterialSum += item.total_material_sum || 0;
                totalShipmentSum += item.shipping_cost_sum || 0;
                grandTotalSum = totalMaterialSum + totalShipmentSum;

                const isMultipleEntry = item.sub_serials && item.sub_serials.length > 1;

                const formatWithSubSerial = (combinedValue) => {
                    if (!combinedValue) return '';
                    const values = combinedValue.split('<br>');
                    return values.join('<br>');
                };

                const $row = $('<tr></tr>').attr({
                    'data-id': item.id,
                    'data-date': item.date,
                    'data-supplier': item.supplier_name,
                    'data-sr-no': item.sr_no,
                    'data-subserials': JSON.stringify(item.sub_serials || [])
                });

                if (isMultipleEntry) {
                    $row.addClass('multi-entry-row');
                } else {
                    $row.attr({
                        'data-description': item.description?.toString() || '',
                        'data-no-of-ctns': item.no_of_ctns?.toString() || '',
                        'data-units-per-ctn': item.units_per_ctn?.toString() || '',
                        'data-unit-price': item.unit_price?.toString() || '',
                        'data-weight': item.weight?.toString() || '',
                        'data-shipping-rate-per-kg': item.shipping_rate_per_kg?.toString() || ''
                    });
                }

                $row.append(`<td data-bs-toggle="tooltip" title="SR.NO">${item.sr_no}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Date">${formatBLDate(item.date)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Supplier Name">${item.supplier_name || ''}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Description">${formatWithSubSerial(item.description_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="No. of CTNS" class="format-aed">${formatWithSubSerial(item.no_of_ctns_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Units/CTN" class="format-aed">${formatWithSubSerial(item.units_per_ctn_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Unit Price" class="format-aed">${formatWithSubSerial(item.unit_price_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Total No. of Units" class="format-aed">${formatWithSubSerial(item.total_units_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Weight in KG" class="format-aed">${formatWithSubSerial(item.weight_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Total Material" class="format-aed">${formatWithSubSerial(item.total_material_combined)}</td>`);
                if (isMultipleEntry) {
                    $row.append(`<td data-bs-toggle="tooltip" title="Invoice Total Material" class="format-aed">AED ${Number(item.total_material_sum || 0).toFixed(2)}</td>`);
                } else {
                    $row.append(`<td></td>`);
                }
                $row.append(`<td data-bs-toggle="tooltip" title="Shipping Rate" class="format-aed">${formatWithSubSerial(item.shipping_rate_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="DGD" class="format-aed">${formatWithSubSerial(item.dgd_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Labeling Charges" class="format-aed">${formatWithSubSerial(item.labeling_charges_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Labour" class="format-aed">${formatWithSubSerial(item.labour_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Shipping Cost" class="format-aed">${formatWithSubSerial(item.shipping_cost_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Total" class="format-aed">${formatWithSubSerial(item.total_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Cost/Unit AED" class="format-aed">${formatWithSubSerial(item.cost_per_unit_aed_combined)}</td>`);
                $row.append(`<td data-bs-toggle="tooltip" title="Cost/Unit USD" class="format-aed">${formatWithSubSerial(item.cost_per_unit_usd_combined)}</td>`);
                $row.append(`
                    <td>
                        <button class="btn btn-sm btn-success edit-bl-btn" data-bs-toggle="tooltip" title="Edit"><i class="bi bi-pencil-square"></i></button>
                        <button class="btn btn-sm btn-danger delete-bl-btn" data-id="${item.id}" data-bs-toggle="tooltip" title="Delete"><i class="bi bi-trash"></i></button>
                        <button class="btn btn-sm btn-secondary copy-bl-btn" data-bs-toggle="tooltip" title="Copy"><i class="bi bi-files"></i></button>
                    </td>
                `);

                $('#bl-client-body').append($row);
            });
            // Update the summary card with the calculated totals
            $('#bl-total-material').text('AED ' + totalMaterialSum.toLocaleString(undefined, { minimumFractionDigits: 2 }));
            $('#bl-total-shipment').text('AED ' + totalShipmentSum.toLocaleString(undefined, { minimumFractionDigits: 2 }));
            $('#bl-grand-total').text('AED ' + grandTotalSum.toLocaleString(undefined, { minimumFractionDigits: 2 }));

            applyNumberFormatting();

            $('[data-bs-toggle="tooltip"]').tooltip();
        },
        error: function (xhr) {
            console.error("Load BL Clients Error:", xhr.responseText);
            alert("Failed to load BL client data.");
        }
    });
}

function formatBLDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('en-GB', options);  // "Wednesday, 21 May 2025"
}

function exportBLExcel() {
    const wb = XLSX.utils.book_new();
    const wsData = [];

    // Get headers (exclude the filter row)
    const headers = [];
    $('#sheet-bl table thead tr:eq(0) th').each(function (index) {
        if (index < 19) headers.push($(this).text().trim());
    });
    wsData.push(headers);

    $('#sheet-bl table tbody tr').each(function () {
        const cells = $(this).find('td');
        const allColumns = [];

        cells.each(function (i) {
            if (i < 19) {
                const raw = $(this).html().trim().replace(/<br\s*\/?>/gi, '\n'); // convert line breaks to newline
                const lines = raw.split('\n').map(v => v.trim()).filter(Boolean);

                // Ensure at least 1 line exists for alignment
                allColumns.push(lines.length ? lines : ['']);
            }
        });

        const maxLines = Math.max(...allColumns.map(col => col.length));

        for (let i = 0; i < maxLines; i++) {
            const row = [];
            allColumns.forEach(col => {
                row.push(col[i] !== undefined ? col[i] : '');
            });
            wsData.push(row);
        }
    });

    // Add summary
    wsData.push([]);
    wsData.push(['Total Material', $('#bl-total-material').text()]);
    wsData.push(['Total Shipment', $('#bl-total-shipment').text()]);
    wsData.push(['Grand Total', $('#bl-grand-total').text()]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply wrap text to all cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws[cellRef]) {
                if (!ws[cellRef].s) ws[cellRef].s = {};
                ws[cellRef].s.alignment = { wrapText: true };
            }
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, "BL Sheet");
    XLSX.writeFile(wb, 'bl_sheet.xlsx');
}

function sendBLEntry() {
    const form = $('#blClientForm')[0];
    const formData = new FormData(form);

    $.ajax({
        url: '/bl-client/save',
        method: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        success: function (response) {
            if (response.success) {
                $('#blClientForm')[0].reset();
                $('#blTotalUnitsHidden').val('');
                loadBLClients();
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            } else {
                alert('Save failed. Check response.');
            }
        },
        error: function (xhr) {
            alert('Error saving entry');
            console.log(xhr.responseText);
        }
    });
}

function sendBLEntryEdit() {
    console.log("editingBLId:", editingBLId);

    if (editingBLId === null || isNaN(editingBLId)) {
        alert("Missing record ID.");
        return;
    }

    const noOfCtns = parseFloat($('#blNoOfCtns').val()) || 0;
    const unitsPerCtn = parseFloat($('#blUnitsPerCtn').val()) || 0;
    const manualTotalUnits = parseFloat($('#blTotalUnitsHidden').val()) || 0;

    // Calculate total units
    let totalUnits = 0;
    if (noOfCtns > 0 && unitsPerCtn > 0) {
        totalUnits = noOfCtns * unitsPerCtn;
    } else if (manualTotalUnits > 0) {
        totalUnits = manualTotalUnits;
    } else {
        // Save flag so we know we're editing
        $('#blManualUnitsModal').data('source', 'edit');
        $('#blManualUnitsModal').modal('show');
        return;
    }

    const data = {
        date: $('#blDate').val(),
        supplier_name: $('#supplierName').val(),
        description: $('#blDescription').val(),
        no_of_ctns: noOfCtns,
        units_per_ctn: unitsPerCtn,
        unit_price: $('#blUnitPrice').val(),
        weight: $('#blWeight').val(),
        shipping_rate_per_kg: $('#blShippingRate').val(),
        total_units: totalUnits,
        _token: $('meta[name="csrf-token"]').attr('content')
    };

    const url = window.editingBLSubSerial
        ? `/bl-client/update-subentry/${editingBLId}/${editingBLSubSerial}`
        : `/bl-client/update/${editingBLId}`;

    $.ajax({
        url: url,
        type: 'PUT',
        data: data,
        success: function () {
            alert('Updated successfully!');
            editingBLId = null;
            editingBLSubSerial = null;
            $('#blClientForm')[0].reset();
            $('#blTotalUnitsHidden').val('');
            $('#blSubmitBtn').removeClass('d-none');
            $('#blSaveChangesBtn').addClass('d-none');
            loadBLClients();
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        },
        error: function () {
            alert('Update failed.');
        }
    });
}

// Local Sales Logic Initialization

function initLocalLogic() {
    let lsEntryCount = 0;
    let lsCurrentStep = 0;
    let lsFormData = [];
    let pendingSingleFormData = {};

    $('#ls-open-multi-entry-btn').on('click', function () {
        $('#ls-number-of-entries').val('');
        $('#ls-multi-entry-count-modal').modal('show');
    });

    $('#ls-start-entry-btn').on('click', function () {
        lsEntryCount = parseInt($('#ls-number-of-entries').val()) || 0;
        if (lsEntryCount <= 0) return alert('Please enter a valid number of entries');

        lsFormData = Array.from({ length: lsEntryCount }, () => ({
            client: $('#clientName').val(),
            date: $('#localDate').val(),
            description: '',
            unit_price: '',
            no_of_ctns: '',
            units_per_ctn: '',
            vat_percentage: '',
            payment_status: '',
            remarks: '',
            total_no_of_units: ''
        }));

        lsCurrentStep = 0;
        renderStepForm(lsCurrentStep);
        $('#ls-multi-entry-count-modal').modal('hide');
        $('#ls-multi-entry-step-modal').modal('show');
    });

    $('#ls-next-entry-btn').off('click').on('click', function () {
        // Save current step inputs
        saveCurrentStep(lsCurrentStep);

        const entry = lsFormData[lsCurrentStep];
        const ctns = parseInt(entry.no_of_ctns || 0);
        const units = parseInt(entry.units_per_ctn || 0);
        const manualUnits = parseInt($('#manualUnitsInput').val() || 0);

        const isMissing = ctns <= 0 || units <= 0;

        // If missing, check if manual input is visible
        if (isMissing) {
            $('#manualUnitsContainer').show();

            if (manualUnits > 0) {
                entry.total_no_of_units = manualUnits;
                $('#manualUnitsError').hide();
            } else {
                $('#manualUnitsError').show();
                return;
            }
        } else {
            $('#manualUnitsContainer').hide();
            entry.total_no_of_units = ctns * units;
        }

        // VAT & Totals
        const unitPrice = parseFloat(entry.unit_price || 0);
        const amountNoVat = unitPrice * entry.total_no_of_units;
        const vatAmount = amountNoVat * (parseFloat(entry.vat_percentage || 0) / 100);
        entry.total_amount_without_vat = amountNoVat;
        entry.vat_amount = vatAmount;
        entry.total_amount_including_vat = amountNoVat + vatAmount;

        // Next step or show submit
        if (lsCurrentStep < lsEntryCount - 1) {
            lsCurrentStep++;
            renderStepForm(lsCurrentStep);
        } else {
            $('#ls-next-entry-btn').hide();
            $('#ls-submit-multi-entry').removeClass('d-none');
        }
    });

    $('#ls-prev-entry-btn').on('click', function () {
        lsCurrentStep--;

        $('#ls-submit-multi-entry').addClass('d-none');
        $('#ls-next-entry-btn').removeClass('d-none');

        renderStepForm(lsCurrentStep);
    });

    $('#ls-manual-units-form').on('submit', function (e) {
        e.preventDefault();
        const raw = $('#ls-manual-total-units').val().trim();
        const val = parseFloat(raw);

        if (isNaN(val) || val <= 0) {
            alert('Please enter a valid number greater than 0.');
            return;
        }

        lsFormData[lsCurrentStep].total_no_of_units = val;

        $('#ls-manual-units-modal').modal('hide');
        $('#ls-manual-units-modal').one('hidden.bs.modal', proceedToNextStep);
    });

    $('#ls-submit-multi-entry').on('click', function () {
        saveCurrentStep(lsCurrentStep);

        for (let i = 0; i < lsFormData.length; i++) {
            const entry = lsFormData[i];
            const ctns = parseInt(entry.no_of_ctns || 0);
            const units = parseInt(entry.units_per_ctn || 0);

            // If both values are present, calculate total units
            if (ctns > 0 && units > 0) {
                entry.total_no_of_units = ctns * units;
            }

            // If total units still missing, show modal or alert
            if (!entry.total_no_of_units || entry.total_no_of_units <= 0) {
                if (i === lsFormData.length - 1) {
                    // Last step — show manual input instead of alert
                    $('#manualUnitsContainer').show();
                    $('#manualUnitsInput').focus();

                    $('#manualUnitsInput').off('input').on('input', function () {
                        const val = parseInt($(this).val());
                        if (val > 0) {
                            $('#manualUnitsError').hide();
                            lsFormData[i].total_no_of_units = val;

                            // Optional: Recalculate totals
                            const unitPrice = parseFloat(entry.unit_price || 0);
                            const amountNoVat = unitPrice * val;
                            const vatAmount = amountNoVat * (parseFloat(entry.vat_percentage || 0) / 100);
                            entry.total_amount_without_vat = amountNoVat;
                            entry.vat_amount = vatAmount;
                            entry.total_amount_including_vat = amountNoVat + vatAmount;
                        } else {
                            $('#manualUnitsError').show();
                        }
                    });

                    return;
                } else {
                    alert(`Step ${i + 1}: Total units missing. Please complete the step.`);
                    return;
                }
            }

            // Optional: Calculate VAT and totals if needed here
            const unitPrice = parseFloat(entry.unit_price || 0);
            const amountNoVat = unitPrice * entry.total_no_of_units;
            const vatAmount = amountNoVat * (parseFloat(entry.vat_percentage || 0) / 100);
            entry.total_amount_without_vat = amountNoVat;
            entry.vat_amount = vatAmount;
            entry.total_amount_including_vat = amountNoVat + vatAmount;
        }

        console.log("Saving multiple entries: ", lsFormData);

        // Send actual data array with correct key
        $.ajax({
            url: '/local-sales/store-multiple',
            type: 'POST',
            data: {
                _token: $('meta[name="csrf-token"]').val(),
                entries: lsFormData // Use correct key to match controller
            },
            success: function (res) {
                if (res.success) {
                    alert('Multiple entries saved successfully!');
                    $('#ls-multi-entry-step-modal').modal('hide');
                    $('#localSalesForm')[0].reset();
                    loadLocalSales();
                } else {
                    alert('Failed to save multiple entries.');
                }
            },
            error: function () {
                alert('Server error while saving multiple entries.');
            }
        });
    });

    $('#localSalesForm').off('submit').on('submit', function (e) {
        e.preventDefault();

        const formData = {
            _token: $('meta[name="csrf-token"]').val(),
            client: $('#clientName').val(),
            date: $('#localDate').val(),
            description: $('#ls-description').val(),
            unit_price: parseFloat($('#ls-unit-price').val()) || 0,
            no_of_ctns: parseFloat($('#noOfCtns').val()) || 0,
            units_per_ctn: parseFloat($('#ls-units-per-ctn').val()) || 0,
            vat_percentage: parseFloat($('#vatPercent').val()) || 0,
            payment_status: $('#paymentStatus').val(),
            remarks: $('#ls-remarks').val(),
        };

        const totalUnits = formData.no_of_ctns * formData.units_per_ctn;

        if (totalUnits > 0) {
            formData.total_no_of_units = totalUnits;
            const amountNoVat = formData.unit_price * totalUnits;
            const vatAmount = amountNoVat * (formData.vat_percentage / 100);
            formData.total_amount_without_vat = amountNoVat;
            formData.vat_amount = vatAmount;
            formData.total_amount_including_vat = amountNoVat + vatAmount;

            submitSingleEntry(formData);
        } else {
            // Show manual modal and defer submit
            pendingSingleFormData = formData;
            $('#manualTotalUnits').val('');
            $('#lsManualUnitsModal').modal('show');
        }
    });

    $('#manualUnitsForm').on('submit', function (e) {
        e.preventDefault();

        const raw = $('#manualTotalUnits').val().trim();
        const val = parseFloat(raw);

        if (isNaN(val) || val <= 0) {
            alert('Please enter a valid number greater than 0.');
            return;
        }

        // Ensure global form data exists
        if (typeof pendingSingleFormData !== 'undefined') {
            pendingSingleFormData.total_no_of_units = val;

            const unitPrice = parseFloat(pendingSingleFormData.unit_price) || 0;
            const vatPercent = parseFloat(pendingSingleFormData.vat_percentage) || 0;

            const amountNoVat = unitPrice * val;
            const vatAmount = amountNoVat * (vatPercent / 100);
            const totalWithVat = amountNoVat + vatAmount;

            pendingSingleFormData.total_amount_without_vat = amountNoVat;
            pendingSingleFormData.vat_amount = vatAmount;
            pendingSingleFormData.total_amount_including_vat = totalWithVat;
        }

        $('#lsManualUnitsModal').modal('hide');
        $('#lsManualUnitsModal').one('hidden.bs.modal', function () {
            submitSingleEntry(pendingSingleFormData);
        });
    });

    function submitSingleEntry(formData) {
        const isUpdate = !!formData.id; // Check if it's update
        const url = isUpdate ? '/local-sales/update/' + formData.id : '/local-sales/save';

        $.post(url, formData, function (res) {
            if (res.success) {
                alert(isUpdate ? 'Entry updated!' : 'Entry saved!');
                $('#localSalesForm')[0].reset();
                $('#localUpdateBtn').addClass('d-none');
                $('#localSubmitBtn').removeClass('d-none');
                loadLocalSales();
                scrollToBottomTable();
            } else {
                alert('Failed to ' + (isUpdate ? 'update' : 'save') + '.');
            }
        }).fail(() => alert('Server error while ' + (isUpdate ? 'updating' : 'saving') + '.'));
    }

    function proceedToNextStep() {
        lsCurrentStep++;

        if (lsCurrentStep === lsEntryCount) {
            $('#ls-next-entry-btn').addClass('d-none');
            $('#ls-submit-multi-entry').removeClass('d-none');
        } else {
            renderStepForm(lsCurrentStep);
        }
    }

    function renderStepForm(index) {
        const e = lsFormData[index];

        $('#ls-step-entry-fields').html(`
        <div class="row g-3">
            <div class="col-md-4">
                <input type="text" class="form-control" id="ls-description-${index}" placeholder="Description" value="${e.description}">
            </div>
            <div class="col-md-2">
                <input type="number" class="form-control" id="ls-unit-price-${index}" placeholder="Unit Price" value="${e.unit_price}">
            </div>
            <div class="col-md-2">
                <input type="number" class="form-control" id="ls-no-of-ctns-${index}" placeholder="No. of CTNS" value="${e.no_of_ctns}">
            </div>
            <div class="col-md-2">
                <input type="number" class="form-control" id="ls-units-per-ctn-${index}" placeholder="Units/CTN" value="${e.units_per_ctn}">
            </div>
            <div class="col-md-2">
                <input type="number" class="form-control" id="ls-vat-percent-${index}" placeholder="VAT %" value="${e.vat_percentage}">
            </div>
            <div class="col-md-4">
                <select class="form-select" id="ls-payment-status-${index}">
                    <option disabled ${!e.payment_status ? 'selected' : ''}>Payment Status</option>
                    <option ${e.payment_status === 'Paid' ? 'selected' : ''}>Paid</option>
                    <option ${e.payment_status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option ${e.payment_status === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
                </select>
            </div>
            <div class="col-md-8">
                <input type="text" class="form-control" id="ls-remarks-${index}" placeholder="Remarks" value="${e.remarks}">
            </div>

            <!-- 🔽 Add Manual Total Units -->
            <div id="manualUnitsContainer" class="col-md-12" style="display: none;">
                <label for="manualUnitsInput" class="form-label">Enter Total Units Manually</label>
                <input type="number" id="manualUnitsInput" class="form-control" placeholder="e.g. 100">
                <div class="text-danger mt-1" id="manualUnitsError" style="display: none;">Please enter a valid total units value.</div>
            </div>
        </div>
    `);

        $('#ls-step-title').text(`(${index + 1} of ${lsEntryCount})`);
        $('#ls-prev-entry-btn').toggle(index > 0);

        // 🔁 Show Next or Submit depending on last step
        if (index < lsEntryCount - 1) {
            $('#ls-next-entry-btn').show();
            $('#ls-submit-multi-entry').addClass('d-none');
        } else {
            $('#ls-next-entry-btn').hide();
            $('#ls-submit-multi-entry').removeClass('d-none');
        }

        // Reset manual input area visibility each step
        $('#manualUnitsContainer').hide();
        $('#manualUnitsInput').val('');
        $('#manualUnitsError').hide();
    }

    function saveCurrentStep(index) {
        const e = lsFormData[index];
        e.description = $(`#ls-description-${index}`).val();
        e.unit_price = $(`#ls-unit-price-${index}`).val();
        e.no_of_ctns = $(`#ls-no-of-ctns-${index}`).val();
        e.units_per_ctn = $(`#ls-units-per-ctn-${index}`).val();
        e.vat_percentage = $(`#ls-vat-percent-${index}`).val();
        e.payment_status = $(`#ls-payment-status-${index}`).val();
        e.remarks = $(`#ls-remarks-${index}`).val();
    }

    $('#lsConfirmDeleteBtn').off('click').on('click', function () {
        let subSerial = lsDeleteSubSerial;

        if (subSerial !== null) {
            const input = $('#lsSubSerialInput').val().trim().toLowerCase();
            if (!input) return alert('Please enter a sub-serial number or "all"');

            if (input === 'all') {
                subSerial = 'all';
            } else if (!/^\d+$/.test(input)) {
                return alert('Invalid sub-serial number.');
            } else {
                subSerial = parseInt(input);
            }
        }

        $.post('/local-sales/delete', {
            _token: $('meta[name="csrf-token"]').val(),
            sr_no: lsDeleteSrNo,
            sub_serial: subSerial
        }, function (res) {
            if (res.success) {
                $('#lsDeleteModal').modal('hide');
                loadLocalSales();
            } else {
                alert('Failed to delete.');
            }
        });
    });

    $('#localUpdateBtn').on('click', function () {
        const id = $(this).data('update-id');

        const noCtnsRaw = $('#noOfCtns').val();
        const unitsPerCtnRaw = $('#ls-units-per-ctn').val();

        let noCtns = parseInt(noCtnsRaw);
        let unitsPerCtn = parseInt(unitsPerCtnRaw);
        let totalUnits;

        if ((noCtnsRaw === '' || parseInt(noCtnsRaw) === 0) &&
            (unitsPerCtnRaw === '' || parseInt(unitsPerCtnRaw) === 0)) {

            // Prepare global formData for modal usage
            pendingSingleFormData = {
                id: id, // Required for update
                client: $('#clientName').val(),
                date: $('#localDate').val(),
                description: $('#ls-description').val(),
                unit_price: parseFloat($('#ls-unit-price').val()) || 0,
                no_of_ctns: 0,
                units_per_ctn: 0,
                vat_percentage: parseFloat($('#vatPercent').val()) || 0,
                payment_status: $('#paymentStatus').val(),
                remarks: $('#ls-remarks').val()
            };

            $('#lsManualUnitsModal').modal('show');
            return;
        }

        // Calculate if CTNS + Units/CTN are available
        noCtns = noCtns || 0;
        unitsPerCtn = unitsPerCtn || 0;
        totalUnits = noCtns * unitsPerCtn;

        const unitPrice = parseFloat($('#ls-unit-price').val()) || 0;
        const vat = parseFloat($('#vatPercent').val()) || 0;
        const amount = unitPrice * totalUnits;
        const vatAmount = amount * (vat / 100);
        const totalWithVat = amount + vatAmount;

        const payload = {
            _token: $('meta[name="csrf-token"]').val(),
            client: $('#clientName').val(),
            date: $('#localDate').val(),
            description: $('#ls-description').val(),
            unit_price: unitPrice,
            no_of_ctns: noCtns,
            units_per_ctn: unitsPerCtn,
            total_no_of_units: totalUnits,
            total_amount_without_vat: amount,
            vat_percentage: vat,
            vat_amount: vatAmount,
            total_amount_including_vat: totalWithVat,
            payment_status: $('#paymentStatus').val(),
            remarks: $('#ls-remarks').val()
        };

        $.post('/local-sales/update/' + id, payload, function (res) {
            if (res.success) {
                alert('Entry updated!');
                $('#localUpdateBtn').addClass('d-none');
                $('#localSubmitBtn').removeClass('d-none');
                $('#localSalesForm')[0].reset();
                loadLocalSales();
                scrollToBottomTable();
            } else {
                alert('Failed to update!');
            }
        }).fail(() => alert('Server error while updating.'));
    });

    $('#confirmSubSerialBtn').on('click', function () {
        const subSerial = parseInt($('#subSerialInput').val().trim());
        const actionType = $(this).data('action-type'); // 'edit' or 'copy'
        const sr_no = $(this).data('sr-no');

        // Get max sub-serial from group
        const group = window.localSalesData.find(g => g.sr_no == sr_no);
        const maxSubSerial = group ? group.entries.length : 0;

        if (isNaN(subSerial) || subSerial < 1 || subSerial > maxSubSerial) {
            alert(`Please enter a valid sub-serial number between 1 and ${maxSubSerial}.`);
            return;
        }

        $('#subSerialModal').modal('hide');

        if (actionType === 'edit') {
            editEntry(sr_no, subSerial);
        } else if (actionType === 'copy') {
            copyEntry(sr_no, subSerial);
        }
    });

    $('#confirmSubSerialCopyBtn').on('click', function () {
        const sr_no = $('#targetSrNoForCopy').val();
        const sub_serial = parseInt($('#subSerialInputForCopy').val());

        const group = window.localSalesData.find(g => g.sr_no == sr_no);
        if (!group) return alert('Group not found.');

        if (!sub_serial || sub_serial < 1 || sub_serial > group.entries.length) {
            alert(`Please enter a valid sub-serial number between 1 and ${group.entries.length}.`);
            return;
        }

        const target = group.entries.find(e => e.sub_serial == sub_serial);
        if (!target) {
            alert('Entry not found.');
            return;
        }

        $('#subSerialCopyModal').modal('hide');
        prefillLocalCopyForm(target);
    });

    // Open the date popup
    $('#localDateFilterInput').on('click', function () {
        const popup = $('#localDatePopup');
        const trigger = $(this);
        const popupHeight = popup.outerHeight();
        const offset = trigger.offset();
        const scrollTop = $(window).scrollTop();
        const windowHeight = $(window).height();

        let topPosition = offset.top + trigger.outerHeight() + 8;
        if ((topPosition - scrollTop + popupHeight) > windowHeight) {
            topPosition = offset.top - popupHeight - 10;
        }

        popup.css({
            top: topPosition,
            left: offset.left
        }).fadeIn();
    });

    // Close popup when clicked outside
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#localDateFilterInput, #localDatePopup').length) {
            $('#localDatePopup').fadeOut();
        }
    });

    // Apply date filter
    $('#applyLocalDateFilter').on('click', function () {
        const fromDate = $('#localFromDate').val();
        const toDate = $('#localToDate').val();

        if (!fromDate || !toDate) {
            alert('Please select both From and To dates.');
            return;
        }

        const formatDate = d => {
            const parts = d.split("-");
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        };

        $('#localDateFilterInput').val(`${formatDate(fromDate)} to ${formatDate(toDate)}`);
        $('#localDatePopup').fadeOut();

        $('#localSalesTableBody tr').each(function () {
            const cell = $(this).find('td:eq(2)');
            const rowDate = cell.data('date');

            if (rowDate >= fromDate && rowDate <= toDate) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        const totalRows = $('#localSalesTableBody tr').length;
        const visibleRows = $('#localSalesTableBody tr:visible').length;
        if (visibleRows > 0 && visibleRows < totalRows) {
            $('#localFilteredExcelBtn').removeClass('d-none');
        } else {
            $('#localFilteredExcelBtn').addClass('d-none');
        }
    });

    // Clear date filter
    $('#clearLocalDateFilter').on('click', function () {
        $('#localFromDate').val('');
        $('#localToDate').val('');
        $('#localDateFilterInput').val('');
        $('#localDatePopup').fadeOut();
        $('#localSalesTableBody tr').show();
        $('#localFilteredExcelBtn').addClass('d-none');
    });

    // Export filtered Excel
    $('#localFilteredExcelBtn').on('click', function () {
        const wb = XLSX.utils.book_new();
        const wsData = [];

        // Headers
        const headers = [];
        $('#local-export-table thead tr:eq(0) th').each(function (index) {
            if (index < 13) { // Exclude ACTION if needed
                headers.push($(this).text().trim());
            }
        });
        wsData.push(headers);

        // Rows
        $('#localSalesTableBody tr:visible').each(function () {
            const rowData = [];
            $(this).find('td').each(function (i) {
                if (i < 13) {
                    rowData.push($(this).text().trim());
                }
            });
            wsData.push(rowData);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Local Sales");
        XLSX.writeFile(wb, 'filtered_local_sales.xlsx');
    });

}

function formatDateLong(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dayNum = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `${day}, ${dayNum} ${month} ${year}`;
}

// Load and render table
function loadLocalSales() {
    $.get('/local-sales/data', function (res) {
        // Save data globally for edit/delete logic
        window.localSalesData = res.entries;

        let html = '';
        let total = 0;

        res.entries.forEach((group) => {
            const entries = group.entries;

            if (entries.length === 1) {
                const e = entries[0];
                html += `
                    <tr>
                        <td data-bs-toggle="tooltip" title="SR.NO">${e.sr_no}</td>
                        <td data-bs-toggle="tooltip" title="Client">${e.client || ''}</td>
                        <td data-bs-toggle="tooltip" title="Date" data-date="${e.date || ''}">${formatDateLong(e.date)}</td>
                        <td data-bs-toggle="tooltip" title="Description">${e.description || ''}</td>
                        <td data-bs-toggle="tooltip" title="Unit Price" class="format-aed">AED ${parseFloat(e.unit_price || 0).toFixed(2)}</td>
                        <td data-bs-toggle="tooltip" title="No. of CTNS" class="format-aed">${e.no_of_ctns || '-'}</td>
                        <td data-bs-toggle="tooltip" title="Units/CTN" class="format-aed">${e.units_per_ctn || '-'}</td>
                        <td data-bs-toggle="tooltip" title="Total Units" class="format-aed">${e.total_no_of_units || '-'}</td>
                        <td data-bs-toggle="tooltip" title="Amount No VAT" class="format-aed">AED ${parseFloat(e.total_amount_without_vat || 0).toFixed(2)}</td>
                        <td data-bs-toggle="tooltip" title="VAT" class="format-aed">AED ${parseFloat(e.vat_amount || 0).toFixed(2)}</td>
                        <td data-bs-toggle="tooltip" title="Total With VAT" class="format-aed">AED ${parseFloat(e.total_amount_including_vat || 0).toFixed(2)}</td>
                        <td data-bs-toggle="tooltip" title="Payment">${e.payment_status || ''}</td>
                        <td data-bs-toggle="tooltip" title="Remarks" class="format-aed">${e.remarks || ''}</td>
                        <td class="text-nowrap">
                            <div class="d-flex align-items-center">
                                <button class="btn btn-danger btn-sm me-1" data-bs-toggle="tooltip" title="Delete" onclick="confirmLocalDelete(${e.sr_no}, null)">
                                    <i class="bi bi-trash"></i>
                                </button>
                                <button class="btn btn-success btn-sm me-1" data-bs-toggle="tooltip" title="Edit" onclick="editEntry(${e.sr_no})">
                                    <i class="bi bi-pencil-square"></i>
                                </button>
                                <button class="btn btn-secondary btn-sm" data-bs-toggle="tooltip" title="Copy" onclick="copyEntry(${e.sr_no})">
                                    <i class="bi bi-files"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                total += parseFloat(e.total_amount_including_vat || 0);

            } else {
                const combine = (field, prefix = '', suffix = '') =>
                    entries.map(e => `${e.sub_serial}. ${prefix}${field === 'date' ? formatDateLong(e[field]) : (e[field] || '-')}${suffix}`).join('<br>');

                const e0 = entries[0];
                html += `
                    <tr>
                        <td data-bs-toggle="tooltip" title="SR.NO">${e0.sr_no}</td>
                        <td data-bs-toggle="tooltip" title="client">${e0.client || ''}</td>
                        <td data-bs-toggle="tooltip" title="Date" data-date="${e0.date || ''}">${formatDateLong(e0.date)}</td>
                        <td data-bs-toggle="tooltip" title="Description">${combine('description')}</td>
                        <td data-bs-toggle="tooltip" title="Unit Price" class="format-aed">${combine('unit_price', 'AED ')}</td>
                        <td data-bs-toggle="tooltip" title="No. of CTNS" class="format-aed">${combine('no_of_ctns')}</td>
                        <td data-bs-toggle="tooltip" title="Units/CTN" class="format-aed">${combine('units_per_ctn')}</td>
                        <td data-bs-toggle="tooltip" title="Total Units" class="format-aed">${combine('total_no_of_units')}</td>
                        <td data-bs-toggle="tooltip" title="Amount No VAT" class="format-aed">${combine('total_amount_without_vat', 'AED ')}</td>
                        <td data-bs-toggle="tooltip" title="VAT" class="format-aed">${combine('vat_amount', 'AED ')}</td>
                        <td data-bs-toggle="tooltip" title="Total With VAT" class="format-aed">${combine('total_amount_including_vat', 'AED ')}</td>
                        <td data-bs-toggle="tooltip" title="Payment">${combine('payment_status')}</td>
                        <td data-bs-toggle="tooltip" title="Remarks" class="format-aed">${combine('remarks')}</td>
                        <td class="text-nowrap">
                            <div class="d-flex align-items-center">
                                <button class="btn btn-danger btn-sm me-1" data-bs-toggle="tooltip" title="Delete" onclick="confirmLocalDelete(${entries[0].sr_no}, 'multi')">
                                    <i class="bi bi-trash"></i>
                                </button>
                                <button class="btn btn-success btn-sm me-1" data-bs-toggle="tooltip" title="Edit" onclick="editEntry(${entries[0].sr_no})">
                                    <i class="bi bi-pencil-square"></i>
                                </button>
                                <button class="btn btn-secondary btn-sm" data-bs-toggle="tooltip" title="Copy" onclick="copyEntry(${entries[0].sr_no})">
                                    <i class="bi bi-files"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;

                // Add up total for each sub-entry
                entries.forEach(e => {
                    total += parseFloat(e.total_amount_including_vat || 0);
                });
            }
        });


        $('#localSalesTableBody').html(html);
        $('#totalSalesValue').text('AED ' + total.toLocaleString(undefined, { minimumFractionDigits: 2 }));

        applyNumberFormatting();

        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.forEach(function (tooltipTriggerEl) {
            new bootstrap.Tooltip(tooltipTriggerEl);
        });
    });
}

let lsDeleteSrNo = null;
let lsDeleteSubSerial = null;

function confirmLocalDelete(srNo, subSerial = null) {
    lsDeleteSrNo = srNo;
    lsDeleteSubSerial = subSerial;

    if (subSerial === null) {
        $('#lsDeleteConfirmationText').text(`Are you sure you want to delete SR.NO ${srNo}?`);
        $('#lsSubSerialInputContainer').hide();
    } else {
        $('#lsDeleteConfirmationText').text(`Enter sub-serial number to delete specific entry OR type 'all' to delete the entire group (SR.NO ${srNo})`);
        $('#lsSubSerialInput').val('');
        $('#lsSubSerialInputContainer').show();
    }

    $('#lsDeleteModal').modal('show');
}

function editEntry(sr_no, sub_serial = null) {
    const group = window.localSalesData.find(g => g.sr_no == sr_no);
    if (!group) return alert('Data not found.');

    // 1. Handle single entry row directly
    if (group.entries.length === 1) {
        prefillLocalEditForm(group.entries[0]);
        return;
    }

    // 2. For multiple entries, open modal to ask sub-serial
    $('#targetSrNoForEdit').val(sr_no); // Store the SR number
    $('#subSerialInput').val('');       // Clear input
    $('#subSerialEditModal').modal('show'); // Open modal
}

$('#confirmSubSerialEditBtn').on('click', function () {
    const sr_no = $('#targetSrNoForEdit').val();
    const sub_serial = parseInt($('#subSerialInput').val());

    const group = window.localSalesData.find(g => g.sr_no == sr_no);
    if (!group) return alert('Group not found.');

    if (!sub_serial || sub_serial < 1 || sub_serial > group.entries.length) {
        alert('Invalid sub-serial number!');
        return;
    }

    const target = group.entries.find(e => e.sub_serial == sub_serial);
    if (!target) {
        alert('Entry not found.');
        return;
    }

    $('#subSerialEditModal').modal('hide');
    prefillLocalEditForm(target);
});

function prefillLocalEditForm(target) {
    $('#clientName').val(target.client);
    $('#localDate').val(target.date);
    $('#ls-description').val(target.description);
    $('#ls-unit-price').val(target.unit_price);
    $('#noOfCtns').val(target.no_of_ctns);
    $('#ls-units-per-ctn').val(target.units_per_ctn);
    $('#ls-total-units').val(target.total_no_of_units);
    $('#vatPercent').val(target.vat_percentage);
    $('#paymentStatus').val(target.payment_status);
    $('#ls-remarks').val(target.remarks);

    $('#localSubmitBtn').addClass('d-none');
    $('#localUpdateBtn').removeClass('d-none').data('update-id', target.id);

    // Show manual modal if needed
    const noCtns = parseInt(target.no_of_ctns) || 0;
    const unitsPerCtn = parseInt(target.units_per_ctn) || 0;
    if (noCtns === 0 && unitsPerCtn === 0) {
        $('#manualTotalUnitsModal').modal('show');
        $('#manualTotalUnitsInput').val(target.total_no_of_units || '');
    }
    scrollToTopForm();
}

function copyEntry(sr_no, sub_serial = null) {
    const group = window.localSalesData.find(g => g.sr_no == sr_no);
    if (!group) return alert('Data not found.');

    if (group.entries.length === 1) {
        prefillLocalCopyForm(group.entries[0]);
        return;
    }

    // For multiple entries, open modal
    $('#targetSrNoForCopy').val(sr_no); // Store SR number
    $('#subSerialInputForCopy').val(''); // Clear input
    $('#subSerialCopyModal').modal('show'); // Open modal
}

function prefillLocalCopyForm(target) {
    $('#clientName').val(target.client);
    $('#localDate').val(target.date);
    $('#ls-description').val(target.description);
    $('#ls-unit-price').val(target.unit_price);
    $('#noOfCtns').val(target.no_of_ctns);
    $('#ls-units-per-ctn').val(target.units_per_ctn);
    $('#ls-total-units').val(target.total_no_of_units);
    $('#vatPercent').val(target.vat_percentage);
    $('#paymentStatus').val(target.payment_status);
    $('#ls-remarks').val(target.remarks);

    $('#localUpdateBtn').addClass('d-none');
    $('#localSubmitBtn').removeClass('d-none');

    $('#localUpdateBtn').removeData('update-id');
    scrollToTopForm();
}

function scrollToTopForm() {
    $('html, body').animate({
        scrollTop: $('#localSalesForm').offset().top - 50
    }, 300);
}

function scrollToBottomTable() {
    $('html, body').animate({
        scrollTop: $('#localSalesTableWrapper').offset().top + $('#localSalesTableWrapper').outerHeight()
    }, 300);
}

function convertToISO(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
}

function exportLOCALExcel() {
    const wb = XLSX.utils.book_new();
    const wsData = [];

    // Get Headers
    const headers = [];
    $('#localSalesTable thead tr:eq(0) th').each(function (index) {
        if (index < 13) { // Skip Action column
            headers.push($(this).text().trim());
        }
    });
    wsData.push(headers);

    // Get Rows
    $('#localSalesTableBody tr:visible').each(function () {
        const cells = $(this).find('td');
        const allColumns = [];

        cells.each(function (i) {
            if (i < 13) {
                const text = $(this).html().trim();
                // Split by <br> to get each line separately
                const parts = text.split(/<br\s*\/?>/i).map(p => $('<div>').html(p).text().trim());
                allColumns.push(parts);
            }
        });

        const maxLines = Math.max(...allColumns.map(col => col.length));

        // For each line, build a row
        for (let line = 0; line < maxLines; line++) {
            const row = [];
            allColumns.forEach(col => {
                row.push(col[line] || '');
            });
            wsData.push(row);
        }
    });

    // Append Sheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-wrap all cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellRef]) continue;
            if (!ws[cellRef].s) ws[cellRef].s = {};
            ws[cellRef].s.alignment = { wrapText: true };
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Local Sales");
    XLSX.writeFile(wb, 'local_sales.xlsx');
}

// Summery Sheet Logic

function loadSummarySheet() {
    $.get('/summary-data', function (data) {
        console.log('Summary Data Loaded:', data);
        const formatAED = (amount) => 'AED ' + parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2 });

        $('#totalPurchaseMaterial').text(formatAED(data.total_purchase_of_material));
        $('#totalShippingCost').text(formatAED(data.total_shipping_cost));
        $('#cashOutAmount').text(formatAED(data.cash_out));

        // Cache Cash Out globally
        cachedCashOut = parseFloat(data.cash_out) || 0;
    });
}

let summaryChart = null;
let cachedCashOut = 0;

function updateSummaryChart(cashIn, cashOut, profit) {
    const ctx = document.getElementById('summaryChart').getContext('2d');

    // Destroy existing chart to avoid duplicate rendering
    if (summaryChart) {
        summaryChart.destroy();
    }

    summaryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Cash In', 'Cash Out', 'Profit'],
            datasets: [{
                label: 'Amount (AED)',
                data: [cashIn, cashOut, profit],
                backgroundColor: ['#28a745', '#dc3545', '#007bff']
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    ticks: {
                        callback: value => `AED ${value}`
                    }
                }
            }
        }
    });
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

function loadCashInBreakdown() {
    $.ajax({
        url: '/summary/cash-in-breakdown',
        method: 'GET',
        dataType: 'json',
        success: function (data) {
            let totalMaterial = 0;
            let totalShipping = 0;
            let grandTotal = 0;
            let $tbody = $('#cashInBreakdownTable');
            $tbody.empty();

            data.forEach(function (row) {
                const material = parseFloat(row.material);
                const shipping = parseFloat(row.shipping);
                const total = parseFloat(row.total);

                totalMaterial += material;
                totalShipping += shipping;
                grandTotal += total;

                let $tr = $('<tr>');
                $tr.append(`<td>${row.sheet}</td>`);
                $tr.append(`<td>AED ${material.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>`);
                $tr.append(`<td>AED ${shipping.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>`);
                $tr.append(`<td>AED ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>`);
                $tbody.append($tr);
            });

            // Add Grand Total row
            let $totalRow = $(`
                <tr class="table-success fw-bold">
                    <td colspan="3" class="text-end">Grand Total:</td>
                    <td>AED ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
            `);
            $tbody.append($totalRow);

            // Update summary totals above table
            $('#cashInAmount').text('AED ' + grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }));

            // Calculate Cash Out
            const cashOut = cachedCashOut;

            // Calculate Profit (Cash In - Cash Out)
            const profit = grandTotal - cashOut;

            // Update Profit card
            $('#profitAmount').text('AED ' + profit.toLocaleString(undefined, { minimumFractionDigits: 2 }));
            updateProfitBreakdown(profit);

            // Update the chart
            if (summaryChart) {
                summaryChart.data.datasets[0].data = [
                    grandTotal,  // Cash In
                    cashOut,     // Cash Out
                    profit       // Profit
                ];
                summaryChart.update();
            } else {
                const ctx = document.getElementById('summaryChart').getContext('2d');
                summaryChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Cash In', 'Cash Out', 'Profit'],
                        datasets: [{
                            label: 'Amount (AED)',
                            data: [grandTotal, cashOut, profit],
                            backgroundColor: ['#28a745', '#dc3545', '#007bff']
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: value => `AED ${value}`
                                }
                            }
                        }
                    }
                });
            }
        },
        error: function (xhr, status, error) {
            console.error('Error loading cash-in breakdown:', error);
        }
    });
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
