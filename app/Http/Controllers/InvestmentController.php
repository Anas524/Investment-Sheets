<?php

namespace App\Http\Controllers;

use App\Models\Investment;
use App\Models\USClient;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\log;

class InvestmentController extends Controller
{
    public function index()
    {
        // Get all customer sheets with id and name
        $customerSheets = \App\Models\CustomerSheet::select('id', 'sheet_name')->get();

        // Extract sheet names (for JS dropdown etc.)
        $sheetNames = $customerSheets->pluck('sheet_name');

        // Store or get the active sheet
        $activeSheet = request('activeSheet', session('activeSheet', 'summary'));
        session(['activeSheet' => $activeSheet]);

        return view('index', [
            'totalAmount' => \App\Models\USClient::sum('amount'),
            'customerSheets' => $customerSheets,   // used in @foreach in Blade
            'sheetNames' => $sheetNames,           // used in <script id="customerSheetsData">
            'activeSheet' => $activeSheet,
        ]);
    }

    public function saveInvestment(Request $request)
    {
        $total_units = $request->total_units ?? (($request->units_per_ctn ?? 0) * ($request->no_of_ctns ?? 0));

        $total_material = ($request->unit_price ?? 0) * $total_units;

        $vat_percentage = $request->vat_percentage ?? 0;
        $vat_amount = ($vat_percentage > 0 && $total_units > 0 && $request->unit_price > 0)
            ? ($request->unit_price * $total_units) * ($vat_percentage / 100)
            : 0;
        $total_material_including_vat = $total_material + $vat_amount;

        $shipping_rate_per_kg = $request->shipping_rate_per_kg ?? 20;
        $shipping_rate = ($request->no_of_ctns ?? 0) * ($request->weight ?? 0) * $shipping_rate_per_kg;
        $dgd = (135 / 15) * ($request->no_of_ctns ?? 0);
        $labour = ($request->no_of_ctns ?? 0) * 10;
        $shipping_cost = $shipping_rate + $dgd + $labour;

        $total_material_grand = Investment::sum('total_material') + $total_material;
        $total_shipment_grand = Investment::sum('shipping_cost') + $shipping_cost;
        $grand_total_final = $total_material_grand + $total_shipment_grand;

        // Multiple entry logic
        $sub_serial = null;
        $invoice_number = $request->invoice_number;
        $original_invoice = $invoice_number;

        $existingEntries = Investment::where('invoice_number', $invoice_number)->orderBy('id')->get();

        if ($request->multiple_entry) {
            // Always treat this as a new group (do not modify invoice_number)
            $sub_serial = $existingEntries->count() + 1;
        } else {
            // For normal entry, if same invoice exists, make unique invoice
            if ($existingEntries->isNotEmpty()) {
                $invoice_number = $invoice_number . '-copy-' . time();
            }
            $sub_serial = null; // No sub_serial for normal entries
        }

        Investment::create([
            'date' => Carbon::parse($request->date)->format('Y-m-d'),
            'supplier_name' => $request->supplier_name,
            'buyer' => $request->buyer,
            'invoice_number' => $invoice_number,
            'transaction_mode' => $request->transaction_mode,
            'unit_price' => $request->unit_price,
            'description' => $request->description,
            'no_of_ctns' => $request->no_of_ctns,
            'units_per_ctn' => $request->units_per_ctn,
            'total_units' => $total_units,
            'weight' => $request->weight,
            'vat_percentage' => $vat_percentage,
            'shipping_rate_per_kg' => $shipping_rate_per_kg,
            'vat_amount' => $vat_amount,
            'total_material' => $total_material,
            'total_material_including_vat' => $total_material_including_vat,
            'shipping_rate' => $shipping_rate,
            'dgd' => $dgd,
            'labour' => $labour,
            'shipping_cost' => $shipping_cost,
            'total_material_grand' => $total_material_grand,
            'total_shipment_grand' => $total_shipment_grand,
            'grand_total_final' => $grand_total_final,
            'remarks' => $request->remarks,
            'sub_serial' => $sub_serial,
        ]);

        return response()->json([
            'success' => true,
            'invoice_number' => $invoice_number,
            'sub_serial' => $sub_serial
        ]);
    }

    public function updateInvestment(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'date' => 'nullable|date',
            'supplier_name' => 'nullable|string',
            'buyer' => 'nullable|string',
            'invoice_number' => 'nullable|string',
            'transaction_mode' => 'nullable|string',
            'unit_price' => 'nullable|numeric',
            'description' => 'nullable|string',
            'no_of_ctns' => 'nullable|numeric',
            'units_per_ctn' => 'nullable|numeric',
            'weight' => 'nullable|numeric',
            'shipping_rate_per_kg' => 'nullable|numeric',
            'remarks' => 'nullable|string',
            'vat_percentage' => 'nullable|numeric',
            'sub_serial' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $investment = Investment::find($id);
        if (!$investment) {
            return response()->json(['error' => 'Investment entry not found.'], 404);
        }

        // Calculate totals FIRST
        $total_units = $request->total_units ?? (($request->units_per_ctn ?? 0) * ($request->no_of_ctns ?? 0));

        $unit_price = $request->unit_price ?? 0;
        $total_material = $unit_price > 0 && $total_units > 0 ? $unit_price * $total_units : ($unit_price ?: 0);
        $vat_percentage = $request->vat_percentage ?? 0;
        $vat_amount = ($vat_percentage > 0 && $total_units > 0 && $request->unit_price > 0)
            ? ($request->unit_price * $total_units) * ($vat_percentage / 100)
            : 0;
        $total_material_including_vat = $total_material + $vat_amount;

        $shipping_rate = $request->no_of_ctns * $request->weight * $request->shipping_rate_per_kg;
        $dgd = (135 / 15) * $request->no_of_ctns;
        $labour = $request->no_of_ctns * 10;
        $shipping_cost = $shipping_rate + $dgd + $labour;

        $investment->update([
            'date' => $request->date,
            'supplier_name' => $request->supplier_name,
            'buyer' => $request->buyer,
            'invoice_number' => $request->invoice_number,
            'transaction_mode' => $request->transaction_mode,
            'unit_price' => $unit_price,
            'description' => $request->description,
            'no_of_ctns' => $request->no_of_ctns,
            'units_per_ctn' => $request->units_per_ctn,
            'total_units' => $total_units,
            'weight' => $request->weight,
            'vat_percentage' => $vat_percentage,
            'vat_amount' => $vat_amount,
            'total_material' => $total_material,
            'total_material_including_vat' => $total_material_including_vat,
            'shipping_rate_per_kg' => $request->shipping_rate_per_kg,
            'shipping_rate' => $shipping_rate,
            'dgd' => $dgd,
            'labour' => $labour,
            'shipping_cost' => $shipping_cost,
            'remarks' => $request->remarks,
        ]);

        return response()->json(['message' => 'Investment entry updated successfully.']);
    }

    public function deleteInvestment(Request $request, $id)
    {
        $subSerial = $request->query('sub_serial');

        if ($subSerial) {
            $investment = Investment::where('id', $id)
                ->where('sub_serial', $subSerial)
                ->first();

            if (!$investment) {
                return response()->json(['error' => 'Sub-serial not found'], 404);
            }
        } else {
            $investment = Investment::find($id);
        }

        if (!$investment) {
            return response()->json(['error' => 'Record not found'], 404);
        }

        $investment->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    public function deleteByInvoice(Request $request, $invoice)
    {
        $subSerial = $request->query('sub_serial');

        if (strtolower($subSerial) === 'all') {
            Investment::where('invoice_number', $invoice)->delete();
            return response()->json(['message' => 'All entries deleted successfully']);
        }

        if (!is_numeric($subSerial)) {
            return response()->json(['error' => 'Invalid sub-serial value'], 422);
        }

        $entry = Investment::where('invoice_number', $invoice)
            ->where('sub_serial', $subSerial)
            ->first();

        if (!$entry) {
            return response()->json(['error' => "No entry found with sub-serial {$subSerial} for invoice {$invoice}"], 404);
        }

        $entry->delete();

        // Reorder sub_serials after deleteion
        $remaining = Investment::where('invoice_number', $invoice)
            ->whereNotNull('sub_serial')
            ->orderBy('id')
            ->get();

        $newSubSerial = 1;
        foreach ($remaining as $item) {
            $item->update(['sub_serial' => $newSubSerial++]);
        }
        return response()->json(['message' => 'Sub-entry deleted and sub-serials reordered']);
    }

    public function getInvestment($id)
    {
        $investment = Investment::find($id);
        return response()->json($investment);
    }

    public function uploadAttachment(Request $request, $id)
    {
        $investment = Investment::find($id);
        if (!$investment) {
            return response()->json(['error' => 'Record not found'], 404);
        }

        if ($request->hasFile('invoice')) {
            $invoicePath = $request->file('invoice')->store('attachments/invoice', 'public');
            $investment->invoice_path = $invoicePath;
        }

        if ($request->hasFile('receipt')) {
            $receiptPath = $request->file('receipt')->store('attachments/receipt', 'public');
            $investment->receipt_path = $receiptPath;
        }

        if ($request->hasFile('note')) {
            $notePath = $request->file('note')->store('attachments/note', 'public');
            $investment->note_path = $notePath;
        }

        $investment->save();

        return response()->json(['message' => 'Attachments uploaded successfully!']);
    }

    public function getAttachments($id)
    {
        $investment = Investment::find($id);

        if (!$investment) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json([
            'invoice' => $investment->invoice_path ? Storage::url($investment->invoice_path) : null,
            'receipt' => $investment->receipt_path ? Storage::url($investment->receipt_path) : null,
            'note'    => $investment->note_path ? Storage::url($investment->note_path) : null,
        ]);
    }

    public function getByInvoiceAndSubSerial($invoice, $subSerial)
    {
        if (!$invoice || !$subSerial) {
            return response()->json(['error' => 'Missing invoice or sub_serial'], 422);
        }

        $entry = Investment::where('invoice_number', $invoice)
            ->where('sub_serial', $subSerial)
            ->first();

        if (!$entry) {
            return response()->json(['error' => 'Entry not found'], 404);
        }

        return response()->json($entry);
    }

    public function storeMultipleEntry(Request $request)
    {
        try {
            $entries = $request->entries;

            foreach ($entries as $index => $entry) {
                $unitPrice = $entry['unit_price'] ?? 0;
                $ctns = $entry['no_of_ctns'] ?? 0;
                $unitsPerCtn = $entry['units_per_ctn'] ?? 0;
                $totalUnits = $entry['total_units'] ?? (($unitsPerCtn > 0 && $ctns > 0) ? $unitsPerCtn * $ctns : 0);
                $weight = $entry['weight'] ?? 0;
                $shippingRate = $entry['shipping_rate'] ?? 0;
                $vatPercentage = $entry['vat_percentage'] ?? 0;

                $totalMaterial = $unitPrice * $totalUnits;
                $vatAmount = ($vatPercentage > 0 && $totalUnits > 0 && $unitPrice > 0) ? ($unitPrice * $totalUnits) * ($vatPercentage / 100) : 0;
                $totalMaterialInclVAT = $totalMaterial + $vatAmount;
                $shippingCost = ($ctns * $weight * $shippingRate) + ((135 / 15) * $ctns) + ($ctns * 10);
                $dgd = (135 / 15) * $ctns;
                $labour = $ctns * 10;

                Investment::create([
                    'date' => Carbon::parse($request->date)->format('Y-m-d'),
                    'supplier_name' => $request->supplier_name,
                    'buyer' => $request->buyer,
                    'invoice_number' => $request->invoice_number,
                    'transaction_mode' => $request->transaction_mode,
                    'unit_price' => $unitPrice,
                    'vat_percentage' => $vatPercentage,
                    'description' => $entry['description'] ?? '',
                    'no_of_ctns' => $ctns,
                    'units_per_ctn' => $unitsPerCtn,
                    'total_units' => $totalUnits,
                    'weight' => $weight,
                    'shipping_rate_per_kg' => $shippingRate,
                    'vat_amount' => $vatAmount,
                    'total_material' => $totalMaterial,
                    'total_material_including_vat' => $totalMaterialInclVAT,
                    'shipping_rate' => ($ctns * $weight * $shippingRate),
                    'dgd' => $dgd,
                    'labour' => $labour,
                    'shipping_cost' => $shippingCost,
                    'remarks' => $entry['remarks'] ?? '',
                    'sub_serial' => $index + 1,
                ]);
            }

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error saving entries.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
