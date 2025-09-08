$(function () {
  fetchAndUpdateInvestmentTotal();
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
    const parsedDate = new Date(rawDate);
    const options = { weekday: "long", day: "2-digit", month: "long", year: "numeric" };
    const invoiceDate = parsedDate.toLocaleDateString("en-GB", options);

    const invoiceNo = $("#modalInvoiceNo").val().trim();
    const supplierName = $modalSupplierName.val().trim();
    const description = $modalDescription.val().trim();
    const serialNumber = $("#materialTableBody .header-row").length + 1;

    // Hide modal
    $("#addRowModal").addClass("hidden").removeClass("flex");

    // Create header row
    const $headerRow = $(`
      <tr class="header-row cursor-pointer hover:bg-gray-100" data-brief="${description}" data-submitted="false" data-new="true">
        <td class="border p-2 text-center">${serialNumber}</td>
        <td class="border p-2">${invoiceDate}</td>
        <td class="border p-2">${invoiceNo || ''}</td>
        <td class="border p-2">${supplierName}</td>
        <td class="border p-2">${description}</td>
        <td class="border p-2 header-total-material">AED 0</td>
        <td class="border p-2 header-total-shipping">AED 0</td>
        <td class="border p-2 text-center">
          <div class="flex items-center justify-center gap-1">
            <button class="submit-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded">Submit</button>
            <button class="remove-row bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded">Delete</button>
          </div>
        </td>
      </tr>
    `);

    // Create detail row
    const $detailRow = $(`
      <tr class="detail-row relative hidden item-row" data-new="true">
        <td colspan="8" class="p-2 bg-gray-50">
        <div class="text-center font-bold text-xl mb-4 bg-blue-200 p-2">${supplierName}</div>

          <div class="flex justify-center">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-16 w-full max-w-5xl mx-auto">
              <!-- Left Section -->
              <div class="space-y-2 border-4 border-zinc-500 p-5 bg-white">
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Invoice No:</span> <div class="flex-1 text-gray-700">${invoiceNo}</div></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Total Weight (KG):</span> <div class="flex-1 text-gray-700 total-weight-kg">0</div></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Total No. of Units:</span> <div class="flex-1 text-gray-700 total-units">0</div></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">DGD:</span> <div class="flex-1 text-gray-700 dgd-value">AED</div></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Labour Charges:</span> <div class="flex-1 text-gray-700 labour-value">AED</div></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Shipping Cost:</span> <div class="flex-1 text-gray-700 shipping-cost-value">0</div></div>
              </div>
              <!-- Right Section -->
              <div class="space-y-2 border-4 border-zinc-500 p-5 bg-white">
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Mode of Transaction:</span> <input type="text" placeholder="Enter Transaction Method" class="flex-1 editable-input w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none" /></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Receipt No:</span> <textarea placeholder="Enter receipt numbers" class="flex-1 dynamic-textarea w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none resize-none overflow-hidden"></textarea></div>
                <div class="flex items-start gap-2"><span class="font-semibold w-56">Remarks:</span> <textarea placeholder="Enter Remarks" class="flex-1 dynamic-textarea w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none resize-none overflow-hidden"></textarea></div>
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
              <tbody id="itemTableBody">
                <!-- Rows added here -->
              </tbody>
            </table>

            <button id="addItemRowBtn" class="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">+ Add More Items</button>
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
    const $itemTableBody = $detailRow.find("#itemTableBody");
    const nextSerial = 1;
    const firstRow = $("#itemRowTemplate").html().replace(/__SNO__/g, nextSerial);
    $itemTableBody.append(firstRow);

    // Reset & initialize all values inside this detail row
    $detailRow.find("input, textarea").val("");
    $detailRow.find(".total-weight-kg, .total-vat, .total-material-buy, .total-material-without-vat, .total-shipping-cost").text("AED 0");
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

  // Also handle on blur (in case user tabs out)
  $(document).on("blur", ".dynamic-textarea", function () {
    const $textarea = $(this);

    // Remove all edit styles and revert to plain display
    $textarea.css({
      "border": "none",
      "background": "transparent",
      "outline": "none",
      "box-shadow": "none",
      "resize": "none",
      "overflow": "hidden",
      "height": "auto",
      "max-height": "none"
    });

    // Optional: trim value to remove white space growth
    $textarea.val($textarea.val().trim());
  });

  $(document).on("focus", "input, textarea", function () {
    $(this).css({
      "border": "",
      "background": "",
      "outline": "",
      "box-shadow": "",
      "resize": "",
      "overflow": "",
      "height": "",
      "max-height": ""
    });
  });

  // Bind Live Updates handler, it updates instantly while typing
  $(document).on("input", ".material-input, .shipping-input", function () {
    $(".detail-row").each(function () {
      const $detailRow = $(this);
      const $headerRow = $detailRow.prev(".header-row");
      calculateRowTotals($detailRow, $headerRow);
    });
    updateGtsTotalsFromDOM();
  });

  // Ensure summary-footer inputs (shipping/dgd/labour) also toggle the Update button
  $(document).on('input change', '.detail-row .shipping-input', function () {
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

  // For Item Table row adding
  $(document).on("click", "#addItemRowBtn", function () {
    const $detailRow = $(this).closest(".detail-row");
    const $headerRow = $detailRow.prev(".header-row");

    // Get the correct table body in this detail section
    const $tbody = $detailRow.find("#itemTableBody");

    // Get the last S.No from the last row
    const lastRow = $tbody.find("tr:last-child");
    let nextSerial = 1;

    if (lastRow.length) {
      const lastSno = parseInt(lastRow.find("td:first").text(), 10);
      if (!isNaN(lastSno)) {
        nextSerial = lastSno + 1;
      }
    }

    // Replace the serial in the template
    const $newRow = $($("#itemRowTemplate").html().replace("__SNO__", nextSerial));
    $newRow.attr("data-new", "true"); // Mark row as new

    $tbody.append($newRow);

    // Mark detail row as dirty
    $detailRow.data("dirty", true);

    // Recalculate row + overall totals
    $(".detail-row").each(function () {
      const $row = $(this);
      const $header = $row.prev(".header-row");
      calculateRowTotals($row, $header);
    });
    updateGtsTotalsFromDOM();

    // Now, after everything: re-check if update button should show
    toggleUpdateButtonForDetail($detailRow);
  });

  $(document).on("click", ".remove-row", function () {
    const $row = $(this).closest("tr");
    $row.remove();

    // Recalculate all detail rows
    $(".detail-row").each(function () {
      const $detailRow = $(this);
      const $headerRow = $detailRow.prev(".header-row");
      calculateRowTotals($detailRow, $headerRow);
    });

    updateGtsTotalsFromDOM();
    renumberRows();
  });

  function renumberRows() {
    $("#itemTableBody tr").each(function (index) {
      $(this).find("td:first").text(index + 1);
    });
  }

  $(document).on("click", ".header-row", function (e) {
    // Prevent toggle if clicking on a button or link inside the row
    if ($(e.target).is("button") || $(e.target).closest("button").length || $(e.target).is("a")) return;

    $(".detail-row").not($(this).next()).hide();
    $(this).next(".detail-row").toggle();
  });

  $(document).on("click", ".submit-btn", function () {
    const $headerRow = $(this).closest("tr");
    const $detailRow = $headerRow.next(".detail-row");

    // Extract header fields
    const invoiceDate = $headerRow.find("td").eq(1).text().trim();
    const invoiceNo = $headerRow.find("td").eq(2).text().trim();
    const supplierName = $headerRow.find("td").eq(3).text().trim();
    const briefDescription = $headerRow.data("brief");
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
      invoice_date: invoiceDate,
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
      url: "/gts-materials",
      method: "POST",
      data: data,
      headers: {
        "X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr("content")
      },
      success: function (response) {
        // Assign the ID to the row
        $headerRow.attr("data-id", response.id);
        const id = $headerRow.data("id");

        // Mark the detail row as submitted
        $detailRow.addClass("submitted");

        // Replace action cell content with Delete button only
        $headerRow.find("td:last").html(`
          <button class="delete-material-btn bg-red-500 text-white px-2 py-1 rounded ml-2">Delete</button>
       `);

        updateGtsTotalsFromDOM();
        fetchAndUpdateInvestmentTotal();
      },
      error: function (xhr) {
        console.error("Error saving material:", xhr.responseText);
        alert("Failed to save. See console for details.");
      }
    });
  });

  // Update material row from action column
  $(document).on("click", ".update-material-btn", function () {
    const $headerRow = $(this).closest("tr.header-row");
    const $detailRow = $headerRow.next(".detail-row");
    const id = $headerRow.data("id");

    if (!id) {
      alert("Row ID missing, cannot update.");
      return;
    }

    // Current snapshot
    const prevSnap = $detailRow.data("snapshot") || {};
    const newSnap = buildMaterialSnapshot($detailRow);

    // Compare snapshots
    if (JSON.stringify(prevSnap) === JSON.stringify(newSnap)) {
      // nothing to save; keep button hidden anyway
      return;
    }

    // Build payload
    const data = {
      mode_of_transaction: newSnap.mot,
      receipt_no: newSnap.receipt,
      remarks: newSnap.remarks,
      shipping_cost: newSnap.shipping,
      dgd: newSnap.dgd,
      labour: newSnap.labour,
      materials: newSnap.items
    };

    $.ajax({
      url: `/gts-materials/${id}`,
      method: "PUT",
      headers: { "X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr("content") },
      data: data,
      success: function () {
        // refresh snapshot and hide button
        $detailRow.data("snapshot", newSnap);
        toggleUpdateButtonForDetail($detailRow);

        // green flash
        $detailRow.find("input, textarea").removeClass("field-changed").addClass("bg-green-100");
        setTimeout(() => $detailRow.find("input, textarea").removeClass("bg-green-100"), 1000);

        alert("Row updated successfully.");
      },
      error: function (xhr) {
        console.error(xhr.responseText);
        alert("Failed to update row.");
      }
    });
  });

  let deleteTargetHeader = null;
  let deleteTargetDetail = null;
  let deleteTargetId = null;

  $(document).on("click", ".delete-material-btn", function () {
    deleteTargetHeader = $(this).closest("tr");
    deleteTargetDetail = deleteTargetHeader.next(".detail-row");
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
    if (!deleteTargetId || !deleteTargetHeader || !deleteTargetDetail) return;

    $.ajax({
      url: "/gts-materials/" + deleteTargetId,
      method: 'DELETE',
      headers: {
        "X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr("content")
      },
      success: function () {
        deleteTargetHeader.remove();
        deleteTargetDetail.remove();

        reindexSerialNumbers();
        updateGtsTotalsFromDOM();

        $("#deleteConfirmModal").addClass("hidden").removeClass("flex");
        updateGtsTotalsFromDOM();
        fetchAndUpdateInvestmentTotal();
      },
      error: function (xhr) {
        console.error(xhr.responseText);
        alert("Failed to delete. See console for details.");
      }
    });
  });

  let $rowToDelete = null; // temp store clicked row

  $(document).on("click", ".delete-item-btn", function () {
    $rowToDelete = $(this).closest("tr");
    const itemId = $rowToDelete.data("item-id");

    if (itemId) {
      // Show confirmation modal only for saved items
      $("#confirmItemDeleteModal").removeClass("hidden flex").addClass("flex");
    } else {
      // Just remove from DOM if unsaved
      $rowToDelete.remove();

      // Re-check if update button is needed
      const $detailRow = $rowToDelete.closest('.detail-row');
      toggleUpdateButtonForDetail($detailRow);
    }
  });

  $("#confirmItemDeleteBtn").on("click", function () {
    const itemId = $rowToDelete.data("item-id");

    if (!itemId) return;

    $.ajax({
      url: `/gts-materials/items/${itemId}`,
      method: "DELETE",
      headers: {
        "X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr("content")
      },
      success: function () {
        $rowToDelete.remove();
        $("#confirmItemDeleteModal").addClass("hidden");

        // Re-check after deletion
        const $detailRow = $rowToDelete.closest('.detail-row');
        toggleUpdateButtonForDetail($detailRow);

        $rowToDelete = null;
      },
      error: function (xhr) {
        alert("Failed to delete item. See console for details.");
        console.error(xhr.responseText);
      }
    });
  });

  $("#cancelItemDeleteBtn").on("click", function () {
    $("#confirmItemDeleteModal").addClass("hidden");
    $rowToDelete = null;
  });

  // Upload Click
  $(document).on('click', '.upload-btn', function () {
    const id = $(this).data('id');
    $('#gtsAttachRowId').val(id);
    $('#gtsAttachmentForm')[0].reset();
    $('#gtsAttachmentForm').data('mode', 'upload');
    $('#gtsAttachmentForm button[type="submit"]').text('Save');

    $('#gtsAttachInvoiceFilename').text('No file chosen');
    $('#gtsAttachReceiptFilename').text('No file chosen');
    $('#gtsAttachNoteFilename').text('No file chosen');

    let hasExisting = false;

    $.get(`/gts-materials/get-attachments/${id}`, function (data) {
      if (data.invoice) {
        $('#gtsAttachInvoiceFilename').text(data.invoice.split('/').pop());
        $('#gtsAttachInvoiceStatus').removeClass('hidden');
        hasExisting = true;
      } else {
        $('#gtsAttachInvoiceStatus').addClass('hidden');
      }
      if (data.receipt) {
        $('#gtsAttachReceiptFilename').text(data.receipt.split('/').pop());
        $('#gtsAttachReceiptStatus').removeClass('hidden');
        hasExisting = true;
      } else {
        $('#gtsAttachReceiptStatus').addClass('hidden');
      }
      if (data.note) {
        $('#gtsAttachNoteFilename').text(data.note.split('/').pop());
        $('#gtsAttachNoteStatus').removeClass('hidden');
        hasExisting = true;
      } else {
        $('#gtsAttachNoteStatus').addClass('hidden');
      }

      if (hasExisting) {
        $('#gtsAttachmentForm').data('mode', 'update');
        $('#gtsAttachmentForm button[type="submit"]').text('Update');
      }

      $('#gtsAttachmentModal').removeClass('hidden').addClass('flex');
    });
  });

  $('#gtsModalCloseBtn, #gtsCancelBtn').on('click', function () {
    $('#gtsAttachmentModal').removeClass('flex').addClass('hidden');
  });

  // View Click
  $(document).on('click', '.view-btn', function () {
    const row = $(this).closest('tr');
    const id = row.data('id');
    const invoiceNo = row.find('td:nth-child(3)').text().trim(); // Invoice No
    const supplier = row.find('td:nth-child(4)').text().trim(); // Supplier Name

    // Set modal title
    $('#attachmentViewerTitle').text(`Invoice: ${invoiceNo} – ${supplier}`);

    // Reset UI
    const $inv = $("#viewInvoiceLink");
    const $rec = $("#viewReceiptLink");
    const $note = $("#viewNoteLink");

    const $invName = $("#viewInvoiceName");
    const $recName = $("#viewReceiptName");
    const $noteName = $("#viewNoteName");

    [$inv, $rec, $note].forEach($a => {
      $a.attr("href", "#")
        .removeClass("text-blue-600")
        .addClass("text-gray-400")
        .text("Not Uploaded");
    });

    [$invName, $recName, $noteName].forEach($s => $s.text(""));

    // Reset download button
    $('#downloadAttachmentsBtn')
      .addClass('pointer-events-none opacity-50')
      .text('Download PDF');

    // Fetch data
    $.ajax({
      url: `/gts-materials/get-attachments/${id}`,
      type: 'GET',
      success: function (data) {
        const apply = (url, $link, $name) => {
          if (url) {
            $link.attr('href', url)
              .removeClass('text-gray-400')
              .addClass('text-blue-600')
              .text('Open');
            $name.text(getFileName(url));
          } else {
            $link.attr('href', '#')
              .removeClass('text-blue-600')
              .addClass('text-gray-400')
              .text('Not uploaded');
            $name.text('');
          }
        };

        // use each field's own URL
        apply(data.invoice, $inv, $invName);
        apply(data.receipt, $rec, $recName);
        apply(data.note, $note, $noteName);

        const hasAny = !!(data.invoice || data.receipt || data.note);
        $('#downloadAttachmentsBtn')
          .toggleClass('pointer-events-none opacity-50', !hasAny)
          .text('Download PDF');

        // Open modal (no jQuery animations)
        $('#viewAttachmentModal')
          .data('current-id', id)
          .attr('data-source', 'material')
          .removeClass('hidden')
          .addClass('flex')
          .fadeIn();
      },
      error: function () {
        alert('Failed to fetch attachments.');
      }
    });
  });

  // Form Submit
  $('#gtsAttachmentForm').on('submit', function (e) {
    e.preventDefault();

    const $form = $(this);
    const id = $('#gtsAttachRowId').val();
    const formData = new FormData(this);

    const isUpdate = $form.data('mode') === 'update';
    const $btn = $form.find('button[type="submit"]');
    $btn.text(isUpdate ? 'Updating...' : 'Saving...').prop('disabled', true);

    $.ajax({
      url: `/gts-materials/upload-attachments/${id}`,
      type: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') }
    })
      .done(function (res) {
        // Safe fallback so we never alert "undefined"
        alert(res?.message ?? 'Attachments saved.');
        $('#gtsAttachmentModal').removeClass('flex').addClass('hidden');
        loadGtsMaterials(); // refresh table
      })
      .fail(function (xhr) {
        const msg = xhr?.responseJSON?.message || xhr?.statusText || 'Upload failed.';
        alert(msg);
      })
      .always(function () {
        $btn.text(isUpdate ? 'Update' : 'Save').prop('disabled', false);
      });
  });

  $('#closeViewModal, #closeViewModalBottom').on('click', function () {
    $("#viewAttachmentModal").fadeOut(300, function () {
      $(this).addClass("hidden").removeClass("flex"); // ensure modal fully resets
    });
  });

  $('#downloadAttachmentsBtn').on('click', function () {
    const id = $('#viewAttachmentModal').data('current-id');
    const source = $('#viewAttachmentModal').attr('data-source');

    let downloadUrl = '';
    if (source === 'material') {
      downloadUrl = `/gts-materials/download-pdf/${id}`;
    } else {
      downloadUrl = `/investment/${id}/attachments/download`;
    }

    if (id && downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  });

  // ONE watcher for change detection in Materials
  $(document).on('input change', '.detail-row input, .detail-row textarea', function () {
    const $detailRow = $(this).closest('.detail-row');
    if ($detailRow.attr('data-loaded') === 'true' || $detailRow.hasClass('submitted')) {
      toggleUpdateButtonForDetail($detailRow);
    }
  });

  // Submit updates from the Action icon (bind once, namespaced)
  $(document)
    .off('click.materialUpdate')                                  // prevent dup binds
    .on('click.materialUpdate', '.update-row-btn', function (e) {
      e.preventDefault();
      e.stopPropagation(); // don't trigger header-row expand/collapse

      const $headerRow = $(this).closest('tr.header-row');
      const $detailRow = $headerRow.next('.detail-row');
      const id = $headerRow.data('id');
      if (!id) return;

      // make sure totals are fresh
      calculateRowTotals($detailRow, $headerRow);

      // payload expected by your controller
      const payload = {
        mode_of_transaction: ($detailRow.find('input[placeholder="Enter Transaction Method"]').val() || '').trim(),
        receipt_no: ($detailRow.find('textarea.receipt-no-textarea').val() || '').trim(),
        remarks: ($detailRow.find('textarea[placeholder="Enter Remarks"]').val() || '').trim(),
        shipping_cost: parseFloat($detailRow.find('[data-field="shippingCost"]').val()) || 0,
        dgd: parseFloat($detailRow.find('[data-field="dgd"]').val()) || 0,
        labour: parseFloat($detailRow.find('[data-field="labour"]').val()) || 0,
        total_material: parseFloat(String($headerRow.find('.header-total-material').text()).replace(/[^\d.-]/g, '')) || 0,
        total_shipping_cost: parseFloat(String($headerRow.find('.header-total-shipping').text()).replace(/[^\d.-]/g, '')) || 0,
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

      $.ajax({
        url: `/gts-materials/${id}`,
        method: 'PUT',
        headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
        data: payload
      })
        .done(function () {
          // refresh snapshot to the just-saved state
          $detailRow.data('snapshot', {
            mot: String(payload.mode_of_transaction ?? '').trim(),
            receipt: String(payload.receipt_no ?? '').trim(),
            remarks: String(payload.remarks ?? '').trim(),
            shipping: String($detailRow.find('[data-field="shippingCost"]').val() ?? '').trim(),
            dgd: String($detailRow.find('[data-field="dgd"]').val() ?? '').trim(),
            labour: String($detailRow.find('[data-field="labour"]').val() ?? '').trim(),
            items: payload.materials.map(m => ({
              id: m.id || null,
              desc: String(m.description ?? '').trim(),
              units: String(m.units ?? '').trim(),
              unit: String(m.unit_price ?? '').trim(),
              vat: String(m.vat ?? '').trim(),
              wctn: String(m.weight_per_ctn ?? '').trim(),
              ctns: String(m.ctns ?? '').trim()
            }))
          });

          // hide the icon + flash success
          setMaterialRowDirty($detailRow, false);
          const $cell = $headerRow.find('td:last').addClass('bg-green-50');
          setTimeout(() => $cell.removeClass('bg-green-50'), 600);

          // keep top totals in sync
          updateGtsTotalsFromDOM();
        })
        .fail(function (xhr) {
          alert(xhr?.responseJSON?.message || 'Update failed.');
          console.error(xhr?.responseText || xhr);
        });
    });

  // Any input change inside a material detail row => re-check diff
  $(document).on('input change', '.detail-row input, .detail-row textarea', function () {
    const $detailRow = $(this).closest('.detail-row');
    if ($detailRow.attr('data-loaded') === 'true' || $detailRow.hasClass('submitted')) {
      toggleUpdateButtonForDetail($detailRow);
    }
  });

  // Recalc + re-format the summary footer whenever Shipping/DGD/Labour change
  $(document).off('input.materialShip change.materialShip')
    .on('input.materialShip change.materialShip',
      '.detail-row input[data-field="shippingCost"], .detail-row input[data-field="dgd"], .detail-row input[data-field="labour"]',
      function () {
        const $detailRow = $(this).closest('.detail-row');
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
$(document).on('change', '#gtsAttachInvoice', () => updateFileLabel('gtsAttachInvoice', 'gtsAttachInvoiceFilename'));
$(document).on('change', '#gtsAttachReceipt', () => updateFileLabel('gtsAttachReceipt', 'gtsAttachReceiptFilename'));
$(document).on('change', '#gtsAttachNote', () => updateFileLabel('gtsAttachNote', 'gtsAttachNoteFilename'));

function reindexSerialNumbers() {
  $("#materialTableBody tr").each(function (index) {
    $(this).find("td:first").text(index + 1);
  });
}

function calculateRowTotals($detailRow, $headerRow) {
  let totalWeight = 0;
  let totalUnits = 0;
  let totalMaterialBuy = 0;
  let totalVAT = 0;
  let totalMaterialNoVAT = 0;

  $detailRow.find(".item-row").each(function () {
    const $row = $(this);

    const units = parseFloat($row.find('[data-field="units"]').val()) || 0;
    const unitPrice = parseFloat($row.find('[data-field="unitPrice"]').val()) || 0;
    const vat = parseFloat($row.find('[data-field="vat"]').val()) || 0;
    const weightPerCtn = parseFloat($row.find('[data-field="weightPerCtn"]').val()) || 0;
    const ctns = parseFloat($row.find('[data-field="ctns"]').val()) || 0;

    const materialTotal = units * unitPrice * vat;
    $row.find(".total-material").text(materialTotal.toFixed(2));

    const materialNoVAT = units * unitPrice;
    totalMaterialNoVAT += materialNoVAT;
    totalVAT += vat;
    totalMaterialBuy += materialTotal;

    const weightTotal = weightPerCtn * ctns;
    $row.find(".total-weight").text(weightTotal.toFixed(2));
    totalWeight += weightTotal;
    totalUnits += units;
  });

  // Read shipping inputs in this row
  const shippingCost = parseFloat($detailRow.find('[data-field="shippingCost"]').val()) || 0;
  const dgd = parseFloat($detailRow.find('[data-field="dgd"]').val()) || 0;
  const labour = parseFloat($detailRow.find('[data-field="labour"]').val()) || 0;
  const totalShipping = shippingCost + dgd + labour;

  // Update values in this detail row
  $detailRow.find(".total-weight-kg").text(totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2 }));
  $detailRow.find(".total-units").text(totalUnits.toLocaleString());

  $detailRow.find(".total-vat").text(formatCurrency(totalVAT));
  $detailRow.find(".total-material-buy").text(formatCurrency(totalMaterialBuy));
  $detailRow.find(".total-material-without-vat").text(formatCurrency(totalMaterialNoVAT));
  $detailRow.find(".dgd-value").text(formatCurrency(dgd));
  $detailRow.find(".labour-value").text(formatCurrency(labour));
  $detailRow.find(".shipping-cost-value").text(formatCurrency(totalShipping));
  $detailRow.find(".total-shipping-cost").text(formatCurrency(totalShipping));

  $headerRow.find(".header-total-material").text(formatCurrency(totalMaterialBuy));
  $headerRow.find(".header-total-shipping").text(formatCurrency(totalShipping));

  updateGtsTotalsFromDOM();

}

// cache for cross-sheet values
window.sheetTotals = {
  material: 0,
  shipping: 0,
  investment: 0
};

function updateMaterialTotals(totalMaterial, totalShipping) {
  const material = Number(totalMaterial) || 0;
  const shipping = Number(totalShipping) || 0;
  const investment = Number(window.sheetTotals?.investment) || 0; // add cached inv

  window.sheetTotals.material = material;
  window.sheetTotals.shipping = shipping;

  // save for Summary cold-starts (now with inv too)
  setGtsTotalsToStorage({ material, shipping, investment });

  // live update for open Summary tab
  $(document).trigger('gts:totalsUpdated', [{ material, shipping, investment }]);

  // native listeners
  document.dispatchEvent(new CustomEvent('gts:totals-changed', {
    detail: { material, shipping, investment }
  }));
}

// helpers
function setGtsTotalsToStorage(obj) {
  try {
    localStorage.setItem('gtsTotals', JSON.stringify({
      material: Number(obj.material) || 0,
      shipping: Number(obj.shipping) || 0,
      investment: Number(obj.investment) || 0
    }));
  } catch { }
}

function getGtsTotalsFromStorage() {
  try {
    const raw = localStorage.getItem('gtsTotals');
    if (!raw) return null;
    const o = JSON.parse(raw);
    return {
      material: Number(String(o.material).replace(/[^\d.-]/g, '')) || 0,
      shipping: Number(String(o.shipping).replace(/[^\d.-]/g, '')) || 0,
      investment: Number(String(o.investment).replace(/[^\d.-]/g, '')) || 0
    };
  } catch { return null; }
}

function updateInvestmentTotals(investmentTotal) {
  const investment = Number(investmentTotal) || 0;
  window.sheetTotals.investment = investment;

  // If you show the green card on Summary or Materials:
  $('#totalInvestmentAmount-investment').text(
    `AED ${investment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );

  setGtsTotalsToStorage({
    material: Number(window.sheetTotals.material) || 0,
    shipping: Number(window.sheetTotals.shipping) || 0,
    investment
  });

  // notify Summary so KPI Cash Out refreshes immediately
  $(document).trigger('gts:totalsUpdated', [{
    material: Number(window.sheetTotals.material) || 0,
    shipping: Number(window.sheetTotals.shipping) || 0,
    investment
  }]);
}

function updateCombinedCard() {
  const material = window.sheetTotals.material || 0;
  const investment = window.sheetTotals.investment || 0;
  const combined = material + investment;

  $("#materialPlusInvestment").text(
    `AED ${combined.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );
}

function formatCurrency(value) {
  const number = Number(value) || 0;
  return `AED ${number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function loadGtsMaterials() {
  $.get('/gts-materials', function (data) {
    if (!Array.isArray(data)) {
      console.error('Invalid response:', data);
      return;
    }

    // Clear any existing rows
    $("#materialTableBody").empty();

    data.reverse().forEach(function (entry, index) {
      const id = entry.id;
      const serialNo = index + 1;

      // Format the date
      const date = new Date(entry.invoice_date);
      const formattedDate = date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      });

      const actionButtons = `
        <div class="action-buttons flex justify-center gap-1">
          ${createMaterialIcon('upload-btn', 'bi-cloud-arrow-up-fill', 'Upload Attachments', 'bg-blue-500 hover:bg-blue-600 text-white', id)}
          ${createMaterialIcon('view-btn', 'bi-paperclip', 'View Attachments', 'bg-gray-700 hover:bg-gray-800 text-white', id)}
          ${createMaterialIcon('delete-material-btn', 'bi-trash-fill', 'Delete Row', 'bg-red-500 hover:bg-red-600 text-white', id)}
        </div>
      `;

      // compute exactly what the cards/summary use
      const headerMat = Number(entry.total_material_buy ?? 0);  // NOT total_material
      const headerShip = (entry.total_shipping_cost != null)
        ? Number(entry.total_shipping_cost)
        : (Number(entry.shipping_cost) || 0) +
        (Number(entry.dgd) || 0) +
        (Number(entry.labour) || 0);

      // Create header row
      const $headerRow = $(`
        <tr class="header-row cursor-pointer hover:bg-gray-100" data-id="${id}" data-loaded="true">
          <td class="border p-2 text-center">${serialNo}</td>
          <td class="border p-2">${formattedDate}</td>
          <td class="border p-2">${entry.invoice_no ?? '-'}</td>
          <td class="border p-2">${entry.supplier_name}</td>
          <td class="border p-2">${entry.brief_description}</td>
          <td class="border p-2 header-total-material">${formatCurrency(headerMat)}</td>
          <td class="border p-2 header-total-shipping">${formatCurrency(headerShip)}</td>
          <td class="border p-2 text-center">
            <div class="flex flex-col items-center gap-1">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `);

      const $detailRow = $(`
        <tr class="investment-detail-row detail-row relative hidden" data-id="${id}">
          <td colspan="8" class="p-2 bg-gray-50">
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
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">Receipt No:</span> <textarea placeholder="Enter receipt numbers" class="receipt-no-textarea flex-1 dynamic-textarea w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none overflow-y-auto" style="min-height: 120px;"></textarea></div>
                  <div class="flex items-start gap-2"><span class="font-semibold w-56">Remarks:</span> <textarea placeholder="Enter Remarks" class="flex-1 dynamic-textarea w-full rounded px-2 py-1 bg-white border border-gray-300 focus:outline-none resize-none overflow-hidden"></textarea></div>
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
                <tbody id="itemTableBody" class="item-table-body">
                  <!-- Rows added here -->
                </tbody>
              </table>

              <button id="addItemRowBtn" class="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">+ Add More Items</button>
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

      // Hide border/background in right-side grid
      $detailRow.find("input, textarea").each(function () {
        $(this).css({
          "border": "none",
          "background": "transparent",
          "outline": "none",
          "box-shadow": "none",
          "resize": "none",
          "overflow": "hidden",
          "height": "auto",
          "max-height": "100px"
        }).val($(this).val().trim());
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
      $detailRow.find('.total-vat').text(formatCurrency(entry.total_vat));
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

        // Manually trigger resize
        $receiptTextarea[0].style.height = 'auto'; // reset height
        $receiptTextarea[0].style.height = $receiptTextarea[0].scrollHeight + 'px';
      }

      $detailRow.find('textarea[placeholder="Enter Remarks"]').val(entry.remarks || "");

      // Now render item rows
      const $itemTableBody = $detailRow.find('#itemTableBody');

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
          const totalWeight = (item.weight_per_ctn || 0) * (item.no_of_ctns || 0);
          $row.find('.total-material').text(formatCurrency(totalMaterial));
          $row.find('.total-weight').text(formatCurrency(totalWeight));

          $itemTableBody.append($row);
        });
      }

      // snapshot AFTER the row is fully rendered
      $detailRow.data('snapshot', buildMaterialSnapshot($detailRow));
      toggleUpdateButtonForDetail($detailRow);
    });

    $(".detail-row").each(function () {
      const $detailRow = $(this);
      const $headerRow = $detailRow.prev(".header-row");
      calculateRowTotals($detailRow, $headerRow);
    });
    updateGtsTotalsFromDOM();
    fetchAndUpdateInvestmentTotal();
  });
}

// === keep top cards + cache in sync (Materials) ===
function updateGtsTotalsFromDOM() {
  let totalMaterial = 0;
  let totalShipping = 0;

  $('.header-total-material').each(function () {
    totalMaterial += parseFloat(String($(this).text()).replace(/[^\d.-]/g, '')) || 0;
  });
  $('.header-total-shipping').each(function () {
    totalShipping += parseFloat(String($(this).text()).replace(/[^\d.-]/g, '')) || 0;
  });

  // update the two cards on the Materials sheet
  $('#gtsMaterialTotal').text(
    `AED ${totalMaterial.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );
  $('#gtsShippingTotal').text(
    `AED ${totalShipping.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );

  // push into the shared cache + notify Summary
  if (typeof updateMaterialTotals === 'function') {
    updateMaterialTotals(totalMaterial, totalShipping); // no zero guard
  }
}

// Materials-only icon button factory (does not collide with Investment's createIconButton)
function createMaterialIcon(type, iconClass, tooltipText, btnClass = '', dataId = '') {
  // normalize icon class -> allow "bi-arrow-repeat" or "bi bi-arrow-repeat"
  const icon = String(iconClass || '').trim();
  const finalIcon = icon.startsWith('bi ') ? icon : `bi ${icon}`;

  return `
    <div class="relative group inline-block">
      <button class="${type} ${btnClass} px-2 py-1 rounded text-sm" data-id="${dataId}">
        <i class="${finalIcon}" style="font-size:16px;line-height:1"></i>
      </button>
      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1
                  scale-0 group-hover:scale-100 transition duration-200
                  bg-black text-white text-xs px-2 py-1 rounded pointer-events-none z-10 whitespace-nowrap">
        ${tooltipText}
      </div>
    </div>
  `;
}

function setMaterialRowDirty($detailRow, dirty) {
  const $headerRow = $detailRow.prev('.header-row');
  if (!$headerRow.length) return;

  const id = $headerRow.data('id');

  // Rebuild default action buttons (upload, view, delete)
  const defaultActions = `
  <div class="action-buttons flex justify-center gap-1">
    ${createMaterialIcon('upload-btn', 'bi-cloud-arrow-up-fill', 'Upload Attachments', 'bg-blue-500 hover:bg-blue-600 text-white', id || '')}
    ${createMaterialIcon('view-btn', 'bi-paperclip', 'View Attachments', 'bg-gray-700 hover:bg-gray-800 text-white', id || '')}
    ${createMaterialIcon('delete-material-btn', 'bi-trash-fill', 'Delete Row', 'bg-red-500 hover:bg-red-600 text-white', id || '')}
  </div>`;

  const saveBtn = createMaterialIcon(
    'update-row-btn',
    'bi-arrow-repeat',              // <<< your preferred icon
    'Update Row',
    'bg-green-600 hover:bg-green-700 text-white',
    id || ''
  );

  const $cell = $headerRow.find('td:last > div');
  if (!$cell.length) return;

  if (dirty) {
    // Show Save button to the LEFT of the normal actions (no duplicates)
    if ($headerRow.find('.update-row-btn').length === 0) {
      $cell.prepend(saveBtn);
    }
  } else {
    // Remove save button if no changes
    $headerRow.find('.update-row-btn').remove();
    // Ensure default actions exist (in case of previous replacements)
    if (!$cell.find('.upload-btn').length) $cell.html(defaultActions);
  }
}

// Build a snapshot of a detail row for change detection
function buildMaterialSnapshot($detailRow) {
  const t = v => (v == null ? '' : String(v).trim()); // store typed text

  const snap = {
    mot: t($detailRow.find('input[placeholder="Enter Transaction Method"]').val()),
    receipt: t(($detailRow.find('textarea.receipt-no-textarea').val() || '').replace(/\r/g, '')),
    remarks: t($detailRow.find('textarea[placeholder="Enter Remarks"]').val()),
    sshipping: t($detailRow.find('input[data-field="shippingCost"]').val()),
    dgd: t($detailRow.find('input[data-field="dgd"]').val()),
    labour: t($detailRow.find('input[data-field="labour"]').val()),
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
  const prev = $detailRow.data('snapshot') || {};
  const curr = buildMaterialSnapshot($detailRow);
  return JSON.stringify(prev) !== JSON.stringify(curr);
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
    $("#investmentDate").val("");
    $("#investmentInvestor").val("");

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


  $(document).on("input", ".investment-amount-input", function () {
    const $input = $(this);
    const rawValue = $input.val().trim().replace(/,/g, "");
    const numericValue = parseFloat(rawValue);

    const $headerRow = $input.closest("tr").prev(".investment-header");

    if (!isNaN(numericValue)) {
      $input.data("numericValue", numericValue);

      // Update header's amount cell live
      const formatted = numericValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      $headerRow.find("td").eq(3).text(`AED ${formatted}`);
    } else {
      $headerRow.find("td").eq(3).text(`AED 0.00`);
      $input.data("numericValue", 0);
    }

    fetchAndUpdateInvestmentTotal(); // also update top total live
  });

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
      url: "/investments",
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

    $.ajax({
      url: `/investments/${investmentId}`,
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
      url: `/investments/${investmentId}`,
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
        $form.find(".save-changes-btn").addClass("hidden");

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
    $.get(`/investment/${investmentId}/attachments`, function (res) {
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

    const investmentId = $("#uploadAttachmentModal").data("investment-id"); // this must NOT be undefined

    if (!investmentId) {
      alert("Missing investment ID.");
      return;
    }

    const formData = new FormData(this);
    formData.append("_token", $('meta[name="csrf-token"]').attr("content"));

    $.ajax({
      url: `/investment/${investmentId}/upload-attachments`,
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
    $('#attachmentViewerTitle').text(`ID: ${id} – ${investor}`);

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
    $('#downloadAttachmentsBtn')
      .addClass('pointer-events-none opacity-50')
      .text('Download PDF');

    // Fetch and apply attachment URLs
    $.ajax({
      url: `/investment/${id}/attachments`,
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
          $('#downloadAttachmentsBtn')
            .removeClass('pointer-events-none opacity-50')
            .text('Download PDF');
        }

        $('#investmentAttachmentModal')
          .data('current-id', id)
          .attr('data-source', 'investment')
          .removeClass('hidden')
          .addClass('flex')
          .fadeIn();
      },
      error: function () {
        alert('Failed to load attachments.');
      }
    });
  });

  $(document).on("click", "#closeViewModal, #closeViewModalBottom", function () {
    $("#investmentAttachmentModal").fadeOut(200, function () {
      $(this).addClass("hidden").css("display", "none");
    });
  });

  $(document).on('click', '#downloadAttachmentsBtn', function () {
    const source = $('#investmentAttachmentModal').attr('data-source');
    const id = $('#investmentAttachmentModal').data('current-id');

    if (!id || !source) return;

    if (source === 'investment') {
      window.open(`/investment/${id}/attachments/download`, '_blank');
    } else if (source === 'material') {
      window.open(`/gts-materials/download-pdf/${id}`, '_blank');
    }
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
    const selectedDate = $("#murabahaDateInput").val();
    const investmentId = $("#murabahaDateModal").data("investment-id"); // match modal ID

    if (!selectedDate) {
      alert("Please select a date.");
      return;
    }

    $.ajax({
      url: `/investment/${investmentId}/murabaha`,
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
        url: `/investments/${id}`,
        method: 'PUT',
        headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') },
        data: payload
      })
        .done(function () {
          // header refresh
          const formattedAmt = `AED ${Number(payload.investment_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          $headerRow.find('.investment-amount-display').text(formattedAmt);
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
  const formattedAmount = `AED ${investmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const dateObj = new Date(investmentDate);
  const formattedDate = isNaN(dateObj)
    ? "Invalid Date"
    : dateObj.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const actionButtons = `
    <div class="action-buttons flex items-center justify-center gap-1">
      ${status === "draft" ? `
        <button type="button" class="submit-investment-btn px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
          Submit
        </button>` : ''}

      ${createInvestmentIconButton('investment-attachment-btn', 'bi-cloud-arrow-up-fill', 'Upload Attachments', 'bg-blue-500 hover:bg-blue-600 text-white', investmentId)}
      ${createInvestmentIconButton('btn-view-attachment', 'bi bi-paperclip', 'View Attachments', 'bg-gray-700 hover:bg-gray-800 text-white', investmentId)}
      ${createInvestmentIconButton('delete-investment-btn', 'bi-trash-fill', 'Delete Row', 'bg-red-500 hover:bg-red-600 text-white', investmentId)}
    </div>
  `;

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
        <td class="border p-2 text-center">
          <div class="action-buttons flex items-center justify-center gap-1">
            ${actionButtons}
          </div>
        </td>
      </tr>
    `);

  const $detailRow = $(`
    <tr class="investment-detail-row relative hidden" data-id="${investmentId}">
      <td colspan="6" class="p-4 bg-white">
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
              <input type="number" min="0" placeholder="e.g., 10000" value="${escapeHtml(investmentAmount)}" class="investment-amount w-full bg-yellow-100 px-3 py-2 rounded editable-field" />
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

  $detailRow.find("#investmentAmount").on("input", function () {
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
    url: "/investments",
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
  const url = (typeof window.investmentUrl === 'function')
    ? window.investmentUrl('gts-investments/total')   // live (prefixed)
    : '/gts-investments/total';                       // local

  return $.getJSON(url)
    .then(res => {
      const total = Number(res?.total ?? 0) || 0;
      applyInvestmentTotal(total);
      return total;
    })
    .catch(err => {
      console.error('investment total fetch failed', err);
      applyInvestmentTotal(0);
      return 0;
    });
}

// Write everywhere + broadcast
function applyInvestmentTotal(total) {
  const formatted = 'AED ' + (Number(total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('#investmentTotalAmount').text(formatted);              // investment tab card (if present)
  $('#totalInvestmentAmount-investment').text(formatted);   // Summary card
  $('#totalInvestmentAmount-material').text(formatted);     // any legacy alias

  // cache for summary renderer
  window.sheetTotals = window.sheetTotals || {};
  window.sheetTotals.investment = Number(total) || 0;

  // Tell Summary (if it listens)
  $(document).trigger('gts:totalsUpdated', [{
    material: Number(window.sheetTotals.material) || 0,
    shipping: Number(window.sheetTotals.shipping) || 0,
    investment: Number(total) || 0,
  }]);
}

// Write to every place that might display the investment sum + broadcast
function applyInvestmentTotal(total) {
  const formatted = `AED ${Number(total || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  // Investment sheet (new unique ID)
  $("#investmentTotalAmount").text(formatted);

  // Legacy IDs used elsewhere (Summary / Materials cards that show investment)
  $("#totalInvestmentAmount-investment").text(formatted);
  $("#totalInvestmentAmount-material").text(formatted);

  // cache + broadcast
  window.sheetTotals = window.sheetTotals || {};
  window.sheetTotals.investment = Number(total) || 0;

  // If you persist others, keep them; otherwise default to 0
  const payload = {
    material: Number(window.sheetTotals.material) || 0,
    shipping: Number(window.sheetTotals.shipping) || 0,
    investment: Number(total) || 0
  };

  // Use the same event your Summary listener expects
  $(document).trigger('gts:totalsUpdated', [payload]);
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
