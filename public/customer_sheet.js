let currentCustomerSheet = null;
let tempCustomerRowData = {};
let rowToDeleteId = null;
let rowToDeleteSheetId = null;
let currentEntryId = null;
let currentSheetId = null;

// Parse any "AED 12,345.67" or "12,345.67" to Number
const num = v => Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;
// Format numbers with commas
const fmt = v => num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// no decimals
const fmt0 = v => num(v).toLocaleString('en-US');
// AED wrapper
const aed = v => `AED ${fmt(v)}`;

$(document).ready(function () {

    $.ajaxSetup({
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        }
    });

    // Open Modal
    $(document).on('click', '.add-customer-row-btn', function () {
        const sheetId = Number($(this).data('sheet-id')); // numeric id
        $('#customerAddRowForm')[0]?.reset();
        $('#customerAddRowForm').data('sheet-id', sheetId); // stash for submit
        $('#customerAddRowModal').addClass('flex').removeClass('hidden');
    });

    // Cancel Modal
    $('#customerRowCancelBtn').on('click', function () {
        $('#customerAddRowModal').addClass('hidden').removeClass('flex');
        $('#customerAddRowForm')[0].reset();
    });

    // Add Row on Modal Submit
    $('#customerAddRowForm').off('submit.addTempRow').on('submit.addTempRow', function (e) {
        e.preventDefault();

        const sheetId = Number($(this).data('sheet-id')); // from step 1
        const $tbody = $(`#customerTableBody-${sheetId}`); // per-sheet
        const date = $('#customerDate').val();
        const supplier = $('#customerSupplier').val();
        const description = $('#customerDescription').val();

        // keep your global stash (you use it in customerSaveBtn handler)
        window.tempCustomerRowData = { date, supplier, description };

        const rowId = `customer-${Date.now()}`;
        const serialNumber = $tbody.find('.customer-header-row').length + 1;
        const formattedDate = formatDateToWords(date);

        // Create Header Row
        const $headerRow = $(`
            <tr class="customer-header-row cursor-pointer hover:bg-gray-100" data-id="${rowId}" data-sheet-id="${sheetId}" data-date="${date}" data-supplier="${supplier}" data-description="${$('<div>').text(description).html()}" data-submitted="false" data-new="true">
                <td class="border p-2 text-center">${serialNumber}</td>
                <td class="border p-2">${formattedDate}</td>
                <td class="border p-2">${supplier}</td>
                <td class="border p-2">${description}</td>
                <td class="border p-2 header-total-material">AED 0</td>
                <td class="border p-2 header-total-shipping">AED 0</td>
                <td class="border p-2 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button id="customerSaveBtn" class="submit-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded">Submit</button>
                    </div>
                </td>
            </tr>
        `);

        // Create Empty Detail Row (we'll enhance this in next step)
        const $detailRow = $(`
        <tr class="detail-row relative hidden" data-new="true" data-id="${rowId}" data-sheet-id="${sheetId}">
            <td colspan="8" class="p-2 bg-gray-50">
            <div class="text-center font-bold text-xl mb-4 bg-blue-200 p-2">${supplier}</div>

            <div class="flex justify-center">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-16 w-full max-w-5xl mx-auto">
                <!-- Left Summary Block -->
                <div class="space-y-2 border-4 border-zinc-500 p-5 bg-white">
                    <div class="flex items-start gap-2"><span class="font-semibold w-56">Total Weight (KG):</span> <div class="flex-1 text-gray-700 total-weight-kg">0</div></div>
                    <div class="flex items-start gap-2"><span class="font-semibold w-56">Total No. of Units:</span> <div class="flex-1 text-gray-700 total-units">0</div></div>
                    <div class="flex items-start gap-2"><span class="font-semibold w-56">DGD:</span> <div class="flex-1 text-gray-700 dgd-value">AED</div></div>
                    <div class="flex items-start gap-2"><span class="font-semibold w-56">Labour Charges:</span> <div class="flex-1 text-gray-700 labour-value">AED</div></div>
                    <div class="flex items-start gap-2"><span class="font-semibold w-56">Shipping Cost:</span> <div class="flex-1 text-gray-700 shipping-cost-value">0</div></div>
                </div>

                <!-- Right Editable Section -->
                <div class="space-y-2 border-4 border-zinc-500 p-5 bg-white">
                    <div class="flex items-start gap-2"><span class="font-semibold w-56">Mode of Transaction:</span> <input type="text" name="mode_of_transaction" placeholder="Enter Transaction Method" class="flex-1 editable-input w-full rounded px-2 py-1 bg-white border border-gray-300 mode-of-transaction-input" /></div>
                    <div class="flex items-start gap-2"><span class="font-semibold w-56">Receipt No:</span> <textarea name="receipt_no" placeholder="Enter receipt numbers" class="flex-1 dynamic-textarea w-full rounded px-2 py-1 bg-white border border-gray-300 resize-none overflow-hidden receipt-no-input""></textarea></div>
                    <div class="flex items-start gap-2"><span class="font-semibold w-56">Remarks:</span> <textarea name="remarks" placeholder="Enter Remarks" class="flex-1 dynamic-textarea w-full rounded px-2 py-1 bg-white border border-gray-300 resize-none overflow-hidden remarks-input"></textarea></div>
                </div>
                </div>
            </div>

            <!-- Item Table + Add Button -->
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
                <tbody id="itemTableBody-${rowId}">
                    <!-- Dynamic Rows Here -->
                </tbody>
                </table>
                <button class="add-item-btn mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600" data-target="${rowId}">+ Add More Items</button>
            </div>

            <!-- Summary Footer -->
            <div class="mt-4 border-4 border-zinc-700 bg-white">
                <div class="grid grid-cols-2 divide-x divide-gray-300">
                <div class="flex items-center border-b p-2 font-semibold w-full">Total Material w/out VAT:</div>
                <div class="flex items-center border-b p-2 w-full bg-yellow-100 total-material-without-vat">AED 0</div>

                <div class="flex items-center border-b p-2 font-semibold w-full">Total VAT:</div>
                <div class="flex items-center border-b p-2 w-full bg-yellow-100 total-vat">AED 0</div>

                <div class="flex items-center border-b p-2 font-semibold w-full">Total Material Buy:</div>
                <div class="flex items-center border-b p-2 w-full bg-yellow-100 total-material-buy">AED 0</div>

                <div class="flex items-center border-b p-2 font-semibold w-full">Shipping Cost:</div>
                <div class="flex items-center gap-1 border-b p-2 w-full bg-yellow-100">
                    <span class="font-medium">AED</span>
                    <input type="number" value="0" min="0" class="shipping-input w-full bg-yellow-100 border-0 focus:outline-none" />
                </div>

                <div class="flex items-center border-b p-2 font-semibold w-full">DGD:</div>
                <div class="flex items-center gap-1 border-b p-2 w-full bg-yellow-100">
                    <span class="font-medium">AED</span>
                    <input type="number" value="0" min="0" 
                        class="dgd-input shipping-input w-full bg-yellow-100 border-0 focus:outline-none" />
                </div>

                <div class="flex items-center border-b p-2 font-semibold w-full">Labour:</div>
                <div class="flex items-center gap-1 border-b p-2 w-full bg-yellow-100">
                    <span class="font-medium">AED</span>
                    <input type="number" value="0" min="0" 
                        class="labour-input shipping-input w-full bg-yellow-100 border-0 focus:outline-none" />
                </div>

                <div class="flex items-center p-2 font-semibold w-full">Total Shipping Cost:</div>
                <div class="flex items-center gap-1 p-2 w-full bg-yellow-100">
                    <span class="total-shipping-cost">0.00</span>
                </div>
            </div>
            </td>
        </tr>
        `);

        // Append both rows
        $tbody.append($headerRow).append($detailRow);

        const $itemTableBody = $detailRow.find(`#itemTableBody-${rowId}`);
        $itemTableBody.append(createItemRow(1));

        // Call this function to bind calculation immediately
        bindLiveCalculation($detailRow, $headerRow);

        $detailRow.find('.total-shipping-cost').text(fmt(0));

        // Close Modal & Reset
        $('#customerAddRowModal').addClass('hidden').removeClass('flex');
        $('#customerAddRowForm')[0].reset();
    });

    // Toggle Detail Row
    $(document).on('click', '.customer-header-row', function () {
        const id = $(this).data('id');
        $(`.detail-row[data-id="${id}"]`).toggleClass('hidden');
    });

    $(document).on('click', '.add-item-btn', function () {
        const target = $(this).data('target');
        const $tableBody = $(`#itemTableBody-${target}`);
        const sno = $tableBody.find('.item-row').length + 1;
        $tableBody.append(createItemRow(sno));
    });

    $(document).on('click', '.delete-item-btn', function () {
        $(this).closest('tr').remove();

        // Reindex S.NO
        $(this).closest('tbody').find('.item-row').each(function (index) {
            $(this).find('td:first').text(index + 1);
        });
    });

    // Save Button Click
    $(document).off('click.customerSave').on('click.customerSave', '#customerSaveBtn', function () {
        // scope to the row that contains the clicked button
        const $headerRow = $(this).closest('tr.customer-header-row');
        const rowId = String($headerRow.data('id'));
        const sheetId = Number($headerRow.data('sheet-id'));

        const $tbody = $(`#customerTableBody-${sheetId}`);
        const $detailRow = $tbody.find(`.detail-row[data-id="${rowId}"]`);

        if (!sheetId || !$detailRow.length) {
            alert('Missing sheet/row context.');
            return;
        }

        // Prefer header data; fallback to tempCustomerRowData
        const date = $headerRow.data('date') || (window.tempCustomerRowData?.date) || '';
        const supplier = $headerRow.data('supplier') || (window.tempCustomerRowData?.supplier) || '';
        const description = $headerRow.data('description') || (window.tempCustomerRowData?.description) || '';

        // ---- Totals from this row's detail only (scoped!) ----
        const num = s => parseFloat(String(s || '').replace(/[^\d.-]/g, '')) || 0;
        const calculatedMaterialBuy = num($detailRow.find('.total-material-buy').text());
        const calculatedShipping = num($detailRow.find('.total-shipping-cost').text());
        const calculatedVAT = num($detailRow.find('.total-vat').text());
        const calculatedWeight = num($detailRow.find('.total-weight-kg').text());
        const calculatedUnits = num($detailRow.find('.total-units').text().replace(/,/g, ''));
        const calculatedMaterialNoVAT = num($detailRow.find('.total-material-without-vat').text());
        const calculatedDGD = num($detailRow.find('.dgd-input').val() || $detailRow.find('.dgd-value').text());
        const calculatedLabour = num($detailRow.find('.labour-input').val() || $detailRow.find('.labour-value').text());
        const calculatedShippingRate = num($detailRow.find('.shipping-input').val() || $detailRow.find('.shipping-cost-value').text());

        // sum total weight from item rows (scoped)
        let sumTotalWeight = 0;
        $detailRow.find('tr.item-row').each(function () {
            sumTotalWeight += num($(this).find('.total-weight').text());
        });

        const modeOfTransaction =
            ($detailRow.find('[name="mode_of_transaction"]').val()
                || $detailRow.find('.mode-of-transaction-input').val()
                || '').trim();

        const receiptNo =
            ($detailRow.find('[name="receipt_no"]').val()
                || $detailRow.find('.receipt-no-input').val()
                || '').trim();

        const remarksText =
            ($detailRow.find('[name="remarks"]').val()
                || $detailRow.find('.remarks-input').val()
                || '').trim();

        // ---- Build items from this detail row ----
        const items = [];
        $detailRow.find('tr.item-row').each(function () {
            const $r = $(this);
            items.push({
                description: $r.find('[data-field="description"]').val() || '',
                units: num($r.find('[data-field="units"]').val()),
                unit_price: num($r.find('[data-field="unitPrice"]').val()),
                vat: num($r.find('[data-field="vat"]').val()),
                ctns: num($r.find('[data-field="ctns"]').val()),
                weight_per_ctn: num($r.find('[data-field="weightPerCtn"]').val()),
                total_weight: num($r.find('.total-weight').text()),
            });
        });

        const payload = {
            sheet_id: sheetId,
            date, supplier, description,

            total_material_without_vat: calculatedMaterialNoVAT,
            total_vat: calculatedVAT,
            total_material_buy: calculatedMaterialBuy,
            shipping_cost: calculatedShippingRate,
            dgd: calculatedDGD,
            labour: calculatedLabour,
            total_shipping_cost: calculatedShipping,
            total_weight: +sumTotalWeight.toFixed(2),
            total_units: calculatedUnits,

            mode_of_transaction: modeOfTransaction,
            receipt_no: receiptNo,
            remarks: remarksText,

            items
        };

        $(this).prop('disabled', true);

        // ---- POST -> save ----
        $.post({
            url: '/customer-sheet/store',
            data: payload,
            headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') }
        })
            .done(() => {
                // reload just this sheet so the new DB row replaces temp
                loadCustomerSheetData(sheetId);
                loadLoanLedger(sheetId);
                // (optional) notify
                // alert('Saved successfully');
            })
            .fail(err => {
                console.error(err.responseJSON || err);
                alert('Save failed. See console.');
            })
            .always(() => {
                $(this).prop('disabled', false);
            });
    });

    // DELETE button inside each row
    $(document).on('click', '.delete-btn', function () {
        const $hdr = $(this).closest('tr.customer-header-row');        // header row
        rowToDeleteId = String($hdr.data('id')).replace('customer-', ''); // numeric entry id
        rowToDeleteSheetId = Number($hdr.data('sheet-id'))             // you already set data-sheet-id on header
            || Number($('#customer-sheet-id').val());  // fallback
        $('#deleteModal').removeClass('hidden').addClass('flex');
    });

    $('#cancelCrowDeleteBtn').on('click', function () {
        $('#deleteModal').addClass('hidden').removeClass('flex');
        rowToDeleteId = null;
        rowToDeleteSheetId = null;
    });

    $('#confirmCrowDeleteBtn').on('click', function () {
        if (!rowToDeleteId) return;

        $.ajax({
            url: `/customer-sheet/delete-entry/${rowToDeleteId}`,
            method: 'DELETE',
            data: { _token: $('meta[name="csrf-token"]').attr('content') }
        })
            .done(() => {
                // Remove header + detail for this sheet only
                const sid = rowToDeleteSheetId || Number($('#customer-sheet-id').val());
                const $tbody = $(`#customerTableBody-${sid}`);

                $tbody.find(`tr.customer-header-row[data-id="customer-${rowToDeleteId}"]`).remove();
                $tbody.find(`tr.detail-row[data-id="customer-${rowToDeleteId}"]`).remove();

                // Reindex S.No within this sheet only
                $tbody.find('tr.customer-header-row').each(function (i) {
                    $(this).find('td').eq(0).text(i + 1);
                });

                // Close modal
                $('#deleteModal').addClass('hidden').removeClass('flex');
                rowToDeleteId = null;
                rowToDeleteSheetId = null;

                // Reload THIS sheet to refresh top cards + remaining balance (server sends totals)
                if (typeof loadCustomerSheetData === 'function' && sid) {
                    loadCustomerSheetData(sid);
                }
                // Loan ledger didn’t change, but if you compute remaining on the client, you can also:
                // if (typeof updateLoanLedgerTotals === 'function') {
                //   const sheetName = $('#headerTitle').text().replace('Customer Sheet: ', '');
                //   updateLoanLedgerTotals(sid, sheetName);
                // }
            })
            .fail(() => {
                alert('Server error');
            });
    });

    $(document).off('submit.blockUpdate')
        .on('submit.blockUpdate', 'form[action$="/update-customer-sheet"]', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.warn('Blocked legacy form submit to /update-customer-sheet');
        });

    $(document).on('click', '.save-changes-btn', function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (isRendering) return; // do not run while rendering

        const $headerRow = $(this).closest('.customer-header-row');
        const rowId = $headerRow.data('id');             // "customer-<id>"
        const entryId = Number($headerRow.data('entry-id'));
        const sheetId = Number($headerRow.data('sheet-id') || $('#customer-sheet-id').val());
        const dateRaw = String($headerRow.data('date') || '');
        const supplier = String($headerRow.data('supplier') || '');
        const descRaw = String($headerRow.data('description') || '');

        if (!entryId || !sheetId || !dateRaw || !supplier) {
            console.error('❌ Missing:', { entryId, sheetId, dateRaw, supplier, headerData: $headerRow.data() });
            alert('Missing required fields (id/sheet_id/date/supplier). Open console.');
            return;
        }

        const $detailRow = $(`.detail-row[data-id="${rowId}"]`);

        // Read Summary Right inputs
        const mode_of_transaction = ($detailRow.find('[name="mode_of_transaction"]').val() || '').trim();
        const receipt_no = ($detailRow.find('[name="receipt_no"]').val() || '').trim();
        const remarks = ($detailRow.find('[name="remarks"]').val() || '').trim();

        // Read totals from DOM
        const n = s => parseFloat((s || '').toString().replace(/[^\d.-]/g, '')) || 0;

        // Collect item rows
        const items = [];
        $detailRow.find('tr.item-row').each(function () {
            const $r = $(this);
            items.push({
                description: $r.find('[data-field="description"]').val() || '',
                units: n($r.find('[data-field="units"]').val()),
                unit_price: n($r.find('[data-field="unitPrice"]').val()),
                vat: n($r.find('[data-field="vat"]').val()),
                ctns: n($r.find('[data-field="ctns"]').val()),
                weight_per_ctn: n($r.find('[data-field="weightPerCtn"]').val()),
                total_weight: n($r.find('.total-weight').text()),
            });
        });

        // Derive sums from items (source of truth)
        const sumUnits = items.reduce((t, i) => t + (i.units || 0), 0);
        const sumWeight = items.reduce((t, i) => t + (i.total_weight || 0), 0);

        const total_material_without_vat = n($detailRow.find('.total-material-without-vat').text());
        const total_material_buy = n($detailRow.find('.total-material-buy').text());
        const total_vat = n($detailRow.find('.total-vat').text());
        const dgd = n($detailRow.find('.dgd-input').val());
        const labour = n($detailRow.find('.labour-input').val());
        const shipping_cost = n($detailRow.find('.shipping-input').val());

        console.log('total_material_without_vat →', total_material_without_vat);

        // Compute shipping total; prefer computed over DOM fallback
        const totalShippingCost = dgd + labour + shipping_cost;

        // Also push the computed values back to the UI so it’s consistent
        $detailRow.find('.total-units').text(sumUnits.toFixed(2));
        $detailRow.find('.total-weight-kg').text(sumWeight.toFixed(2));
        $detailRow.find('.total-shipping-cost').text(totalShippingCost.toFixed(2)); // text only; see B for AED label

        const payload = {
            id: entryId,
            sheet_id: sheetId,
            date: dateRaw,
            supplier,
            description: descRaw,

            total_material_without_vat,
            total_material_buy,
            total_vat,
            shipping_cost,
            dgd,
            labour,
            total_shipping_cost: totalShippingCost,
            total_weight: sumWeight,
            total_units: sumUnits,

            mode_of_transaction,
            receipt_no,
            remarks,

            items
        };

        // Compute a robust URL, then POST
        const UPDATE_URL =
            document.getElementById('customer-sheet-root')?.dataset.updateUrl ||
            (window.routes && typeof window.routes.updateCustomerEntry === 'string' && window.routes.updateCustomerEntry.length
                ? window.routes.updateCustomerEntry
                : (typeof investmentUrl === 'function'
                    ? investmentUrl('customer-sheet/entry/update')
                    : '/customer-sheet/entry/update'));

        if (!UPDATE_URL || UPDATE_URL === '/') {
            console.error('Bad UPDATE_URL:', UPDATE_URL);
            alert('Update URL is not set. Refresh the page and try again.');
            return;
        }

        $.ajax({
            type: 'POST',
            url: UPDATE_URL,
            data: payload,
            headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') }
        })
            .done(() => {
                $detailRow.find('input, textarea').each(function () { $(this).data('orig', $(this).val() || ''); });
                $headerRow.find('.save-changes-btn').addClass('hidden');
                loadCustomerSheetData($('#customer-sheet-id').val());
            })
            .fail(err => {
                console.error('Update failed:', err.responseJSON || err);
                alert('Update failed. See console for details.');
            });
    });

    // ------- Modal open/close -------
    $(document).on('click', '.open-loan-modal-btn', function () {
        const sheetId = $(this).data('sheet-id');
        $('#loanRowId').val('');
        $('#loanForm').data('sheet-id', sheetId);
        $('#loanDate').val(new Date().toISOString().slice(0, 10));
        $('#loanDescription').val('');
        $('#loanAmount').val('');
        $('#loanModalTitle').text('Add Loan Entry');
        $('#loanModal').removeClass('hidden').addClass('flex');
    });

    $('#closeLoanModal, #cancelLoanModal').on('click', function () {
        $('#loanModal').addClass('hidden').removeClass('flex');
    });

    // ------- Submit (Add / Update) -------
    $('#loanForm').on('submit', function (e) {
        e.preventDefault();
        const sheetId = $(this).data('sheet-id') || Number($('#customer-sheet-id').val());
        const id = $('#loanRowId').val();
        const payload = {
            date: $('#loanDate').val(),
            description: $('#loanDescription').val(),
            amount: $('#loanAmount').val()
        };
        const headers = { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') };

        const req = id
            ? $.ajax({ url: window.routes.loanLedgerUpdate.replace(':id', id), method: 'PUT', headers, data: payload })
            : $.ajax({ url: window.routes.loanLedgerStore.replace(':sheetId', sheetId), method: 'POST', headers, data: payload });

        req.done(() => {
            // close modal
            $('#loanModal').addClass('hidden').removeClass('flex');

            // reload ledger, then recalc the 3 top cards (and/or whole sheet if you prefer)
            loadLoanLedger(sheetId, () => {
                // if you compute cards from both ledger + entries:
                if (typeof loadCustomerSheetData === 'function') loadCustomerSheetData(sheetId);
                if (typeof updateLoanLedgerTotals === 'function') {
                    const sheetName = $('#headerTitle').text().replace('Customer Sheet: ', '');
                    updateLoanLedgerTotals(sheetId, sheetName);
                }
            });
        }).fail(() => alert('Save failed'));
    });

    // ------- Edit -------
    $(document).on('click', '.loan-edit', function () {
        const $tr = $(this).closest('tr');
        const id = $tr.data('loan-id');
        const sheet = $tr.data('sheet-id');
        const rawDate = $tr.data('loan-date');  // Expecting format: 2025-08-11
        const rawAmount = $tr.data('loan-amount'); // Expecting numeric value
        const desc = $tr.find('td').eq(2).text().trim();

        // make sure the form knows which sheet we are editing for
        $('#loanForm').data('sheet-id', sheet);

        $('#loanRowId').val(id);
        $('#loanDate').val(rawDate || '');
        $('#loanDescription').val(desc);
        $('#loanAmount').val(rawAmount || '');
        $('#loanModalTitle').text('Edit Loan Entry');
        $('#loanModal').removeClass('hidden').addClass('flex');
    });

    // ------- Delete -------
    $(document).on('click', '.loan-delete', function () {
        const $tr = $(this).closest('tr');
        const id = $tr.data('loan-id');
        const sheetId = $tr.data('sheet-id');
        if (!confirm('Delete this loan entry?')) return;

        $.ajax({
            url: window.routes.loanLedgerDestroy.replace(':id', id),
            method: 'DELETE',
            data: { _token: $('meta[name="csrf-token"]').attr('content') }
        }).done(() => loadLoanLedger(sheetId, () => loadCustomerSheetData(sheetId)))
            .fail(() => alert('Delete failed'));
    });

    // -------- Upload modal (per-sheet) ----------
    $(document).off('click', '.btn-upload-attachments')
        .on('click', '.btn-upload-attachments', function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const entryId = $(this).data('entry-id');
            const sheetId = $(this).data('sheet-id');
            if (!entryId || !sheetId) return;

            // target THIS sheet's modal + hidden input
            const $modal = $(`#uploadAttachmentModal-${sheetId}`);
            $modal.find(`#attEntryId-${sheetId}`).val(entryId);
            $modal.removeClass('hidden').addClass('flex');
        });

    // Close upload (per-sheet)
    $(document).off('click', '.close-upload, .cancel-upload')
        .on('click', '.close-upload, .cancel-upload', function () {
            const $modal = $(this).closest('[id^="uploadAttachmentModal-"]');
            $modal.addClass('hidden').removeClass('flex');
        });

    // Submit upload (per-sheet)
    $(document).off('submit', '[id^="uploadAttachmentForm-"]').on('submit', '[id^="uploadAttachmentForm-"]', function (e) {
        e.preventDefault();

        const sheetId = this.id.split('-').pop();
        const $form = $(`#uploadAttachmentForm-${sheetId}`);
        const $modal = $(`#uploadAttachmentModal-${sheetId}`);
        const entryId = $modal.find(`#attEntryId-${sheetId}`).val();

        const fd = new FormData();
        const filesEl = $form.find('.attFiles')[0];
        if (filesEl && filesEl.files) {
            for (let i = 0; i < filesEl.files.length; i++) fd.append('files[]', filesEl.files[i]);
        }

        const typeVal = ($form.find('[name="type"]').val() || '').toLowerCase();

        fd.append('type', ['invoice', 'receipt', 'note'].includes(typeVal) ? typeVal : 'other');

        $.ajax({
            url: `/customer-sheet/${entryId}/attachments`,
            method: 'POST',
            data: fd,
            processData: false,
            contentType: false,
        }).done(function () {
            $form.find('.attFiles').val('');
            $form.find('.file-name-display').val('No file chosen');
            loadAttachments(entryId, sheetId);
            refreshAttachmentCount(entryId, sheetId);
            $modal.addClass('hidden').removeClass('flex');
        });
    });

    // -------- Viewer modal (per-sheet) ----------
    $(document).off('click', '.btn-view-attachments')
        .on('click', '.btn-view-attachments', function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            currentEntryId = $(this).data('entry-id');
            currentSheetId = $(this).data('sheet-id');

            if (!currentEntryId || !currentSheetId) return;

            openViewer(currentEntryId, currentSheetId);
        });

    // Bind once
    $(document).off('click', '[id^="downloadAllBtn-"]').on('click', '[id^="downloadAllBtn-"]', function () {
        if (!currentEntryId) return;
        window.location = `/customer-sheet/${currentEntryId}/attachments/download-all`;
    });

    // Close viewer (per-sheet)
    $(document).off('click', '.close-view')
        .on('click', '.close-view', function () {
            const $modal = $(this).closest('[id^="viewAttachmentModal-"]');
            $modal.addClass('hidden').removeClass('flex');
        });

    $(document).off('click', '.del-att').on('click', '.del-att', function () {
        const id = $(this).data('id');
        const sheetId = $(this).data('sheet-id');
        const entryId = currentEntryId;
        if (!id || !sheetId || !entryId) return;
        if (!confirm('Delete this attachment?')) return;

        $.ajax({
            url: `/customer-sheet/attachments/${id}`,
            method: 'DELETE',
            success: function () {
                // read entry id from the upload modal of this sheet (it stores the last used one)
                const entryId = $(`#uploadAttachmentModal-${sheetId}`).find(`#attEntryId-${sheetId}`).val()
                    || $(`#viewAttachmentModal-${sheetId}`).find('#attachmentViewerTitle').text().replace('#', '');
                loadAttachments(entryId, sheetId);
                refreshAttachmentCount(entryId, sheetId);
            }
        });
    });

    // Row toggle (ignore action buttons)
    $(document).off('click', '.customer-header-row')
        .on('click', '.customer-header-row', function (e) {
            if ($(e.target).closest('.btn-upload-attachments, .btn-view-attachments, .save-changes-btn, .delete-btn').length) {
                e.stopImmediatePropagation();  // belt & suspenders
                return;
            }
            const rowId = $(this).data('id');
            const $targetRow = $(`.detail-row[data-id="${rowId}"]`);
            $('.detail-row').not($targetRow).slideUp(200);
            $targetRow.stop(true, true).slideToggle(200);
        });

    // === Make header "Save" appear when summary costs change ===
    $(document)
        .off('input.custDirty change.custDirty',
            '.detail-row .dgd-input, .detail-row .labour-input, .detail-row .shipping-input')
        .on('input.custDirty change.custDirty',
            '.detail-row .dgd-input, .detail-row .labour-input, .detail-row .shipping-input',
            function () {
                const $detail = $(this).closest('.detail-row');
                const rowId = $detail.data('id');
                const $header = $(`.customer-header-row[data-id="${rowId}"]`);

                // live recompute “Total Shipping Cost”
                const n = v => parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;
                const total = n($detail.find('.dgd-input').val())
                    + n($detail.find('.labour-input').val())
                    + n($detail.find('.shipping-input').val());
                $detail.find('.total-shipping-cost').text(total.toFixed(2));

                // show/hide Save depending on real dirtiness
                const dirty = isRowDirty($detail);
                $header.find('.save-changes-btn').toggleClass('hidden', !dirty);
            });

    // (optional) If remarks / receipt / mode change should also trigger Save:
    $(document)
        .off('input.custDirtyMeta change.custDirtyMeta',
            '.detail-row [name="mode_of_transaction"], .detail-row [name="receipt_no"], .detail-row [name="remarks"]')
        .on('input.custDirtyMeta change.custDirtyMeta',
            '.detail-row [name="mode_of_transaction"], .detail-row [name="receipt_no"], .detail-row [name="remarks"]',
            function () {
                const $detail = $(this).closest('.detail-row');
                const rowId = $detail.data('id');
                $(`.customer-header-row[data-id="${rowId}"] .save-changes-btn`).removeClass('hidden');
            });

    // Open the hidden file input
    $(document).on('click', '.btn-browse', function () {
        const sheetId = $(this).data('sheet-id');
        $(`#uploadAttachmentForm-${sheetId}`).find('.attFiles')[0].click();
    });

    // Show selected names
    $(document).on('change', '.attFiles', function () {
        const names = this.files && this.files.length
            ? [...this.files].map(f => f.name).join(', ')
            : 'No file chosen';
        $(this).closest('form').find('.file-name-display').val(names);
    });

    // react to a newly-created customer sheet (emitted by Summary create modal code) ---
    $(document).on('customerSheet:created', function (_e, payload) {
        // Supports either {id, name} or {data: {id, sheet_name}}
        const id = payload?.id ?? payload?.data?.id;
        const name = payload?.name ?? payload?.sheet_name ?? payload?.data?.sheet_name;
        if (!id || !name) return;
        addCustomerSheetUI({ id, name });
    });

});

function refreshAttachmentCount(entryId, sheetId) {
    $.getJSON(`/customer-sheet/${entryId}/attachments`, function (res) {
        const n = (res.attachments || []).length;
        $(`#att-count-${sheetId}-${entryId}`).text(n);
    });
}

// ----- helpers (SHEET-AWARE) -----
function openViewer(entryId, sheetId) {
    const $modal = $(`#viewAttachmentModal-${sheetId}`);
    const $row = $(`.customer-header-row[data-entry-id="${entryId}"][data-sheet-id="${sheetId}"]`);

    const supplier = ($row.data('supplier') || '').trim();
    const descr = ($row.data('description') || '').trim();
    const dateRaw = ($row.data('date') || '').trim();
    let niceDate = dateRaw;
    if (typeof formatDateToWords === 'function') {
        try { niceDate = formatDateToWords(dateRaw); } catch { }
    }

    const bits = [];
    if (supplier) bits.push(supplier);
    if (descr) bits.push(descr);
    if (niceDate) bits.push(niceDate);

    const titleText = bits.join(' • ');
    const title = titleText.length > 90 ? titleText.slice(0, 90) + '…' : titleText || 'Attachments';
    $modal.find('#attachmentViewerTitle').text(title);

    $modal.removeClass('hidden').addClass('flex');

    // Disable download until attachments are loaded
    const $dl = $(`#downloadAllBtn-${sheetId}`);
    $dl.prop('disabled', true).addClass('opacity-50 cursor-not-allowed');

    loadAttachments(entryId, sheetId);
}

function loadAttachments(entryId, sheetId) {
    $.getJSON(`/customer-sheet/${entryId}/attachments`, function (res) {
        const $box = $(`#attachmentsList-${sheetId}`).empty();
        const $dl = $(`#downloadAllBtn-${sheetId}`);

        const list = res && Array.isArray(res.attachments) ? res.attachments : [];

        // update the badge right here too
        $(`#att-count-${sheetId}-${entryId}`).text(list.length);

        if (list.length === 0) {
            $box.html(`
        <div class="text-center text-gray-500 py-10">
          <div class="text-lg font-semibold mb-1">Nothing added</div>
          <div class="text-sm">No attachments have been uploaded for this entry yet.</div>
        </div>
      `);
            $dl.prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            return;
        }

        $dl.prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');

        // render every attachment (like your PDF “links list”)
        list.forEach(a => {
            const label = (a.type || 'other').toLowerCase();
            const href = a.path ? `/storage/${a.path}` : '#';
            const name = a.original_name || '';
            const size = a.size ? (a.size / 1024).toFixed(1) + ' KB' : '';

            $box.append(`
        <div class="flex items-center justify-between border-b py-3">
          <div class="flex items-center gap-2">
            <span class="inline-block text-white text-[10px] px-2 py-0.5 rounded-full ${label === 'invoice' ? 'bg-blue-600' :
                    label === 'receipt' ? 'bg-green-600' :
                        label === 'note' ? 'bg-orange-500' : 'bg-gray-600'
                }">${label.charAt(0).toUpperCase() + label.slice(1)}</span>
            <a href="${href}" target="_blank" class="text-blue-600 hover:underline">Open</a>
            <span class="text-xs text-gray-500">${name}</span>
            <span class="text-[10px] text-gray-400">${size}</span>
          </div>
          <button class="del-att px-2 py-1 border rounded text-red-600" data-id="${a.id}" data-sheet-id="${sheetId}">
            Delete
          </button>
        </div>
      `);
        });
    });
}

function bindLiveCalculation($detailRow, $headerRow) {
    $detailRow.off('input.calc').on('input', '.item-row input, .dgd-input, .labour-input, .shipping-input', function () {
        let totalMaterialNoVAT = 0;
        let totalMaterialBuy = 0;
        let totalVAT = 0;
        let totalWeight = 0;
        let totalUnits = 0;

        const dgd = parseFloat($detailRow.find('.dgd-input').val()) || 0;
        const labour = parseFloat($detailRow.find('.labour-input').val()) || 0;
        const shipping = parseFloat($detailRow.find('.shipping-input').val()) || 0;
        const totalShippingCost = dgd + labour + shipping;

        const items = [];

        $detailRow.find('.item-row').each(function () {
            const $row = $(this);

            const units = parseFloat($row.find('[data-field="units"]').val()) || 0;
            const unitPrice = parseFloat($row.find('[data-field="unitPrice"]').val()) || 0;
            const vatRaw = $row.find('[data-field="vat"]').val();
            const vatValue = (vatRaw !== "" && !isNaN(parseFloat(vatRaw))) ? parseFloat(vatRaw) : 0;

            const weightPerCtn = parseFloat($row.find('[data-field="weightPerCtn"]').val()) || 0;
            const ctns = parseFloat($row.find('[data-field="ctns"]').val()) || 0;

            const materialWithoutVAT = units * unitPrice;
            const materialBuy = vatValue > 0
                ? materialWithoutVAT * vatValue
                : materialWithoutVAT;
            const weight = weightPerCtn * ctns;

            totalMaterialNoVAT += materialWithoutVAT;
            totalMaterialBuy += materialBuy;
            totalVAT += vatValue;
            totalUnits += units;
            totalWeight += weight;

            items.push({
                units: units,
                unit_price: unitPrice,
                vat: vatValue,
                ctns: ctns,
                weight_per_ctn: weightPerCtn,
                total_weight: weight,
                material_description: $row.find('[data-field="materialDescription"]').val() || ''
            });

            $row.find('.total-material').text(materialBuy.toFixed(2));
            $row.find('.total-weight').text(weight > 0 ? weight.toFixed(2) : '');
        });

        // Update summary footer
        $detailRow.find('.total-material-without-vat').text(aed(totalMaterialNoVAT));
        $detailRow.find('.total-material-buy').text(aed(totalMaterialBuy));
        $detailRow.find('.total-vat').text(aed(totalVAT));
        $detailRow.find('.total-weight-kg').text(fmt(totalWeight));
        $detailRow.find('.total-units').text(fmt0(totalUnits));

        $detailRow.find('.shipping-cost-value').text(aed(shipping));
        $detailRow.find('.dgd-value').text(aed(dgd));
        $detailRow.find('.labour-value').text(aed(labour));
        $detailRow.find('.total-shipping-cost').text(aed(totalShippingCost));

        $headerRow.find('.header-total-material').text(aed(totalMaterialBuy));
        $headerRow.find('.header-total-shipping').text(aed(totalShippingCost));

        if (typeof updateOverallTotals === 'function') updateOverallTotals();
    });
}

function loadCustomerSheet(sheetId) {
    $.get(`/customer-sheet/load/${sheetId}`, function (entries) {
        const $tbody = $('#customerTableBody');
        $tbody.empty();

        entries.forEach((entry, index) => {
            const srNo = index + 1;
            const rowId = `customer-${Date.now()}-${srNo}`;

            // Header row
            const $headerRow = $(`
                <tr class="customer-header-row cursor-pointer hover:bg-gray-100" data-id="${rowId}" data-brief="${entry.description}" data-submitted="true">
                    <td class="border p-2 text-center">${srNo}</td>
                    <td class="border p-2">${entry.date}</td>
                    <td class="border p-2">${entry.supplier}</td>
                    <td class="border p-2">${entry.description}</td>
                    <td class="border p-2 header-total-material">AED ${entry.total_material_buy}</td>
                    <td class="border p-2 header-total-shipping">AED ${entry.total_shipping_cost}</td>
                    <td class="border p-2 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button class="edit-btn text-blue-600 hover:underline">Edit</button>
                            <button class="delete-btn text-red-600 hover:underline">Delete</button>
                        </div>
                    </td>
                </tr>
            `);

            $tbody.append($headerRow);

            // Detail rows
            entry.items.forEach(item => {
                const $detailRow = $(`
                    <tr class="customer-detail-row bg-gray-50 text-sm" data-parent="${rowId}">
                        <td class="border p-2 text-center"></td>
                        <td class="border p-2">${item.ctns}</td>
                        <td class="border p-2">${item.units}</td>
                        <td class="border p-2">${item.unit_price}</td>
                        <td class="border p-2">${item.vat}</td>
                        <td class="border p-2">${item.weight_per_ctn}</td>
                        <td class="border p-2">${item.total_material}</td>
                        <td class="border p-2">${item.total_weight}</td>
                        <td class="border p-2 text-center">–</td>
                    </tr>
                `);
                $tbody.append($detailRow);
            });
        });
    });
}

function formatCurrency(amount) {
    amount = parseFloat(amount) || 0;
    return 'AED ' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function updateOverallTotals() {
    const n = s => parseFloat((s || '').toString().replace(/[^\d.-]/g, '')) || 0;

    let grandTotalMaterial = 0;
    let grandTotalShipping = 0;

    $('#customerTableBody tr.customer-header-row').each(function () {
        const id = $(this).data('id'); // e.g., "customer-12"
        const $detail = $(`tr.detail-row[data-id="${id}"]`);

        // Read from the summary footer in the detail row
        grandTotalMaterial += n($detail.find('.total-material-buy').text());
        grandTotalShipping += n($detail.find('.total-shipping-cost').text());
    });

    // If your cards have a separate "AED" label, write only the number here
    $('#overallTotalMaterial').text(grandTotalMaterial.toFixed(2));
    $('#overallTotalShipping').text(grandTotalShipping.toFixed(2));
}

function createItemRow(sno = 1) {
    return `
    <tr class="item-row bg-yellow-100">
        <td class="border p-1 text-center w-5">${sno}</td>

        <td class="border p-1 w-64 relative">
            <textarea placeholder="Description" data-field="description" rows="1"
                class="material-input editable-input w-full rounded px-1 py-0.5 align-middle bg-white border border-gray-300 focus:outline-none resize-none overflow-hidden whitespace-pre-wrap break-words"></textarea>
        </td>

        <td class="border p-1 w-24 relative">
            <input type="number" placeholder="0" data-field="units"
                class="material-input editable-input w-full rounded px-1 py-0.5 bg-white border border-gray-300 focus:outline-none" />
        </td>

        <td class="border p-1 w-40 relative">
            <input type="number" placeholder="0" data-field="unitPrice"
                class="material-input editable-input w-full rounded px-1 py-0.5 bg-white border border-gray-300 focus:outline-none" />
        </td>

        <td class="border p-1 w-20 relative">
            <input type="number" placeholder="0" data-field="vat"
                class="material-input editable-input w-full rounded px-1 py-0.5 bg-white border border-gray-300 focus:outline-none" />
        </td>

        <td class="border p-1 total-material w-40">0</td>

        <td class="border p-1 w-32 relative">
            <input type="number" placeholder="0" data-field="weightPerCtn"
                class="material-input editable-input w-full rounded px-1 py-0.5 bg-white border border-gray-300 focus:outline-none" />
        </td>

        <td class="border p-1 w-24 relative">
            <input type="number" placeholder="0" data-field="ctns"
                class="material-input editable-input w-full rounded px-1 py-0.5 bg-white border border-gray-300 focus:outline-none" />
        </td>

        <td class="border p-1 total-weight w-32">0</td>

        <td class="border p-1 text-center">
            <button class="delete-item-btn text-red-500 hover:text-red-700">&times;</button>
        </td>
    </tr>`;
}

let isRendering = false;

function loadCustomerSheetData(sheetId) {
    if (isRendering) return;
    isRendering = true;

    $.get(`/customer-sheet/load/${sheetId}`)
        .done(res => {
            if (res.status === 'success') {
                renderCustomerSheetRows(sheetId, res.data || []);

                // Update totals immediately after rows are rendered
                if (res.totals) {
                    const t = res.totals;
                    $(`#totalMaterial-${sheetId}`).text(aed(t.material));
                    $(`#totalShipping-${sheetId}`).text(aed(t.shipping));
                    $(document).trigger('customerSheets:totalsUpdated');

                    // cards below
                    $(`#totalLoanPaid-${sheetId}`).text(aed(t.loan_paid));
                    $(`#sheetTotal-${sheetId}`).text(aed(t.sheet_total));
                    $(`#remainingBalance-${sheetId}`).text(aed(t.remaining_balance));
                }
            } else {
                console.error('Failed to load data', res);
            }
        })
        .fail(err => {
            console.error('Error fetching data:', err.responseJSON || err.responseText || err);
        })
        .always(() => {
            isRendering = false;
        });
}

$(function () {
    const active = localStorage.getItem('activeSheet') || 'summary';
    const $btn = $(`.sheet-tab[data-sheet="${active}"]`);
    if ($btn.length) $btn.trigger('click');
    else $('.sheet-tab').first().trigger('click');
});

function renderCustomerSheetRows(sheetId, entries) {
    const tbody = $(`#customerTableBody-${sheetId}`);
    tbody.empty();

    let serial = 1;
    let sumMaterial = 0;
    let sumShipping = 0;

    entries.forEach(entry => {
        const rowId = `customer-${entry.id}`;
        const serialNumber = serial++;

        const mat = Number(entry.total_material_buy || 0);
        const ship = Number(entry.total_shipping_cost || 0);
        sumMaterial += mat;
        sumShipping += ship;

        const itemsTotalWeight = (entry.items || []).reduce((sum, it) => {
            return sum + (parseFloat(it.total_weight) || 0);
        }, 0);

        const mode = entry.mode_of_transaction || '';
        const receipt = entry.receipt_no || '';
        const remarks = entry.remarks || '';

        // Build item rows
        let itemsHTML = '';
        if (entry.items && entry.items.length > 0) {
            entry.items.forEach((item, i) => {
                const units = parseFloat(item.units || 0);
                const unitPrice = parseFloat(item.unit_price || 0);
                const weightPerCtn = parseFloat(item.weight_per_ctn || 0);
                const ctns = parseFloat(item.ctns || 0);

                itemsHTML += `
                    <tr class="item-row text-center">
                        <td class="border p-1">${i + 1}</td>
                        <td class="border p-1">${item.description || ''}</td>
                        <td class="border p-1">${units}</td>
                        <td class="border p-1">${unitPrice.toFixed(2)}</td>
                        <td class="border p-1">${item.vat || '0%'}</td>
                        <td class="border p-1">${(units * unitPrice).toFixed(2)}</td>
                        <td class="border p-1">${weightPerCtn}</td>
                        <td class="border p-1">${ctns}</td>
                        <td class="border p-1">${(weightPerCtn * ctns).toFixed(2)}</td>
                    </tr>
                `;
            });
        } else {
            itemsHTML = `
                <tr>
                    <td colspan="9" class="text-center text-gray-400">No items found</td>
                </tr>
            `;
        }

        const actionCell = `
        <td class="border p-2">
            <div class="flex items-center justify-center gap-2">
            <button class="save-changes-btn hidden text-green-600 hover:text-green-800"
                    data-id="${entry.id}" title="Save">
                <i class="bi bi-check2-circle text-lg"></i>
            </button>

            <!-- Upload -->
            <button type="button"
                    class="btn-upload-attachments inline-flex items-center justify-center
                            w-9 h-9 rounded-lg border border-gray-300 hover:bg-gray-50"
                    data-entry-id="${entry.id}" data-sheet-id="${entry.customer_sheet_id}" title="Upload Attachments">
                <i class="bi bi-upload text-base"></i>
            </button>

            <!-- View -->
            <button type="button"
                class="btn-view-attachments relative inline-flex items-center justify-center w-9 h-9 rounded-lg border hover:bg-gray-50"
                data-entry-id="${entry.id}" data-sheet-id="${entry.customer_sheet_id}" title="View Attachments">
                <i class="bi bi-paperclip text-base"></i>
                <span class="att-count absolute -top-1 -right-1 text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-gray-800 text-white"
                        id="att-count-${entry.customer_sheet_id}-${entry.id}">0</span>
            </button>

            <button class="delete-btn text-red-600 hover:text-red-800"
                    data-id="${entry.id}" title="Delete Entry">
                <i class="bi bi-trash text-lg"></i>
            </button>
            </div>
        </td>`;

        // Create header row
        const $headerRow = $(`
            <tr class="customer-header-row cursor-pointer hover:bg-gray-100" data-id="${rowId}" data-entry-id="${entry.id}" data-sheet-id="${entry.customer_sheet_id}" data-date="${entry.date}" data-supplier="${entry.supplier || ''}" data-description="${(entry.description || '').replace(/"/g, '&quot;')}">
                <td class="border p-2 text-center">${serialNumber}</td>
                <td class="border p-2">${formatDateToWords(entry.date)}</td>
                <td class="border p-2">${entry.supplier || ''}</td>
                <td class="border p-2">${entry.description || ''}</td>
                <td class="border p-2 header-total-material">${aed(entry.total_material_buy)}</td>
                <td class="border p-2 header-total-shipping">${aed(entry.total_shipping_cost)}</td>
                ${actionCell}
            </tr>
        `);

        // Create detail row with dynamic item table
        const $detailRow = $(`
            <tr class="detail-row relative hidden" data-new="true" data-id="${rowId}">
                <td colspan="7" class="p-2 bg-gray-50">
                    <div class="text-center font-bold text-xl mb-4 bg-blue-200 p-2">${entry.supplier}</div>
                    <div class="flex justify-center">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-16 w-full max-w-5xl mx-auto">
                            <!-- Summary Left -->
                            <div class="space-y-2 border-4 border-zinc-500 p-5 bg-white">
                                <div class="flex items-start gap-2"><span class="font-semibold w-56">Total Weight (KG):</span><div class="flex-1 text-gray-700 total-weight-kg">${fmt0(itemsTotalWeight)}</div></div>
                                <div class="flex items-start gap-2"><span class="font-semibold w-56">Total No. of Units:</span><div class="flex-1 text-gray-700 total-units">${fmt0(entry.total_units || 0)}</div></div>
                                <div class="flex items-start gap-2"><span class="font-semibold w-56">DGD:</span><div class="flex-1 text-gray-700 dgd-value">${aed(entry.dgd || 0)}</div></div>
                                <div class="flex items-start gap-2"><span class="font-semibold w-56">Labour Charges:</span><div class="flex-1 text-gray-700 labour-value">${aed(entry.labour || 0)}</div></div>
                                <div class="flex items-start gap-2"><span class="font-semibold w-56">Shipping Cost:</span><div class="flex-1 text-gray-700 shipping-cost-value">${aed(entry.total_shipping_cost || 0)}</div></div>
                            </div>
                            <!-- Summary Right -->
                            <div class="space-y-2 border-4 border-zinc-500 p-5 bg-white">
                                <div class="flex items-start gap-2"><span class="font-semibold w-56">Mode of Transaction:</span><input type="text" name="mode_of_transaction" class="flex-1 editable-input w-full rounded px-2 py-1 bg-white border border-gray-300 mode-of-transaction-input" placeholder="Enter Transaction Method" value="${mode}" /></div>
                                <div class="flex items-start gap-2"><span class="font-semibold w-56">Receipt No:</span><textarea name="receipt_no" class="flex-1 dynamic-textarea w-full rounded px-2 py-1 bg-white border border-gray-300 resize-none overflow-hidden receipt-no-input" placeholder="Enter receipt numbers">${receipt}</textarea></div>
                                <div class="flex items-start gap-2"><span class="font-semibold w-56">Remarks:</span><textarea name="remarks" class="flex-1 dynamic-textarea w-full rounded px-2 py-1 bg-white border border-gray-300 resize-none overflow-hidden remarks-input" placeholder="Enter Remarks">${remarks}</textarea></div>
                            </div>
                        </div>
                    </div>

                    <!-- Items Table -->
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
                            <tbody id="itemTableBody-${rowId}">
                                ${itemsHTML}
                            </tbody>
                        </table>
                    </div>

                    <!-- Summary Footer -->
                    <div class="mt-4 border-4 border-zinc-500 bg-white">
                        <div class="grid grid-cols-2 divide-x divide-gray-300">
                            <div class="flex items-center border-b p-2 font-semibold w-full">Total Material w/out VAT:</div>
                            <div class="flex items-center gap-1 border-b p-2 w-full bg-yellow-100">
                            <span>AED</span>
                            <span class="total-material-without-vat">
                                ${fmt(entry.total_material_without_vat || 0)}
                            </span>
                            </div>
                            <div class="flex items-center border-b p-2 font-semibold w-full">Total VAT:</div>
                            <div class="flex items-center border-b p-2 w-full bg-yellow-100 total-vat">
                                ${aed(entry.total_vat || 0)}
                            </div>
                            <div class="flex items-center border-b p-2 font-semibold w-full">Total Material Buy:</div>
                            <div class="flex items-center border-b p-2 w-full bg-yellow-100 total-material-buy">
                                ${aed(entry.total_material_buy || 0)}
                            </div>

                            <!-- Shipping Cost -->
                            <div class="flex items-center border-b p-2 font-semibold w-full">Shipping Cost:</div>
                            <div class="flex items-center gap-1 border-b p-2 w-full bg-yellow-100">
                            <span class="font-medium">AED</span>
                            <input
                                type="number" min="0" step="0.01"
                                class="shipping-input w-full bg-yellow-100 border-0 focus:outline-none"
                                value="${num(entry.shipping_cost ?? 0).toFixed(2)}"
                            />
                            </div>

                            <!-- DGD -->
                            <div class="flex items-center border-b p-2 font-semibold w-full">DGD:</div>
                            <div class="flex items-center gap-1 border-b p-2 w-full bg-yellow-100">
                            <span class="font-medium">AED</span>
                            <input
                                type="number" min="0" step="0.01"
                                class="dgd-input w-full bg-yellow-100 border-0 focus:outline-none"
                                value="${num(entry.dgd ?? 0).toFixed(2)}"
                            />
                            </div>

                            <!-- Labour -->
                            <div class="flex items-center border-b p-2 font-semibold w-full">Labour:</div>
                            <div class="flex items-center gap-1 border-b p-2 w-full bg-yellow-100">
                            <span class="font-medium">AED</span>
                            <input
                                type="number" min="0" step="0.01"
                                class="labour-input w-full bg-yellow-100 border-0 focus:outline-none"
                                value="${num(entry.labour ?? 0).toFixed(2)}"
                            />
                            </div>

                            <!-- Total Shipping Cost (display only) -->
                            <div class="flex items-center p-2 font-semibold w-full">Total Shipping Cost:</div>
                            <div class="flex items-center gap-1 p-2 w-full bg-yellow-100">
                            <span>AED</span>
                            <span class="total-shipping-cost">${fmt(num(entry.total_shipping_cost) ||
            (num(entry.dgd) + num(entry.labour) + num(entry.shipping_cost)))
            }
                            </span>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `);

        // Summary Right originals
        $detailRow.find('input[name="mode_of_transaction"]')
            .prop('readonly', false)
            .each(function () { $(this).data('orig', $(this).val() || ''); });

        $detailRow.find('[name="receipt_no"], [name="remarks"]')
            .prop('readonly', false)
            .each(function () { $(this).data('orig', $(this).val() || ''); });

        // ADD THIS: seed originals for cost inputs
        $detailRow.find('.dgd-input, .labour-input, .shipping-input')
            .each(function () { $(this).data('orig', $(this).val() || '0'); });

        // Convert item table cells to inputs immediately (if not already)
        $detailRow.find('tr.item-row').each(function () {
            const $row = $(this);
            if ($row.data('editable')) return;

            const td = (i) => $row.find(`td:nth-child(${i})`);

            const desc = td(2).text().trim();
            const units = parseFloat(td(3).text()) || 0;
            const unitPrice = parseFloat(td(4).text()) || 0;
            const vat = parseFloat((td(5).text() || '').replace('%', '')) || 0;
            const weightPerCtn = parseFloat(td(7).text()) || 0;
            const ctns = parseFloat(td(8).text()) || 0;

            td(2).html(`<input data-field="description" class="w-full border px-2 py-1" value="${desc}">`);
            td(3).html(`<input data-field="units" class="w-24 border px-2 py-1 text-right" type="number" step="1" value="${units}">`);
            td(4).html(`<input data-field="unitPrice" class="w-24 border px-2 py-1 text-right" type="number" step="0.01" value="${unitPrice}">`);
            td(5).html(`<input data-field="vat" class="w-20 border px-2 py-1 text-right" type="number" step="0.01" value="${vat}">`);
            td(7).html(`<input data-field="weightPerCtn" class="w-24 border px-2 py-1 text-right" type="number" step="0.01" value="${weightPerCtn}">`);
            td(8).html(`<input data-field="ctns" class="w-24 border px-2 py-1 text-right" type="number" step="1" value="${ctns}">`);

            td(6).html(`<span class="total-material">${fmt(units * unitPrice)}</span>`);
            td(9).html(`<span class="total-weight">${fmt(weightPerCtn * ctns)}</span>`);

            // store originals
            $row.find('input').each(function () { $(this).data('orig', $(this).val() || ''); });

            $row.data('editable', true);
        });

        tbody.append($headerRow).append($detailRow);

        refreshAttachmentCount(entry.id, entry.customer_sheet_id);

        initAlwaysEditable($detailRow, $headerRow);

        $headerRow.on('click', () => {
            $detailRow.toggleClass('hidden');
        });
    });

    // set this sheet's top totals
    $(`#totalMaterial-${sheetId}`).text(formatCurrency(sumMaterial));
    $(`#totalShipping-${sheetId}`).text(formatCurrency(sumShipping));
}

function initAlwaysEditable($detailRow, $headerRow) {
    // recalc as you type
    if (typeof bindLiveCalculation === 'function') {
        bindLiveCalculation($detailRow, $headerRow);
    }

    const $saveBtn = $headerRow.find('.save-changes-btn');

    // On any input change, update totals and toggle Save button based on dirty state
    $detailRow.on('input change', 'input, textarea', function () {
        const dirty = isRowDirty($detailRow);
        if (dirty) $saveBtn.removeClass('hidden');
        else $saveBtn.addClass('hidden');
    });

    // Initial state (should be clean)
    $saveBtn.addClass('hidden');
}

// Compare current values vs originals
function isRowDirty($detailRow) {
    let dirty = false;
    const n = v => parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;
    const numEq = (a, b) => Math.abs(n(a) - n(b)) < 1e-6;

    // Summary-right inputs/textarea
    $detailRow.find('input[name="mode_of_transaction"], [name="receipt_no"], textarea[name="remarks"]')
        .each(function () {
            const cur = (($(this).val() || '') + '').trim();
            const orig = (($(this).data('orig') || '') + '').trim();
            if (cur !== orig) { dirty = true; return false; }
        });
    if (dirty) return true;

    // Item inputs
    $detailRow.find('tr.item-row input[data-field]').each(function () {
        const cur = (($(this).val() || '') + '').trim();
        const orig = (($(this).data('orig') || '') + '').trim();
        if (cur !== orig) { dirty = true; return false; }
    });
    if (dirty) return true;

    // numeric compare for cost inputs
    $detailRow.find('.dgd-input, .labour-input, .shipping-input').each(function () {
        const orig = $(this).data('orig');
        if (orig === undefined) $(this).data('orig', $(this).val() || '0'); // lazy-seed
        if (!numEq($(this).val(), orig)) { dirty = true; return false; }
    });

    return dirty;
}

function calculateTotalMaterialAndShipping() {
    let totalMaterial = 0;
    let totalShipping = 0;

    $('#customerTableBody tr.customer-header-row').each(function () {
        const material = parseFloat($(this).find('.header-total-material').text().replace('AED', '').trim()) || 0;
        const shipping = parseFloat($(this).find('.header-total-shipping').text().replace('AED', '').trim()) || 0;

        totalMaterial += material;
        totalShipping += shipping;
    });

    $('#totalMaterial').text(`AED ${totalMaterial.toFixed(2)}`);
    $('#totalShipping').text(`AED ${totalShipping.toFixed(2)}`);
}

function formatDateToWords(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
}

// ------- Loan Ledger Helpers -------
function loanRoute(tpl, params = {}) {
    // sane defaults so .replace never runs on undefined
    tpl = tpl || '/customer-sheet/:sheetId/loan-ledger';
    return tpl
        .replace(':sheetId', params.sheetId ?? '')
        .replace(':id', params.id ?? '');
}

function loadLoanLedger(sheetId, after) {
    const tpl = (window.routes && window.routes.loanLedgerIndex)
        || '/customer-sheet/:sheetId/loan-ledger';

    $.get(loanRoute(tpl, { sheetId }))
        .done(res => {
            renderLoanLedgerRows(res.data || [], sheetId);
            if (typeof updateLoanLedgerTotals === 'function') {
                const sheetName = $('#headerTitle').text().replace('Customer Sheet: ', '');
                updateLoanLedgerTotals(sheetId, sheetName);
            }
            $(document).trigger('loanLedger:updated');
            if (typeof after === 'function') after();
        })
        .fail(err => {
            console.error('Loan ledger load failed', err);
            $(`#loanLedgerBody-${sheetId}`).html(
                `<tr><td colspan="5" class="px-4 py-3 text-red-600">Failed to load ledger.</td></tr>`
            );
        });
}

function updateLoanLedgerTotals(sheetId, sheetName) {
    // A) loan total from ledger footer (already per-sheet)
    const loanPaid = num($(`#loanLedgerTotal-${sheetId}`).text());

    // B) sheet totals for THIS sheet
    const totalMaterial = num($(`#totalMaterial-${sheetId}`).text());
    const totalShipping = num($(`#totalShipping-${sheetId}`).text());

    const sheetTotal = totalMaterial + totalShipping;
    const remaining = loanPaid - sheetTotal;

    $(`#totalLoanPaid-${sheetId}`).text(aed(loanPaid));
    $(`#sheetTotalAmount-${sheetId}`).text(aed(sheetTotal));
    $(`#remainingBalance-${sheetId}`).text(aed(remaining));
}

function renderLoanLedgerRows(rows, sheetId) {
    const $body = $(`#loanLedgerBody-${sheetId}`);
    $body.empty();

    let total = 0;
    rows.forEach((r, i) => {
        const amt = Number(r.amount || 0);
        total += amt;

        const formattedDate = formatFullDate(r.date);

        $body.append(`
        <tr class="border-t" data-loan-id="${r.id}" data-sheet-id="${sheetId}" data-loan-date="${r.date}" data-loan-amount="${amt}">
            <td class="border p-2">${i + 1}</td>
            <td class="border p-2 whitespace-nowrap">${formattedDate}</td>
            <td class="border p-2">${escapeHtml(r.description || '')}</td>
            <td class="border p-2 text-right">${aed(amt)}</td>
            <td class="border p-2 text-center">
                <button class="loan-edit text-green-600 hover:text-green-800 has-tip mr-2"
                        data-tippy-content="Edit Entry">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="loan-delete text-red-600 hover:text-red-800 has-tip"
                        data-tippy-content="Delete Entry">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
        `);
    });

    $(`#loanLedgerTotal-${sheetId}`).text(aed(total));
    initTooltips();
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[m]);
}

function initTooltips() {
    if (!window.tippy) return;
    // Optional: destroy old instances to avoid duplicates
    if (window._loanTips) window._loanTips.forEach(i => i.destroy());
    window._loanTips = tippy('.has-tip', {
        appendTo: () => document.body,
        placement: 'top',
        theme: 'light',
        animation: 'shift-away',
        offset: [0, 6],
        zIndex: 9999
    });
}

function formatFullDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function getAllCustomerSheetTotals() {
    let material = 0, shipping = 0;

    $('[id^="totalMaterial-"]').each(function () {
        material += parseFloat($(this).text().replace(/[^\d.-]/g, '')) || 0;
    });
    $('[id^="totalShipping-"]').each(function () {
        shipping += parseFloat($(this).text().replace(/[^\d.-]/g, '')) || 0;
    });

    return { material, shipping };
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

// helpers to build a tab + inject the sheet section HTML ---
function slugifyCustomerName(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Injects the rendered Blade HTML for a sheet’s section,
 * appends a tab button, and switches to it.
 * Call with: addCustomerSheetUI({ id, name });
 */
function addCustomerSheetUI({ id, name }) {
    if (!id || !name) return;

    const slug = slugifyCustomerName(name);
    const key = `customer-${slug}`;          // data-sheet, used by the tab click handler in sheet.js
    const secId = `sheet-customer-${slug}`;    // DOM id for the section container

    // 1) Add a tab button at the bottom (you already have this container)
    $('#customerTabsContainer').append(
        `<button class="sheet-tab px-4 py-2 text-sm font-medium hover:bg-gray-100"
             data-sheet="${key}" data-sheet-id="${id}">
       ${name}
     </button>`
    );

    // 2) Fetch rendered section HTML (controller method: section())
    $.get(`customer-sheet/section/${id}`)
        .done(function (html) {
            // Remove any previous node with same id (defensive)
            $('#' + secId).remove();

            const $node = $(html);
            // ensure it has a stable id and the sheet-section class
            if (!$node.attr('id')) $node.attr('id', secId);
            $node.addClass('sheet-section hidden');

            // Inject into the main container where your sections live
            $('#sheetContainer').append($node);

            // 3) Switch to the new tab to let your existing .sheet-tab handler
            // set the header and kick off loaders (loadCustomerSheetData, loadLoanLedger)
            $(`.sheet-tab[data-sheet="${key}"]`).trigger('click');
        });
}

// Optional: expose to other scripts (summary page can call it directly)
window.addCustomerSheetUI = addCustomerSheetUI;
