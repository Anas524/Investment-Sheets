<?php

namespace App\Http\Controllers;

use App\Models\CustomerLoanLedgerEntry;
use App\Models\CustomerSheet;
use App\Models\CustomerSheetEntry;
use App\Models\CustomerSheetItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CustomerSheetController extends Controller
{
    public function index()
    {
        $customerSheets = CustomerSheet::with('entries')->get();

        return view('index', [
            'customerSheets' => $customerSheets,  // <- matches index.blade.php
            'activeSheet' => session('activeSheet') ?? 'summary'
        ]);
    }

    public function create(Request $request)
    {
        $request->validate([
            'sheet_name' => 'required|string|max:255|unique:customer_sheets,sheet_name'
        ]);

        $sheet = CustomerSheet::create([
            'sheet_name' => $request->sheet_name
        ]);

        return response()->json(['success' => true, 'id' => $sheet->id]);
    }

    public function storeSheetName(Request $request)
    {
        Log::info('storeSheetName hit', $request->all());
        try {
            $data = $request->validate([
                'sheet_name' => 'required|string|max:255',
            ]);

            $name = strtoupper(trim($data['sheet_name']));

            // Case-insensitive uniqueness
            $exists = CustomerSheet::whereRaw('LOWER(sheet_name) = ?', [strtolower($name)])->exists();
            if ($exists) {
                return response()->json([
                    'success' => false,
                    'message' => 'Sheet name already exists.'
                ], 422);
            }

            $sheet = CustomerSheet::create(['sheet_name' => $name]);

            Log::info('Created customer sheet', ['id' => $sheet->id, 'name' => $sheet->sheet_name]);

            return response()->json([
                'success' => true,
                'message' => 'Customer sheet created successfully',
                'data' => [
                    'id'         => $sheet->id,
                    'sheet_name' => $sheet->sheet_name,
                    'slug'       => Str::slug($sheet->sheet_name),
                ],
            ], 201);
        } catch (\Throwable $e) {
            Log::error('storeSheetName failed', [
                'error'   => $e->getMessage(),
                'trace'   => $e->getTraceAsString(),
                'payload' => $request->all(),
            ]);
            return response()->json(['success' => false, 'message' => 'Server error creating sheet.'], 500);
        }
    }

    public function addEntry(Request $request)
    {
        $request->validate([
            'sheet_id' => 'required|exists:customer_sheets,id',
            'date' => 'required|date',
            'supplier_name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'total_material' => 'nullable|numeric',
            'total_shipping' => 'nullable|numeric',
        ]);

        CustomerSheetEntry::create([
            'customer_sheet_id' => $request->sheet_id,
            'date' => $request->date,
            'supplier_name' => $request->supplier_name,
            'description' => $request->description,
            'total_material' => $request->total_material,
            'total_shipping_cost' => $request->total_shipping,
        ]);

        return response()->json(['success' => true]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'sheet_id' => 'required|exists:customer_sheets,id',
            'date' => 'required|date',
            'supplier' => 'required|string',
            'description' => 'nullable|string',
            'items' => 'nullable|array',
            'total_weight' => 'nullable|numeric',
            'mode_of_transaction' => 'nullable|string',
            'receipt_no' => 'nullable|string',
            'remarks' => 'nullable|string',
        ]);

        // Calculate total_material_buy from items (units * unit_price)
        $totalMaterialBuy = 0.0;
        $totalWeight = 0.0;

        if ($request->has('items') && is_array($request->items)) {
            foreach ($request->items as $item) {
                $units        = (float)($item['units'] ?? 0);
                $unit_price   = (float)($item['unit_price'] ?? 0);
                $item_weight  = (float)($item['total_weight'] ?? 0);

                $totalMaterialBuy += ($units * $unit_price);
                $totalWeight      += $item_weight;
            }
        }

        if ($totalWeight == 0.0 && $request->filled('total_weight')) {
            $totalWeight = (float) preg_replace('/[^\d\.\-]/', '', (string)$request->total_weight);
        }

        $entry = CustomerSheetEntry::create([
            'customer_sheet_id' => $request->sheet_id,
            'date' => $request->date,
            'supplier' => $request->supplier,
            'description' => $request->description,

            'total_material_buy' => $request->total_material_buy,
            'total_weight' => $totalWeight,

            'total_material_without_vat' => $request->total_material_without_vat ?? 0,
            'total_vat' => $request->total_vat ?? 0,
            'shipping_cost' => $request->shipping_cost ?? 0,
            'dgd' => $request->dgd ?? 0,
            'labour' => $request->labour ?? 0,
            'total_shipping_cost' => $request->total_shipping_cost ?? 0,

            'mode_of_transaction' => $request->mode_of_transaction,
            'receipt_no' => $request->receipt_no,
            'remarks' => $request->remarks,

            'total_units' => $request->total_units ?? 0,
        ]);

        if ($request->has('items') && is_array($request->items)) {
            foreach ($request->items as $item) {
                $entry->items()->create([
                    'description' => $item['description'] ?? null,
                    'units' => $item['units'] ?? 0,
                    'unit_price' => $item['unit_price'] ?? 0,
                    'vat' => $item['vat'] ?? 0,
                    'ctns' => $item['ctns'] ?? 0,
                    'weight_per_ctn' => $item['weight_per_ctn'] ?? 0,
                    'total_weight' => $item['total_weight'] ?? 0,
                ]);
            }
        }

        return response()->json(['message' => 'Saved successfully']);
    }

    public function loadCustomerSheet($sheetId)
    {
        try {
            $entries = CustomerSheetEntry::query()
                ->where('customer_sheet_id', $sheetId)
                ->select([
                    'id',
                    'customer_sheet_id',
                    'date',
                    'supplier',
                    'description',
                    'total_material_without_vat',
                    'total_material_buy',
                    'total_shipping_cost',
                    'total_vat',
                    'total_weight',
                    'total_units',
                    'dgd',
                    'labour',
                    'shipping_cost',
                    'mode_of_transaction',
                    'receipt_no',
                    'remarks',
                ])
                // sum weight from items
                ->withSum('items as items_total_weight', 'total_weight')
                // include items (use the correct FK column name here)
                ->with(['items' => function ($q) {
                    $q->select(
                        'id',
                        'entry_id', // <- if your FK is different, change here and in the relation
                        'description',
                        'units',
                        'unit_price',
                        'vat',
                        'ctns',
                        'weight_per_ctn',
                        'total_weight'
                    );
                }])
                ->orderBy('id', 'asc')
                ->get()
                // ensure date is a plain "YYYY-MM-DD" string for data-* attributes
                ->map(function ($e) {
                    $e->date = \Illuminate\Support\Carbon::parse($e->date)->toDateString();
                    return $e;
                });

            // 🔹 Totals for this sheet
            $sumMaterial  = (float) CustomerSheetEntry::where('customer_sheet_id', $sheetId)->sum('total_material_buy');
            $sumShipping  = (float) CustomerSheetEntry::where('customer_sheet_id', $sheetId)->sum('total_shipping_cost');
            $sheetTotal   = $sumMaterial + $sumShipping;

            // 🔹 Loan paid total (if you have the ledger table)
            $loanPaid     = (float) CustomerLoanLedgerEntry::where('customer_sheet_id', $sheetId)->sum('amount');

            // 🔹 Remaining balance = Loan Paid - (Material + Shipping)
            $remaining    = $loanPaid - $sheetTotal;

            return response()->json([
                'status' => 'success',
                'data'   => $entries,
                'totals' => [
                    'material'           => $sumMaterial,
                    'shipping'           => $sumShipping,
                    'sheet_total'        => $sheetTotal,
                    'loan_paid'          => $loanPaid,
                    'remaining_balance'  => $remaining,
                ],
            ]);
        } catch (\Throwable $e) {
            // temporary: make debugging easier
            Log::error('loadCustomerSheet error', ['e' => $e->getMessage()]);
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request)
    {
        Log::info('UPDATE payload', $request->all());

        $request->validate([
            'id'          => 'required|exists:customer_sheet_entries,id',
            'sheet_id'    => 'required|exists:customer_sheets,id',
            'date'        => 'required|date',
            'supplier'    => 'required|string',
            'description' => 'nullable|string',
            'items'       => 'nullable|array',

            'mode_of_transaction' => 'nullable|string',
            'receipt_no'          => 'nullable|string',
            'remarks'             => 'nullable|string',

            'total_material_without_vat' => 'nullable|numeric',
            'total_material_buy'         => 'nullable|numeric',
            'total_vat'                  => 'nullable|numeric',
            'shipping_cost'              => 'nullable|numeric',
            'dgd'                        => 'nullable|numeric',
            'labour'                     => 'nullable|numeric',
            'total_shipping_cost'        => 'nullable|numeric',
            'total_weight'               => 'nullable|numeric',
            'total_units'                => 'nullable|numeric',
        ]);

        $entry = \App\Models\CustomerSheetEntry::findOrFail($request->id);

        // ---- Recompute from items (source of truth) ----
        $exVatSum   = 0.0; // Total Material w/out VAT
        $weightSum  = 0.0;

        if (is_array($request->items)) {
            foreach ($request->items as $item) {
                $units       = (float)($item['units'] ?? 0);
                $unit_price  = (float)($item['unit_price'] ?? 0);
                $rowWeight   = (float)($item['total_weight'] ?? 0);

                $exVatSum  += ($units * $unit_price);
                $weightSum += $rowWeight;
            }
        }

        // Fallbacks: if client didn’t send items or values are missing/blank,
        // use what's in the request *only if numeric*, otherwise keep computed.
        $tmwv = $request->input('total_material_without_vat'); // may be '', null, "3300", etc.
        if ($tmwv === null || $tmwv === '' || !is_numeric($tmwv)) {
            $tmwv = $exVatSum;
        } else {
            $tmwv = (float)$tmwv;
        }

        // If you also want to trust client for "buy", keep this pattern; otherwise compute your own.
        $tmb = $request->input('total_material_buy');
        if ($tmb === null || $tmb === '' || !is_numeric($tmb)) {
            // If you don't have a server-side VAT calc, default buy to exVat.
            $tmb = $exVatSum;
        } else {
            $tmb = (float)$tmb;
        }

        $tWeight = $weightSum > 0 ? $weightSum : (float)($request->input('total_weight') ?: 0);

        $entry->update([
            'customer_sheet_id'          => $request->sheet_id,
            'date'                       => $request->date,
            'supplier'                   => $request->supplier,
            'description'                => $request->description,

            'total_material_without_vat' => $tmwv,            // <- robust
            'total_material_buy'         => $tmb,
            'total_vat'                  => (float)($request->input('total_vat') ?: 0),
            'shipping_cost'              => (float)($request->input('shipping_cost') ?: 0),
            'dgd'                        => (float)($request->input('dgd') ?: 0),
            'labour'                     => (float)($request->input('labour') ?: 0),
            'total_shipping_cost'        => (float)($request->input('total_shipping_cost') ?: 0),
            'total_units'                => (float)($request->input('total_units') ?: 0),
            'total_weight'               => $tWeight,

            'mode_of_transaction'        => $request->mode_of_transaction,
            'receipt_no'                 => $request->receipt_no,
            'remarks'                    => $request->remarks,
        ]);

        // Replace items
        if (is_array($request->items)) {
            $entry->items()->delete();
            foreach ($request->items as $item) {
                $entry->items()->create([
                    'description'    => $item['description'] ?? null,
                    'units'          => $item['units'] ?? 0,
                    'unit_price'     => $item['unit_price'] ?? 0,
                    'vat'            => $item['vat'] ?? 0,
                    'ctns'           => $item['ctns'] ?? 0,
                    'weight_per_ctn' => $item['weight_per_ctn'] ?? 0,
                    'total_weight'   => $item['total_weight'] ?? 0,
                ]);
            }
        }

        return response()->json(['message' => 'Updated successfully']);
    }

    public function updateSheet(Request $request)
    {
        $validated = $request->validate([
            'id'         => 'required|exists:customer_sheets,id',
            'sheet_name' => 'required|string',
        ]);

        \App\Models\CustomerSheet::where('id', $validated['id'])
            ->update(['sheet_name' => $validated['sheet_name']]);

        return response()->json(['message' => 'Sheet updated']);
    }

    public function deleteEntry($id)
    {
        try {
            $entry = CustomerSheetEntry::with('items')->findOrFail($id);

            // Delete related items first
            $entry->items()->delete();

            // Then delete the entry itself
            $entry->delete();

            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    public function section(CustomerSheet $sheet)
    {
        // Render your existing partial (the same one you include on first page load)
        // Make sure this partial outputs the cards, table header and a hidden .customer-sheet-id field
        $html = view('sheets.customer_sheet', [
            'sheetId'   => $sheet->id,
            'sheetName' => $sheet->sheet_name,
        ])->render();

        return response($html, 200)->header('Content-Type', 'text/html; charset=UTF-8');
    }
}
