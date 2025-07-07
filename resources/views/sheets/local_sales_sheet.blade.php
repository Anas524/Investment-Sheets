<!-- Local Sales Sheet Blade View -->
<div class="local-sales-wrapper px-3 py-5" style="background-color: #f7fcff; min-height: 100vh;">
    <div class="container" style="max-width: 800px;">
        <div class="card shadow rounded-4 border-0 mb-4" style="background: #ffffffcc;">
            <div class="card-body p-4">
                <h3 class="card-title text-center mb-4 fw-bold" style="color: #144272;">Local Sales Entry</h3>
                <form id="localSalesForm" enctype="multipart/form-data">
                    @csrf
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label for="clientName" class="form-label">Client</label>
                            <input type="text" class="form-control" id="clientName" name="client" placeholder="Enter client name">
                        </div>
                        <div class="col-md-4">
                            <label for="localDate" class="form-label">Date</label>
                            <input type="date" class="form-control" id="localDate" name="date" placeholder="Select date">
                        </div>
                        <div class="col-md-4 d-flex align-items-end">
                            <button type="button" class="btn btn-outline-secondary w-100" id="ls-open-multi-entry-btn">
                                + Add Multiple Entry
                            </button>
                        </div>
                        <div class="col-md-4">
                            <label for="ls-description" class="form-label">Description</label>
                            <input type="text" class="form-control" id="ls-description" name="description" placeholder="Enter product description">
                        </div>
                        <div class="col-md-4">
                            <label for="ls-unit-price" class="form-label">Unit Price</label>
                            <input type="number" class="form-control" id="ls-unit-price" name="unit_price" step="0.01" placeholder="Enter unit price">
                        </div>
                        <div class="col-md-4">
                            <label for="noOfCtns" class="form-label">No. of CTNS</label>
                            <input type="number" class="form-control" id="noOfCtns" name="no_of_ctns" placeholder="Enter number of cartons">
                        </div>
                        <div class="col-md-4">
                            <label for="ls-units-per-ctn" class="form-label">Units/CTN</label>
                            <input type="number" class="form-control" id="ls-units-per-ctn" name="units_per_ctn" placeholder="Enter units per carton">
                        </div>
                        <div class="col-md-4">
                            <label for="vatPercent" class="form-label">VAT %</label>
                            <input type="number" class="form-control" id="vatPercent" name="vat_percentage" step="0.01" placeholder="Enter VAT percentage">
                        </div>
                        <div class="col-md-4">
                            <label for="paymentStatus" class="form-label">Payment Status</label>
                            <select class="form-select" id="paymentStatus" name="payment_status">
                                <option value="" disabled selected>Select payment status</option>
                                <option value="Paid">Paid</option>
                                <option value="Pending">Pending</option>
                                <option value="Partially Paid">Partially Paid</option>
                            </select>
                        </div>
                        <div class="col-md-12">
                            <label for="ls-remarks" class="form-label">Remarks</label>
                            <textarea class="form-control" id="ls-remarks" name="remarks" style="height: 38px;" placeholder="Add any remarks"></textarea>
                        </div>
                        <div class="col-md-12">
                            <button type="submit" class="btn btn-LS-submit px-4 form-control" id="localSubmitBtn">Submit</button>
                            <button type="button" class="btn btn-LS-submit px-4 form-control d-none" id="localUpdateBtn">Update</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <div class="summary-card card shadow-lg p-4 mb-4 rounded-4 text-center" style="background-color: #d7efff;">
            <h5>Total Sales: <span id="totalSalesValue" class="fw-bold text-success">AED 0.00</span></h5>
        </div>
    </div>

    <div class="table-responsive drag-scroll">
        <table class="table table-striped table-bordered w-100 shadow-sm" id="localSalesTable">
            <thead class="table-light">
                <tr>
                    <th>SR.NO</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Unit Price</th>
                    <th>No. of CTNS</th>
                    <th>Units/CTN</th>
                    <th>Total Units</th>
                    <th>Amount No VAT</th>
                    <th>VAT</th>
                    <th>Total With VAT</th>
                    <th>Payment</th>
                    <th>Remarks</th>
                    <th>Action</th>
                </tr>
                <tr class="bg-light">
                    @for ($i = 0; $i < 14; $i++)
                        <th>
                        @if ($i == 2)
                        {{-- Date column filter --}}
                            <input type="text" id="localDateFilterInput" class="form-control form-control-sm column-filter" placeholder="Select Date Range" readonly style="cursor: pointer;">
                        @elseif ($i < 13)
                            {{-- Other columns --}}
                            <input type="text" class="form-control form-control-sm column-filter" data-index="{{ $i }}" placeholder="Filter...">
                        @endif
                        </th>
                    @endfor
                </tr>
            </thead>
            <tbody id="localSalesTableBody">
                <!-- Rows will be inserted here -->
            </tbody>
        </table>
        <!-- Local Sales Date Filter Popup -->
        <div id="localDatePopup" class="card p-3 shadow" style="position:absolute;display:none;z-index:9999;min-width:220px;">
            <label>From Date:</label>
            <input type="date" id="localFromDate" class="form-control mb-2" />
            <label>To Date:</label>
            <input type="date" id="localToDate" class="form-control mb-3" />
            <div class="d-grid gap-2">
                <button id="applyLocalDateFilter" class="btn btn-primary btn-sm">Apply</button>
                <button id="clearLocalDateFilter" class="btn btn-secondary btn-sm">Clear</button>
                <button id="localFilteredExcelBtn" class="btn btn-light d-none">
                    <img src="https://img.icons8.com/color/24/microsoft-excel-2019--v1.png" /> Export Excel
                </button>
            </div>
        </div>
    </div>

    <!-- 🟦 Manual Units Modal -->
    <form id="manualUnitsForm">
        <div class="modal fade" id="lsManualUnitsModal" tabindex="-1">
            <div class="modal-dialog modal-sm modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Enter Total Units</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="number" class="form-control" id="manualTotalUnits" placeholder="e.g. 120">
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary w-100">Continue Submit</button>
                    </div>
                </div>
            </div>
        </div>
    </form>

    <!-- 🟦 Modal to ask how many entries -->
    <div class="modal fade" id="ls-multi-entry-count-modal" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">How many entries?</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <input type="number" class="form-control" id="ls-number-of-entries" placeholder="e.g. 3">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary w-100" id="ls-start-entry-btn">Start</button>
                </div>
            </div>
        </div>
    </div>

    <!-- 🟦 Step-by-step Multiple Entry Modal -->
    <div class="modal fade" id="ls-multi-entry-step-modal" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Multiple Entry <span id="ls-step-title"></span></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div id="ls-step-entry-fields"><!-- dynamic form will be inserted here --></div>
                </div>
                <div class="modal-footer d-flex justify-content-between">
                    <button type="button" class="btn btn-outline-secondary" id="ls-prev-entry-btn">Previous</button>
                    <button type="button" class="btn btn-primary" id="ls-next-entry-btn">Next</button>
                    <button type="button" class="btn btn-success d-none" id="ls-submit-multi-entry">Submit All</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal fade" id="lsDeleteModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Delete Confirmation</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p id="lsDeleteConfirmationText" class="mb-2"></p>
                    <div id="lsSubSerialInputContainer" style="display: none;">
                        <input type="text" id="lsSubSerialInput" class="form-control" placeholder="e.g. 1 or all">
                        <small class="text-muted">Enter a number to delete one sub-entry or 'all' to delete the full set</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" id="lsConfirmDeleteBtn" class="btn btn-danger">Delete</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="subSerialEditModal" tabindex="-1" aria-labelledby="subSerialEditLabel" aria-hidden="true">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="subSerialEditLabel">Edit Sub-Serial</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <label id="subSerialInputLabel" for="subSerialInput" class="form-label">Enter Sub-Serial Number:</label>
                    <input type="number" min="1" class="form-control" id="subSerialInput" />
                    <input type="hidden" id="targetSrNoForEdit" />
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="confirmSubSerialEditBtn">Continue</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Copy Sub-Serial Modal -->
    <div class="modal fade" id="subSerialCopyModal" tabindex="-1" aria-labelledby="subSerialCopyModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="subSerialCopyModalLabel">Enter Sub-Serial to Copy</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="targetSrNoForCopy">
                    <label>Sub-Serial No:</label>
                    <input type="number" id="subSerialInputForCopy" class="form-control" placeholder="Enter number">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="confirmSubSerialCopyBtn">Confirm</button>
                </div>
            </div>
        </div>
    </div>

</div>