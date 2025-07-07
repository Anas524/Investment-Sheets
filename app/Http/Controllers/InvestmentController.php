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
        $investments = Investment::orderBy('id')->get()->groupBy('invoice_number');

        $merged = [];
        foreach ($investments as $invoice => $grouped) {
            $first = $grouped->first();
            $mergedEntry = $first->toArray();

            $mergedEntry['descriptions'] = [];
            $mergedEntry['unit_prices'] = [];
            $mergedEntry['no_of_ctns_list'] = [];
            $mergedEntry['units_per_ctn_list'] = [];
            $mergedEntry['total_units_list'] = [];
            $mergedEntry['vat_amount_list'] = [];
            $mergedEntry['total_material_list'] = [];
            $mergedEntry['total_material_incl_vat_list'] = [];
            $mergedEntry['weight_list'] = [];
            $mergedEntry['shipping_rate_list'] = [];
            $mergedEntry['dgd_list'] = [];
            $mergedEntry['labour_list'] = [];
            $mergedEntry['shipping_cost_list'] = [];
            $mergedEntry['remarks_list'] = [];

            $mergedEntry['sub_serials'] = $grouped->pluck('sub_serial')->filter()->values();

            foreach ($grouped as $item) {
                $prefix = $item->sub_serial ? $item->sub_serial . '. ' : '';
                $mergedEntry['descriptions'][] = $prefix . $item->description;
                $mergedEntry['unit_prices'][] = $prefix . 'AED ' . number_format($item->unit_price, 2);
                $mergedEntry['no_of_ctns_list'][] = $prefix . $item->no_of_ctns;
                $mergedEntry['units_per_ctn_list'][] = $prefix . $item->units_per_ctn;
                $mergedEntry['total_units_list'][] = $prefix . $item->total_units;
                $mergedEntry['vat_amount_list'][] = $prefix . 'AED ' . number_format($item->vat_amount, 2);
                $mergedEntry['total_material_list'][] = $prefix . 'AED ' . number_format($item->total_material, 2);
                $mergedEntry['total_material_incl_vat_list'][] = $prefix . 'AED ' . number_format($item->total_material_including_vat, 2);
                $mergedEntry['weight_list'][] = $prefix . $item->weight;
                $mergedEntry['shipping_rate_list'][] = $prefix . 'AED ' . number_format($item->shipping_rate, 2);
                $mergedEntry['dgd_list'][] = $prefix . 'AED ' . number_format($item->dgd, 2);
                $mergedEntry['labour_list'][] = $prefix . 'AED ' . number_format($item->labour, 2);
                $mergedEntry['shipping_cost_list'][] = $prefix . 'AED ' . number_format($item->shipping_cost, 2);
                $mergedEntry['remarks_list'][] = $prefix . $item->remarks;
            }

            $mergedEntry['invoice_total'] = $grouped->sum('total_material_including_vat');

            $mergedEntry['description_combined'] = implode("<br>", $mergedEntry['descriptions']);
            $mergedEntry['unit_price_combined'] = implode("<br>", $mergedEntry['unit_prices']);
            $mergedEntry['no_of_ctns_combined'] = implode("<br>", $mergedEntry['no_of_ctns_list']);
            $mergedEntry['units_per_ctn_combined'] = implode("<br>", $mergedEntry['units_per_ctn_list']);
            $mergedEntry['total_units_combined'] = implode("<br>", $mergedEntry['total_units_list']);
            $mergedEntry['vat_amount_combined'] = implode("<br>", $mergedEntry['vat_amount_list']);
            $mergedEntry['total_material_combined'] = implode("<br>", $mergedEntry['total_material_list']);
            $mergedEntry['total_material_incl_vat_combined'] = implode("<br>", $mergedEntry['total_material_incl_vat_list']);
            $mergedEntry['weight_combined'] = implode("<br>", $mergedEntry['weight_list']);
            $mergedEntry['shipping_rate_combined'] = implode("<br>", $mergedEntry['shipping_rate_list']);
            $mergedEntry['dgd_combined'] = implode("<br>", $mergedEntry['dgd_list']);
            $mergedEntry['labour_combined'] = implode("<br>", $mergedEntry['labour_list']);
            $mergedEntry['shipping_cost_combined'] = implode("<br>", $mergedEntry['shipping_cost_list']);
            $mergedEntry['remarks_combined'] = implode("<br>", $mergedEntry['remarks_list']);

            // This is needed for Blade view: form data-invoice
            $mergedEntry['invoice'] = $mergedEntry['invoice_number'];
            $mergedEntry['invoice_file'] = $first->invoice_path ?? null;
            $mergedEntry['receipt'] = $first->receipt_path ?? null;
            $mergedEntry['note'] = $first->note_path ?? null;

            $merged[] = (object) $mergedEntry;
        }

        return view('index', [
            'investments' => $merged,
            'totalMaterial' => Investment::sum('total_material'),
            'totalMaterialInclVAT' => Investment::sum('total_material_including_vat'),
            'totalVAT' => Investment::sum('vat_amount'),
            'totalShipment' => Investment::sum('shipping_cost'),
            'grandTotal' => Investment::sum('total_material_including_vat') + Investment::sum('shipping_cost'),

            'totalAmount' => USClient::sum('amount'),
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
