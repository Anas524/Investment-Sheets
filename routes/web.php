<?php

use App\Http\Controllers\BLClientController;
use App\Http\Controllers\FFClientController;
use App\Http\Controllers\InvestmentController;
use App\Http\Controllers\LocalSalesController;
use App\Http\Controllers\RHClientController;
use App\Http\Controllers\USClientController;
use App\Http\Controllers\SQClientController;
use App\Http\Controllers\SummaryController;
use Illuminate\Support\Facades\Route;

// GTS Investment Sheet Routes
Route::get('/', [InvestmentController::class, 'index']);
Route::post('/save-investment', [InvestmentController::class, 'saveInvestment']);
Route::put('/update-investment/{id}', [InvestmentController::class, 'updateInvestment']);
Route::delete('/delete-investment/{id}', [InvestmentController::class, 'deleteInvestment']);
Route::get('/get-investment/{id}', [InvestmentController::class, 'getInvestment']);

Route::post('/upload-attachments/{id}', [InvestmentController::class, 'uploadAttachment']);
Route::get('/get-attachments/{id}', [InvestmentController::class, 'getAttachments']);

Route::delete('/delete-investment-by-invoice/{invoice}', [InvestmentController::class, 'deleteByInvoice'])
    ->where('invoice', '.*');

Route::get('/get-investment-by-invoice/{invoice}/{sub_serial}', [InvestmentController::class, 'getByInvoiceAndSubSerial']);

Route::post('/store-multiple-entry', [InvestmentController::class, 'storeMultipleEntry'])->name('store.multiple.entry');

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

// RH SHEET ROUTES
Route::get('/rh-client/data', [RHClientController::class, 'index']);
Route::post('/rh-client/save-group', [RHClientController::class, 'saveRHClient']);
Route::put('/rh-client/update/{id}', [RHClientController::class, 'updateRHClient']);
Route::delete('/rh-client/delete/{id}', [RHClientController::class, 'destroy']);

Route::post('/rh-client/save-multiple', [RHClientController::class, 'saveMultiple']);
Route::post('/rh-client/save', [RHClientController::class, 'store']);
Route::post('/rh-client/delete-multiple', [RHClientController::class, 'deleteMultiple']);

Route::get('/rh-client/data-all', [RHClientController::class, 'getAllEntries']);

Route::get('/rh-client/get-subentry/{id}/{sub_serial}', [RHClientController::class, 'getSubEntry']);
Route::put('/rh-client/update-subentry/{id}/{sub_serial}', [RHClientController::class, 'updateSubEntry']);

Route::get('/rh-client/resequence', [RHClientController::class, 'resequenceSrNo']);

Route::post('/rh-loan/save', [RHClientController::class, 'storeLoan']);
Route::get('/rh-loan/entries', [RHClientController::class, 'getLoanEntries']);
Route::delete('/rh-loan/delete/{id}', [RHClientController::class, 'deleteLoan']);
Route::put('/rh-loan/update/{id}', [RHClientController::class, 'updateLoan']);

// FF SHEET ROUTES
Route::get('/ff-client/data', [FFClientController::class, 'index']);
Route::post('/ff-client/save-entry-manual', [FFClientController::class, 'saveFFClient']);
Route::put('/ff-client/update/{id}', [FFClientController::class, 'updateFFClient']);
Route::delete('/ff-client/delete/{id}', [FFClientController::class, 'destroy']);

Route::post('/ff-client/save-multiple', [FFClientController::class, 'saveMultiple']);
Route::post('/ff-client/save', [FFClientController::class, 'store']);
Route::post('/ff-client/delete-multiple', [FFClientController::class, 'deleteMultiple']);

Route::get('/ff-client/data-all', [FFClientController::class, 'getAllEntries']);

Route::get('/ff-client/get-subentry/{id}/{sub_serial}', [FFClientController::class, 'getSubEntry']);
Route::put('/ff-client/update-subentry/{id}/{sub_serial}', [FFClientController::class, 'updateSubEntry']);

Route::get('/ff-client/resequence', [FFClientController::class, 'resequenceSrNo']);

// BL SHEET ROUTES
Route::get('/bl-client/data', [BLClientController::class, 'index']);
Route::post('/bl-client/save-entry-manual', [BLClientController::class, 'saveBLClient']);
Route::put('/bl-client/update/{id}', [BLClientController::class, 'updateBLClient']);
Route::delete('/bl-client/delete/{id}', [BLClientController::class, 'destroy']);

Route::post('/bl-client/save-multiple', [BLClientController::class, 'saveMultiple']);
Route::post('/bl-client/save', [BLClientController::class, 'store']);
Route::post('/bl-client/delete-multiple', [BLClientController::class, 'deleteMultiple']);

Route::get('/bl-client/data-all', [BLClientController::class, 'getAllEntries']);

Route::get('/bl-client/get-subentry/{id}/{sub_serial}', [BLClientController::class, 'getSubEntry']);
Route::put('/bl-client/update-subentry/{id}/{sub_serial}', [BLClientController::class, 'updateSubEntry']);

Route::get('/bl-client/resequence', [BLClientController::class, 'resequenceSrNo']);

// Local Sales ROUTES
Route::post('/local-sales/store-multiple', [LocalSalesController::class, 'storeMultiple'])->name('local-sales.store-multiple');
Route::post('/local-sales/save', [LocalSalesController::class, 'store'])->name('local-sales.store');
Route::get('/local-sales/data', [LocalSalesController::class, 'index']);

Route::post('/local-sales/delete', [LocalSalesController::class, 'delete'])->name('local-sales.delete');
Route::delete('/local-sales/delete/{sr_no}/{sub_serial}', [LocalSalesController::class, 'destroyMultiple']);

Route::post('/local-sales/update/{id}', [LocalSalesController::class, 'update']);

// Summary Sheet
Route::get('/summary/cash-out', [SummaryController::class, 'getCashOut']);
Route::get('/summary-data', [SummaryController::class, 'getSummaryData']);
// Cash In Breakdown Route
Route::get('/summary/cash-in-breakdown', [SummaryController::class, 'getCashInBreakdown']);

