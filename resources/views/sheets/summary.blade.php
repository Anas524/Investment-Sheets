<div class="max-w-7xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h2 class="text-2xl font-bold tracking-tight">Summary Overview</h2>

        <button id="openCreateCustomerModalBtn"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <span class="text-lg leading-none">＋</span>
            <span>Create Customer Sheet</span>
        </button>
    </div>

    <!-- KPI ROW (sticky) -->
    <div id="kpiSticky" class="sticky top-0 z-40 mb-6">
        <!-- Backdrop shown only when stuck -->
        <div class="kpi-backdrop pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200"></div>

        <!-- Content -->
        <div class="relative px-4 py-3">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Cash In -->
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-3">
                    <span class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-700">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                        </svg>
                    </span>
                    <div>
                        <div class="text-xs uppercase tracking-wider text-green-700 font-medium">Cash In</div>
                        <div id="cashInAmount" class="text-2xl font-bold text-gray-900">AED 0</div>
                    </div>
                </div>

                <!-- Cash Out -->
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-3">
                    <span class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m11.99 16.5-3.75 3.75m0 0L4.49 16.5m3.75 3.75V3.75h11.25" />
                        </svg>
                    </span>
                    <div>
                        <div class="text-xs uppercase tracking-wider text-red-700 font-medium">Cash Out</div>
                        <div id="cashOutAmount" class="text-2xl font-bold text-gray-900">AED 0</div>
                    </div>
                </div>

                <!-- Profit -->
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-3">
                    <span class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                        </svg>
                    </span>
                    <div>
                        <div class="text-xs uppercase tracking-wider text-blue-700 font-medium">Profit</div>
                        <div id="profitAmount" class="text-2xl font-bold text-gray-900">AED 0</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- BIG CHART FULL WIDTH -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 h-[24rem]">
        <canvas id="summaryChart" class="w-full h-full"></canvas>
    </div>

    <!-- SPLIT: LEFT (Cash Out) | RIGHT (Cash In Breakdown) -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <!-- LEFT: Cash In Breakdown -->
        <div class="md:col-span-6 space-y-4">
            <div class="flex items-baseline justify-between">
                <h2 class="text-xl font-semibold">Cash In Breakdown</h2>
                <span class="text-sm text-gray-500">Live from sheet totals</span>
            </div>

            <!-- Grand Total -->
            <!-- <div class="bg-white rounded-2xl shadow p-5 border-l-4 border-blue-700 flex items-center justify-between">
                <div class="text-gray-500 font-medium text-sm">Grand Total (Cash In)</div>
                <div id="cashInGrandTotal" class="text-2xl font-bold text-blue-700">AED 0.00</div>
            </div> -->

            <!-- Row-wise list -->
            <div id="cashInBreakdownGrid" class="space-y-3"></div>

            <!-- Customer Sheets Breakdown (table) -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div class="px-5 py-3 border-b">
                    <h3 class="text-lg font-semibold text-green-700 text-center">Customer Sheets Breakdown</h3>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50 text-gray-700">
                            <tr>
                                <th class="text-left font-semibold px-4 py-3">Sheet</th>
                                <th class="text-right font-semibold px-4 py-3">Total Material (AED)</th>
                                <th class="text-right font-semibold px-4 py-3">Total Shipping Cost (AED)</th>
                                <th class="text-right font-semibold px-4 py-3">Total (AED)</th>
                            </tr>
                        </thead>
                        <tbody id="customerSheetsTableBody" class="divide-y divide-gray-100"></tbody>
                        <tfoot>
                            <tr class="bg-green-50">
                                <td class="px-4 py-3 text-right font-semibold" colspan="3">Grand Total:</td>
                                <td id="customerSheetsTableGrand" class="px-4 py-3 text-right font-extrabold text-green-700">AED 0.00</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>

        <!-- RIGHT: Cash Out Summary -->
        <div class="md:col-span-6 space-y-4">
            <h2 class="text-xl font-semibold">Cash Out Summary</h2>
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="rounded-xl border border-gray-100 p-4 text-center">
                        <div class="text-xs uppercase tracking-wider text-gray-500 mb-1">Total Purchase of Material</div>
                        <div id="totalPurchaseMaterial" class="text-xl font-bold text-gray-900">Loading…</div>
                    </div>
                    <div class="rounded-xl border border-gray-100 p-4 text-center">
                        <div class="text-xs uppercase tracking-wider text-gray-500 mb-1">Total Shipping Cost</div>
                        <div id="totalShippingCost" class="text-xl font-bold text-gray-900">Loading…</div>
                    </div>
                </div>
            </div>
            <!-- Loan Ledger – Outstanding (only if > 0) -->
            <div id="loanOutstandingSection" class="space-y-3">
                <h2 class="text-xl font-semibold">Loan Ledger – Outstanding Balances</h2>
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 text-gray-700">
                                <tr>
                                    <th class="text-left font-semibold px-4 py-3">Customer Sheet</th>
                                    <th class="text-right font-semibold px-4 py-3">Remaining Balance (AED)</th>
                                </tr>
                            </thead>
                            <tbody id="loanOutstandingBody" class="divide-y divide-gray-100"></tbody>
                            <tfoot>
                                <tr class="bg-blue-50">
                                    <td class="px-4 py-3 text-right font-semibold">Grand Total:</td>
                                    <td id="loanOutstandingGrand" class="px-4 py-3 text-right font-extrabold text-blue-700">AED 0.00</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Create Customer Sheet Modal (unchanged IDs so your existing JS keeps working) -->
<div id="createCustomerSheetModal"
    class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">Create New Customer Sheet</h2>
            <button id="cancelCustomerSheetModalBtn"
                class="rounded-full h-8 w-8 grid place-items-center hover:bg-gray-100">
                <span class="sr-only">Close</span>
                ✕
            </button>
        </div>

        <form id="createCustomerSheetForm" class="space-y-5">
            <div>
                <label class="block text-sm font-medium mb-1">Sheet Name</label>
                <input type="text" id="newCustomerSheetName"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="e.g., RH" required>
            </div>

            <div class="flex justify-end gap-2">
                <button type="button" id="cancelCustomerSheetModalBtn"
                    class="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
                    Cancel
                </button>
                <button type="submit"
                    class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
                    Create
                </button>
            </div>
        </form>
    </div>
</div>