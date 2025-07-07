<div class="container py-4">
    <h3 class="mb-5 text-center">Summary Overview</h3>

    <!-- Cash Out Summary -->
    <div class="card mb-4 shadow-sm border-0">
        <div class="card-body text-center">
            <h4 class="text-danger mb-3">Cash Out Summary</h4>
            <div class="row justify-content-center">
                <div class="col-md-6 mb-3">
                    <h6 class="text-muted">TOTAL PURCHASE OF MATERIAL</h6>
                    <h4 id="totalPurchaseMaterial" class="fw-bold text-dark">Loading...</h4>
                </div>
                <div class="col-md-6 mb-3">
                    <h6 class="text-muted">TOTAL SHIPPING COST</h6>
                    <h4 id="totalShippingCost" class="fw-bold text-dark">Loading...</h4>
                </div>
            </div>
        </div>
    </div>

    <!-- Cash In Breakdown -->
    <div class="card mb-4 shadow-sm border-0">
        <div class="card-body">
            <h4 class="text-success mb-3 text-center">Cash In Breakdown</h4>
            <div class="table-responsive">
                <table class="table table-sm table-bordered align-middle text-center">
                    <thead class="table-light">
                        <tr>
                            <th>Sheet</th>
                            <th>Total Material (AED)</th>
                            <th>Total Shipping Cost (AED)</th>
                            <th>Total (AED)</th>
                        </tr>
                    </thead>
                    <tbody id="cashInBreakdownTable">
                        <!-- Rows dynamically populated -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Cash Summary Cards -->
    <div class="row g-3 mb-4">
        <div class="col-md-4">
            <div class="card border-0 shadow-sm h-100 text-center p-3">
                <div class="card-body">
                    <i class="bi bi-arrow-down-circle-fill text-success fs-2 mb-2"></i>
                    <h5 class="card-title text-success">Cash In</h5>
                    <h3 id="cashInAmount" class="fw-bold">AED 0</h3>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card border-0 shadow-sm h-100 text-center p-3">
                <div class="card-body">
                    <i class="bi bi-arrow-up-circle-fill text-danger fs-2 mb-2"></i>
                    <h5 class="card-title text-danger">Cash Out</h5>
                    <h3 id="cashOutAmount" class="fw-bold">AED 0</h3>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card border-0 shadow-sm h-100 text-center p-3">
                <div class="card-body">
                    <i class="bi bi-cash-coin text-primary fs-2 mb-2"></i>
                    <h5 class="card-title text-primary">Profit</h5>
                    <h3 id="profitAmount" class="fw-bold">AED 0</h3>
                </div>
            </div>
        </div>
    </div>

    <div class="row mt-3 g-3">
        <div class="col-md-4">
            <div class="card border-0 shadow-sm p-3 text-center">
                <div class="fw-bold">Charity (5%)</div>
                <div id="charityAmount" class="text-success">AED 0.00</div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card border-0 shadow-sm p-3 text-center">
                <div class="fw-bold">Shareholder 1</div>
                <div id="shareholder1Amount" class="text-primary">AED 0.00</div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card border-0 shadow-sm p-3 text-center">
                <div class="fw-bold">Shareholder 2</div>
                <div id="shareholder2Amount" class="text-primary">AED 0.00</div>
            </div>
        </div>
    </div>

    <!-- Summary Chart -->
    <div class="card border-0 shadow-sm mb-5">
        <div class="card-body">
            <canvas id="summaryChart" height="140"></canvas>
        </div>
    </div>
</div>