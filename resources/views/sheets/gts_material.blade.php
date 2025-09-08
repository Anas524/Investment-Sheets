<div class="p-6">
  <!-- <h2 class="text-2xl font-bold mb-4">Material Sheet</h2> -->

  <!-- Totals Section -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

    <!-- Total Material -->
    <div class="bg-white rounded-2xl shadow-lg p-6 text-center border-l-4 border-blue-700">
      <h3 class="text-gray-500 font-medium text-sm mb-2">Total Material</h3>
      <p id="gtsMaterialTotal" class="text-2xl font-bold text-blue-700">0.00</p>
    </div>

    <!-- Total Shipping Cost -->
    <div class="bg-white rounded-2xl shadow-lg p-6 text-center border-l-4 border-blue-700">
      <h3 class="text-gray-500 font-medium text-sm mb-2">Total Shipping Cost</h3>
      <p id="gtsShippingTotal" class="text-2xl font-bold text-blue-700">0.00</p>
    </div>

    <!-- Total Investment Amount -->
    <div class="bg-white rounded-2xl shadow-lg p-6 text-center border-l-4 border-green-700">
      <h3 class="text-gray-500 font-medium text-sm mb-2">Total Investment Amount</h3>
      <p id="totalInvestmentAmount-material" class="text-2xl font-bold text-green-700">AED 0.00</p>
    </div>

  </div>

  <!-- Add Row Button -->
  <button id="addRowBtn"
    class="mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">
    + Add Row
  </button>

  <!-- Material Table -->
  <h2 class="text-lg font-semibold mt-8 mb-2">Material Entries</h2>
  <div class="overflow-x-auto">
    <table class="min-w-full border border-gray-300 bg-white">
      <thead class="bg-black text-white">
        <tr>
          <th class="border p-2 w-5">S.No</th>
          <th class="border p-2 w-32">Invoice Date</th>
          <th class="border p-2 w-32">Invoice No</th>
          <th class="border p-2 w-32">Supplier Name</th>
          <th class="border p-2 w-32">Brief Description</th>
          <th class="border p-2 w-32">Total Material</th>
          <th class="border p-2 w-32">Total Shipping Cost</th>
          <th class="border p-2 w-24">Action</th>
        </tr>
      </thead>
      <tbody id="materialTableBody">
        <!-- Rows will be dynamically inserted -->
      </tbody>
    </table>
  </div>

  <template id="itemRowTemplate">
    <tr class="item-row bg-yellow-100">
      <td class="border p-1 text-center w-5">__SNO__</td>

      <!-- Description -->
      <td class="border p-1 w-64 relative">
        <textarea
          placeholder="Description"
          data-field="description"
          rows="1"
          class="material-input editable-input w-full rounded px-1 py-0.5 align-middle bg-white border border-gray-300 focus:outline-none resize-none overflow-hidden whitespace-pre-wrap break-words"></textarea>
      </td>

      <!-- No. of Units -->
      <td class="border p-1 w-24 relative">
        <input
          type="number"
          placeholder="0"
          data-field="units"
          class="material-input editable-input w-full rounded px-1 py-0.5 bg-white border border-gray-300 focus:outline-none" />
      </td>

      <!-- Unit Material wout VAT -->
      <td class="border p-1 w-40 relative">
        <input
          type="number"
          placeholder="0"
          data-field="unitPrice"
          class="material-input editable-input w-full rounded px-1 py-0.5 bg-white border border-gray-300 focus:outline-none" />
      </td>

      <!-- VAT 5% -->
      <td class="border p-1 w-20 relative">
        <input
          type="number"
          placeholder="0"
          data-field="vat"
          class="material-input editable-input w-full rounded px-1 py-0.5 bg-white border border-gray-300 focus:outline-none" />
      </td>

      <!-- Total Price (calculated) -->
      <td class="border p-1 total-material w-40">0</td>

      <!-- Weight -->
      <td class="border p-1 w-32 relative">
        <input
          type="number"
          placeholder="0"
          data-field="weightPerCtn"
          class="material-input editable-input w-full rounded px-1 py-0.5 bg-white border border-gray-300 focus:outline-none" />
      </td>

      <!-- No. of CTNS -->
      <td class="border p-1 w-24 relative">
        <input
          type="number"
          placeholder="0"
          data-field="ctns"
          class="material-input editable-input w-full rounded px-1 py-0.5 bg-white border border-gray-300 focus:outline-none" />
      </td>

      <!-- Total Weight (calculated) -->
      <td class="border p-1 total-weight w-32">0</td>

      <td class="border p-1 text-center">
        <button class="delete-item-btn text-red-500 hover:text-red-700">
          &times;
        </button>
      </td>
    </tr>
  </template>

  <!-- Modal Backdrop -->
  <div id="addRowModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
      <h2 class="text-xl font-semibold mb-4">Add New Investment Row</h2>
      <form id="addRowForm">
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium mb-1">Invoice Date</label>
            <input id="modalInvoiceDate" name="invoice_date" type="date" placeholder="e.g., 28 June 2025" class="w-full border border-gray-300 rounded px-3 py-2" required />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Invoice No</label>
            <input id="modalInvoiceNo" name="invoice_no" type="text" placeholder="Enter Invoice No" class="w-full border border-gray-300 rounded px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Supplier Name</label>
            <input id="modalSupplierName" name="supplier_name" type="text" placeholder="Supplier Name" class="w-full border border-gray-300 rounded px-3 py-2" required />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Brief Description</label>
            <input id="modalDescription" name="brief_description" type="text" placeholder="Brief Description" class="w-full border border-gray-300 rounded px-3 py-2" required />
          </div>
        </div>
        <div class="mt-6 flex justify-end space-x-2">
          <button id="modalCancelBtn" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <div id="deleteConfirmModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
      <h2 class="text-xl font-semibold mb-4 text-center">Confirm Delete</h2>
      <p class="text-center mb-6">Are you sure you want to delete this row?</p>
      <div class="flex justify-center space-x-4">
        <button id="cancelDeleteBtn" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
        <button id="confirmDeleteBtn" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
      </div>
    </div>
  </div>

  <!-- Confirm Item Delete Modal -->
  <div id="confirmItemDeleteModal" class="fixed inset-0 bg-black bg-opacity-40 z-50 hidden justify-center items-center">
    <div class="bg-white p-6 rounded shadow-xl w-80 text-center">
      <p class="mb-4 text-lg font-semibold text-gray-800">Delete this item?</p>
      <div class="flex justify-center gap-4">
        <button id="confirmItemDeleteBtn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded">Delete</button>
        <button id="cancelItemDeleteBtn" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-1 rounded">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Type Selection Modal -->
  <div id="typeSelectModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
      <h2 class="text-xl font-semibold mb-4 text-center">Select Entry Type</h2>
      <div class="flex flex-col space-y-3">
        <button id="selectMaterialBtn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Material Layout
        </button>
        <button id="selectInvestmentBtn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          Investment Layout
        </button>
      </div>
      <div class="mt-4 flex justify-center">
        <button id="cancelTypeSelectBtn" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
          Cancel
        </button>
      </div>
    </div>
  </div>
</div>

<!-- GTS Material Attachment Modal -->
<div id="gtsAttachmentModal" class="fixed inset-0 bg-black/60 z-50 hidden items-center justify-center backdrop-blur-sm">
  <div class="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 relative border border-gray-200">

    <!-- Close Button -->
    <button id="gtsModalCloseBtn" class="absolute top-4 right-4 text-gray-500 hover:text-red-600 text-2xl font-bold">
      &times;
    </button>

    <!-- Title -->
    <h2 class="text-2xl font-bold text-black mb-6 border-b pb-3">Upload Attachments</h2>

    <!-- Form -->
    <form id="gtsAttachmentForm" enctype="multipart/form-data" class="space-y-5">
      <input type="hidden" id="gtsAttachRowId">

      <div class="space-y-1">
        <label class="block text-sm font-medium text-gray-700">Invoice</label>
        <label class="relative block w-full cursor-pointer">
          <input type="file" id="gtsAttachInvoice" name="invoice" accept="image/*,application/pdf" class="sr-only">
          <div class="flex items-center justify-between border border-gray-300 rounded-md px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 transition">
            <div class="flex flex-col w-full">
              <span id="gtsAttachInvoiceFilename" class="truncate text-sm text-gray-700">No file chosen</span>
            </div>
            <span class="text-sm font-semibold text-blue-600">Browse</span>
          </div>
        </label>
        <span id="gtsAttachInvoiceStatus" class="text-green-600 text-xs hidden items-center gap-1">
          <i class="bi bi-check-circle-fill text-green-600"></i> Uploaded
        </span>
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium text-gray-700">Bank Transfer Receipt</label>
        <label class="relative block w-full cursor-pointer">
          <input type="file" id="gtsAttachReceipt" name="receipt" accept="image/*,application/pdf" class="sr-only">
          <div class="flex items-center justify-between border border-gray-300 rounded-md px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 transition">
            <div class="flex flex-col w-full">
              <span id="gtsAttachReceiptFilename" class="truncate text-sm text-gray-700">No file chosen</span>
            </div>
            <span class="text-sm font-semibold text-blue-600">Browse</span>
          </div>
        </label>
        <span id="gtsAttachReceiptStatus" class="text-green-600 text-xs hidden items-center gap-1">
          <i class="bi bi-check-circle-fill text-green-600"></i> Uploaded
        </span>
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium text-gray-700">Delivery Note</label>
        <label class="relative block w-full cursor-pointer">
          <input type="file" id="gtsAttachNote" name="note" accept="image/*,application/pdf" class="sr-only">
          <div class="flex items-center justify-between border border-gray-300 rounded-md px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 transition">
            <div class="flex flex-col w-full">
              <span id="gtsAttachNoteFilename" class="truncate text-sm text-gray-700">No file chosen</span>
            </div>
            <span class="text-sm font-semibold text-blue-600">Browse</span>
          </div>
        </label>
        <span id="gtsAttachNoteStatus" class="text-green-600 text-xs hidden items-center gap-1">
          <i class="bi bi-check-circle-fill text-green-600"></i> Uploaded
        </span>
      </div>

      <div class="flex justify-end gap-3 pt-4 border-t">
        <button type="button" id="gtsCancelBtn" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md">Cancel</button>
        <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold">Save</button>
      </div>
    </form>
  </div>
</div>

<!-- Modern View Attachment Modal -->
<div id="viewAttachmentModal" class="fixed inset-0 bg-black/60 hidden items-center justify-center z-50 backdrop-blur-sm px-4">
  <div class="bg-white max-w-4xl w-full rounded-2xl shadow-xl overflow-hidden flex flex-col" style="max-height: 85vh;">

    <!-- Modal Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
      <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
        <i class="bi bi-folder2-open text-blue-600 text-2xl"></i>
        <span>Attachment Viewer – <span id="attachmentViewerTitle" class="text-gray-600 font-medium text-base"></span></span>
      </h2>

      <button id="closeViewModal" class="text-gray-500 hover:text-red-600 text-2xl font-bold">&times;</button>
    </div>

    <!-- Modal Body (Scrollable) -->
    <div id="pdfContentForDownload" class="space-y-4 text-sm px-6 py-4 overflow-auto max-h-[65vh]">
      <div class="flex justify-between items-center">
        <strong>Invoice:</strong>
        <div class="flex items-center gap-2">
          <a id="viewInvoiceLink" href="#" target="_blank" class="text-gray-400 underline">Not Uploaded</a>
          <span id="viewInvoiceName" class="text-gray-500 text-xs"></span>
        </div>
      </div>
      <div class="flex justify-between items-center">
        <strong>Bank Transfer Receipt:</strong>
        <div class="flex items-center gap-2">
          <a id="viewReceiptLink" href="#" target="_blank" class="text-gray-400 underline">Not Uploaded</a>
          <span id="viewReceiptName" class="text-gray-500 text-xs"></span>
        </div>
      </div>
      <div class="flex justify-between items-center">
        <strong>Delivery Note:</strong>
        <div class="flex items-center gap-2">
          <a id="viewNoteLink" href="#" target="_blank" class="text-gray-400 underline">Not Uploaded</a>
          <span id="viewNoteName" class="text-gray-500 text-xs"></span>
        </div>
      </div>
    </div>

    <!-- Modal Footer -->
    <div class="flex justify-end items-center gap-4 px-6 py-4 border-t bg-gray-50">
      <button id="downloadAttachmentsBtn" class="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-md font-medium">
        <i class="bi bi-download"></i> Download PDF
      </button>
      <button id="closeViewModalBottom" class="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md font-medium">
        Close
      </button>
    </div>

  </div>
</div>