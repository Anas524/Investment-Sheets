<div class="sq-client-wrapper px-3 py-5" style="background-color: #f5faff; min-height: 100vh;">
  <div class="container" style="max-width: 720px;">
    <!-- Form Card -->
    <div class="card shadow-lg border-0 mb-4">
      <div class="card-body">
        <h4 class="card-title text-center mb-4 text-dark fw-bold">💵 SQ Client Payment Entry</h4>
        <form id="sqClientForm" action="{{ url('/sq-client/save') }}" method="POST">
          @csrf
          <div class="row g-4">
            <div class="col-md-12">
              <label for="sqDate" class="form-label">Date</label>
              <input type="date" class="form-control" id="sqDate" name="date">
            </div>
            <div class="col-md-6">
              <label for="sqAmount" class="form-label">Amount (AED)</label>
              <input type="number" step="any" class="form-control" id="sqAmount" name="amount" placeholder="e.g. 2000.00">
            </div>
            <div class="col-md-6">
              <label for="sqRemarks" class="form-label">Remarks</label>
              <input type="text" class="form-control" id="sqRemarks" name="remarks" placeholder="Optional">
            </div>
          </div>
          <div class="text-center mt-4">
            <button type="submit" class="btn btn-dark px-4 py-2">Submit Payment</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Summary Box -->
    <div class="bg-white rounded shadow-sm py-3 px-4 mb-4 text-center border-start border-5 border-success">
      <h5 class="mb-0 text-secondary">Total Amount Collected for SQ Sheet</h5>
      <h3 class="text-success mt-2" id="sq-total-amount">AED 0.00</h3>
    </div>

    <!-- Table -->
    <div class="card shadow-sm border-0 mb-5">
      <div class="card-body p-0">
        <div class="table-container px-3">
          <table class="table table-striped table-hover sq-client-table mb-0">
            <thead>
              <tr>
                <th>SR.NO</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Remarks</th>
                <th>Action</th>
              </tr>
              <tr class="bg-light">
                @for ($i = 0; $i < 5; $i++)
                  <th>
                    @if ($i == 1) {{-- Date column --}}
                      <input type="text" id="sqDateFilterInput" class="form-control form-control-sm column-filter" placeholder="Select Date Range" readonly  style="cursor: pointer; max-width: 180px; min-width: 140px; overflow: hidden; text-overflow: ellipsis;">
                    @elseif ($i < 4) {{-- Amount, Remarks --}}
                      <input type="text" class="form-control form-control-sm column-filter" data-index="{{ $i }}" placeholder="Filter...">
                    @endif
                  </th>
                @endfor
              </tr>
            </thead>
            <tbody id="sq-client-body">
              {{-- Rows will be populated via JS --}}
            </tbody>
          </table>
          <!-- US Date Range Popup -->
          <div id="sqDatePopup" class="card p-3 shadow" style="position: absolute; display: none; z-index: 1000; min-width: 220px;">
            <label>From Date:</label>
            <input type="date" id="sqFromDate" class="form-control mb-2" />
            <label>To Date:</label>
            <input type="date" id="sqToDate" class="form-control mb-3" />
            <div class="d-grid gap-2">
              <button id="applySQDateFilter" class="btn btn-primary btn-sm">Apply Filter</button>
              <button id="clearSQDateFilter" class="btn btn-secondary btn-sm">Clear Filter</button>
              <button id="sqFilteredExcelBtn" class="btn btn-light d-none">
                <img src="https://img.icons8.com/color/24/microsoft-excel-2019--v1.png" />
                Export Filtered Excel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <a href="{{ url('/export/us-client') }}" id="excelExportUS" style="display: none;"></a>

    <!-- Delete Confirmation Modal -->
    <div class="modal fade" id="sqDeleteModal" tabindex="-1" aria-labelledby="usDeleteModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content text-center">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title">Confirm Delete</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            Are you sure you want to delete this record?
            <input type="hidden" id="sqDeleteId">
          </div>
          <div class="modal-footer justify-content-center">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" id="confirmSqDeleteBtn" class="btn btn-danger">Delete</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>