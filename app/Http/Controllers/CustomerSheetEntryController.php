<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CustomerSheet;
use App\Models\CustomerSheetEntry;
use App\Models\CustomerSheetItem;

class CustomerSheetEntryController extends Controller
{
    public function store(Request $request)
    {
        // 1. Validate required inputs
        $request->validate([
            'sheet_id' => 'required|exists:customer_sheets,id',
            'date' => 'required|date',
            'supplier' => 'required|string',
            'description' => 'nullable|string',
            'items' => 'required|array|min:1',
        ]);

        // 2. Create the header entry
        $entry = CustomerSheetEntry::create([
            'customer_sheet_id' => $request->sheet_id,
            'date' => $request->date,
            'supplier' => $request->supplier,
            'description' => $request->description,
            'total_material_buy' => $request->total_material_buy ?? 0,
            'total_shipping_cost' => $request->total_shipping_cost ?? 0,
            'total_vat' => $request->total_vat ?? 0,
            'total_weight' => $request->total_weight ?? 0,
            'total_units' => $request->total_units ?? 0,
        ]);

        // 3. Loop through item rows
        foreach ($request->items as $item) {
            CustomerSheetItem::create([
                'entry_id' => $entry->id,
                'units' => $item['units'],
                'unit_price' => $item['unit_price'],
                'vat' => $item['vat'] ?? 0,
                'ctns' => $item['ctns'] ?? 0,
                'weight_per_ctn' => $item['weight_per_ctn'] ?? 0,
                'total_material' => $item['total_material'] ?? 0,
                'total_weight' => $item['total_weight'] ?? 0,
            ]);
        }

        return response()->json(['success' => true, 'message' => 'Customer Sheet saved successfully.']);
    }
}
