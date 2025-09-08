<?php

use App\Http\Controllers\BeneficiaryController;
use App\Http\Controllers\CustomerLoanLedgerController;
use App\Http\Controllers\CustomerSheetAttachmentController;
use App\Http\Controllers\CustomerSheetController;
use App\Http\Controllers\CustomerSheetEntryController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\GtsInvestmentController;
use App\Http\Controllers\GtsMaterialController;
use App\Http\Controllers\InvestmentController;
use App\Http\Controllers\LocalSalesController;
use App\Http\Controllers\USClientController;
use App\Http\Controllers\SQClientController;
use App\Http\Controllers\SummaryController;
use App\Http\Controllers\UserPreferenceController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Homepage
Route::get('/', [InvestmentController::class, 'index'])->name('index');

// Materials
Route::get('/gts-materials', [GtsMaterialController::class, 'index']);
Route::post('/gts-materials', [GtsMaterialController::class, 'store']);
Route::put('/gts-materials/{id}', [GtsMaterialController::class, 'update']);
Route::delete('/gts-materials/{id}', [GtsMaterialController::class, 'destroy']);
Route::delete('/gts-materials/items/{id}', [GtsMaterialController::class, 'deleteItem']);

Route::post('/gts-materials/upload-attachments/{id}', [GtsMaterialController::class, 'uploadAttachments']);
Route::get('/gts-materials/get-attachments/{id}', [GtsMaterialController::class, 'getAttachments']);
Route::get('/gts-materials/download-pdf/{id}', [GtsMaterialController::class, 'downloadAttachments']);

// Investments
Route::get('/investments', [GtsInvestmentController::class, 'index'])->name('investments.index');
Route::post('/investments', [GtsInvestmentController::class, 'store'])->name('investments.store');
Route::put('/investments/{id}', [GtsInvestmentController::class, 'update'])->name('investments.update');
Route::post('/investments/{id}/finalize', [GtsInvestmentController::class, 'finalize'])->name('investments.finalize');
Route::delete('/investments/{id}', [GtsInvestmentController::class, 'destroy']);

Route::get('/gts-investments/total', [GtsInvestmentController::class, 'getTotalAmount']);

Route::post('/investment/{id}/murabaha', [GtsInvestmentController::class, 'updateMurabaha']);

Route::post('/investment/{id}/upload-attachments', [GtsInvestmentController::class, 'uploadAttachments']);
Route::get('/investment/{id}/attachments', [GtsInvestmentController::class, 'getAttachments']);
Route::get('/investment/{id}/attachments/download', [GtsInvestmentController::class, 'downloadAttachments']);

// US CLIENT PAYMENT SHEET ROUTES
Route::get('/us-client/data', [USClientController::class, 'index']);
Route::post('/us-client/save', [USClientController::class, 'store']);
Route::put('/us-client/update/{id}', [USClientController::class, 'update']);
Route::delete('/us-client/delete/{id}', [USClientController::class, 'destroy']);

// SQ SHEET ROUTES
Route::get('/sq-client/data', [SQClientController::class, 'index']);
Route::post('/sq-client/save', [SQClientController::class, 'store']);
Route::put('/sq-client/update/{id}', [SQClientController::class, 'update']);
Route::delete('/sq-client/delete/{id}', [SQClientController::class, 'destroy']);

// Local Sales ROUTES
Route::get('/local-sales',            [LocalSalesController::class, 'index']);
Route::post('/local-sales',            [LocalSalesController::class, 'store']);
Route::put('/local-sales/{local}',    [LocalSalesController::class, 'update']);
Route::delete('/local-sales/{local}',    [LocalSalesController::class, 'destroy']);
Route::get('/local-sales/{local}/items', [LocalSalesController::class, 'items'])
    ->name('local-sales.items');

Route::prefix('local-sales/{local}')->group(function () {
    Route::post('attachments',       [LocalSalesController::class, 'uploadAttachments']);
    Route::get('attachments',       [LocalSalesController::class, 'getAttachments']);
    Route::get('attachments/pdf',   [LocalSalesController::class, 'downloadAttachments']);
});

// Summary Sheet
Route::get('/summary/cash-out', [SummaryController::class, 'getCashOut']);
Route::get('/summary-data', [SummaryController::class, 'getSummaryData']);
// Cash In Breakdown Route
Route::get('/summary/cash-in-breakdown', [SummaryController::class, 'getCashInBreakdown']);
Route::get('/summary/sq/total', [SummaryController::class, 'sqTotal']);
Route::get('/summary/local-sales/total', [SummaryController::class, 'localSalesTotal']);

// Create customer sheet
Route::post('/customer/sheets/create', [CustomerSheetController::class, 'storeSheetName'])->name('customer.sheets.create');

Route::get('/dashboard', function () {
    return redirect()->route('index');
})->name('dashboard');

Route::get('/customer/sheet/data/{sheet}', [CustomerSheetController::class, 'getSheetData']);

Route::post('/customer/sheet/entry/store', [CustomerSheetController::class, 'storeEntry'])->name('customer.sheet.entry.store');

// DEPRECATED – remove after confirming no traffic
Route::post('/update-customer-sheet', function (Illuminate\Http\Request $request) {
    Log::warning('DEPRECATED /update-customer-sheet used', [
        'ip' => $request->ip(),
        'ua' => $request->userAgent(),
    ]);
    return app(\App\Http\Controllers\CustomerSheetController::class)->update($request);
})->name('customer.update');


Route::post('/sheet/create', [CustomerSheetController::class, 'create'])->name('sheet.create');
Route::post('/sheet/entry', [CustomerSheetController::class, 'addEntry'])->name('sheet.addEntry');

Route::post('/customer-sheet/store', [CustomerSheetController::class, 'store']);
Route::get('/customer-sheet/load/{sheetId}', [CustomerSheetController::class, 'loadCustomerSheet']);
Route::delete('/customer-sheet/delete-entry/{id}', [CustomerSheetController::class, 'deleteEntry']);

Route::get('/customer-sheet/{sheetId}/entries', [CustomerSheetController::class, 'entries']);

Route::post('/customer-sheet/entry/update', [CustomerSheetController::class, 'update'])
    ->name('customer.entry.update');

Route::prefix('customer-sheet')->group(function () {
    // for loan ledger
    Route::get('{sheet}/loan-ledger', [CustomerLoanLedgerController::class, 'index'])->name('loan_ledger.index');
    Route::post('{sheet}/loan-ledger', [CustomerLoanLedgerController::class, 'store'])->name('loan_ledger.store');
    Route::put('loan-ledger/{id}', [CustomerLoanLedgerController::class, 'update'])->name('loan_ledger.update');
    Route::delete('loan-ledger/{id}', [CustomerLoanLedgerController::class, 'destroy'])->name('loan_ledger.destroy');

    // for customer attachment
    Route::get('{entry}/attachments/download-all', [CustomerSheetAttachmentController::class, 'downloadAll'])->name('customer.attach.downloadAll');
    Route::get('{entry}/attachments', [CustomerSheetAttachmentController::class, 'index'])->name('customer.attach.index');
    Route::post('{entry}/attachments', [CustomerSheetAttachmentController::class, 'store'])->name('customer.attach.store');
    Route::delete('attachments/{id}', [CustomerSheetAttachmentController::class, 'destroy'])->name('customer.attach.destroy');
});

Route::get('/summary/customer-sheets/totals', [SummaryController::class, 'customerSheetTotals']);
Route::get('/summary/customer-sheets/rows',   [SummaryController::class, 'customerSheetRows'])
    ->name('summary.customerSheets.rows');
Route::get(
    '/summary/customer-sheets/loans',
    [SummaryController::class, 'customerSheetLoans']
)->name('summary.customerSheets.loans');

Route::prefix('beneficiaries')->group(function () {
    Route::get('/',            [BeneficiaryController::class, 'index']);    // optional: page route
    Route::get('/data',        [BeneficiaryController::class, 'data']);     // JSON for all 3
    Route::post('/',           [BeneficiaryController::class, 'store']);    // add one
    Route::delete('/{id}',     [BeneficiaryController::class, 'destroy']);  // delete one
    Route::put('/{id}',        [BeneficiaryController::class, 'update']);   // edit and update
});

Route::get('/customer-sheet/section/{sheet}', [CustomerSheetController::class, 'section'])
    ->name('customer.sheet.section');


Route::get('/gts-materials/total', function (Request $request) {
    $table = 'gts_materials';
    if (!Schema::hasTable($table)) {
        return response()->json(['message' => "Table '$table' does not exist"], 500);
    }

    $cols = Schema::getColumnListing($table);
    $q = DB::table($table);

    // --- make server totals match the list ---

    // 1) Exclude soft-deleted and “deleted” flags if present
    if (in_array('deleted_at', $cols)) $q->whereNull('deleted_at');
    foreach (['deleted','is_deleted','archived'] as $flag) {
        if (in_array($flag, $cols)) $q->where($flag, 0);
    }

    // 2) Optional: only “posted” rows when requested
    if ($request->boolean('only_posted')) {
        if (in_array('posted', $cols)) {
            $q->where('posted', 1);
        } elseif (in_array('is_posted', $cols)) {
            $q->where('is_posted', 1);
        } elseif (in_array('status', $cols)) {
            $q->whereIn('status', ['posted','approved','completed']);
        }
    }

    // 3) EXACT columns used by Materials header cards
    $materialCol = in_array('total_material_buy', $cols)
        ? 'total_material_buy'
        : (in_array('total_material', $cols) ? 'total_material' : null);
    $material = $materialCol ? (clone $q)->sum($materialCol) : 0;

    // shipping = total_shipping_cost if present, else parts
    $shipExpr = in_array('total_shipping_cost', $cols)
        ? 'COALESCE(total_shipping_cost,0)'
        : implode('+', array_map(fn($c) => "COALESCE($c,0)",
            array_values(array_filter(['shipping_cost','dgd','labour'], fn($c)=>in_array($c,$cols)))
          ));
    $shipping = (float) (clone $q)->sum(DB::raw($shipExpr));

    return response()->json([
        'material'   => round($material, 2),
        'shipping'   => round($shipping, 2),
        'investment' => 0,
        // optional debug to compare with the list
        '_debug' => [
            'matchedRows'  => (clone $q)->count(),
            'materialCol'  => $materialCol,
            'shippingExpr' => $shipExpr,
        ],
    ]);
})->name('gts.totals');