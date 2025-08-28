<?php

namespace App\Http\Controllers;

use App\Models\GtsMaterial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class GtsMaterialController extends Controller
{
    // Show all material entries
    public function index()
    {
        $materials = GtsMaterial::with('items')->orderBy('created_at', 'desc')->get();
        return response()->json($materials);
    }

    // Store a new draft entry
    public function store(Request $request)
    {
        // Store GtsMaterial first
        $material = GtsMaterial::create([
            'invoice_date' => $request->invoice_date,
            'invoice_no' => $request->invoice_no,
            'supplier_name' => $request->supplier_name,
            'brief_description' => $request->brief_description,
            'shipping_cost' => $request->shipping_cost,
            'dgd' => $request->dgd,
            'labour' => $request->labour,
            'total_material' => $request->total_material,
            'total_vat' => $request->total_vat,
            'total_material_buy' => $request->total_material_buy,
            'total_weight' => $request->total_weight,
            'mode_of_transaction' => $request->mode_of_transaction,
            'receipt_no' => $request->receipt_no,
            'remarks' => $request->remarks,
            'status' => true,
        ]);

        // Loop and store items
        foreach ($request->items as $item) {
            $material->items()->create([
                'description' => $item['description'],
                'units' => $item['units'],
                'unit_price' => $item['unit_price'],
                'vat' => $item['vat'],
                'weight_per_ctn' => $item['weight_per_ctn'],
                'ctns' => $item['ctns'],
            ]);
        }

        return response()->json($material);
    }

    // Update an existing entry
    public function update(Request $request, $id)
    {
        $material = GtsMaterial::findOrFail($id);

        // Update material base fields
        $material->update([
            'mode_of_transaction' => $request->mode_of_transaction,
            'receipt_no' => $request->receipt_no,
            'remarks' => $request->remarks,
            'shipping_cost' => $request->shipping_cost,
            'dgd' => $request->dgd,
            'labour' => $request->labour,
            'total_material' => $request->total_material ?? 0,
            'total_shipping_cost' => $request->total_shipping_cost ?? 0,
        ]);

        // Update item table if present
        if ($request->has('materials') && is_array($request->materials)) {
            // Delete old items
            $material->items()->delete();

            // Add new items
            foreach ($request->materials as $item) {
                $material->items()->create([
                    'description' => $item['description'],
                    'units' => $item['units'],
                    'unit_price' => $item['unit_price'],
                    'vat' => $item['vat'],
                    'weight_per_ctn' => $item['weight_per_ctn'],
                    'ctns' => $item['ctns'],
                ]);
            }
        }

        return response()->json(['message' => 'Material updated successfully']);
    }

    // Finalize the entry so it becomes read-only
    public function finalize($id)
    {
        $material = GtsMaterial::findOrFail($id);
        $material->is_finalized = true;
        $material->save();

        return response()->json(['message' => 'Material finalized successfully.']);
    }

    public function destroy($id)
    {
        $material = GtsMaterial::findOrFail($id);
        $material->delete();

        return response()->json(['message' => 'Deleted successfully']);
    }

    public function deleteItem($id)
    {
        $item = \App\Models\GtsMaterialItem::findOrFail($id);
        $item->delete();

        return response()->json(['message' => 'Item deleted successfully']);
    }

    public function uploadAttachments(Request $request, $id)
    {
        $material = GtsMaterial::findOrFail($id);

        $request->validate([
            'invoice' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:10240',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:10240',
            'note'    => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:10240',
        ]);

        try {
            if ($request->hasFile('invoice')) {
                if ($material->invoice_path && Storage::disk('public')->exists($material->invoice_path)) {
                    Storage::disk('public')->delete($material->invoice_path);
                }
                $material->invoice_path = $request->file('invoice')->store('attachments/material/invoice', 'public');
            }

            if ($request->hasFile('receipt')) {
                if ($material->receipt_path && Storage::disk('public')->exists($material->receipt_path)) {
                    Storage::disk('public')->delete($material->receipt_path);
                }
                $material->receipt_path = $request->file('receipt')->store('attachments/material/receipt', 'public');
            }

            if ($request->hasFile('note')) {
                if ($material->note_path && Storage::disk('public')->exists($material->note_path)) {
                    Storage::disk('public')->delete($material->note_path);
                }
                $material->note_path = $request->file('note')->store('attachments/material/note', 'public');
            }

            $material->save();

            return response()->json(['success' => true, 'message' => 'Attachments saved.']);
        } catch (\Throwable $e) {
            Log::error('GTS upload failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Upload failed.'], 500);
        }
    }


    public function getAttachments($id)
    {
        $material = GtsMaterial::find($id);

        if (!$material) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json([
            'invoice' => $material->invoice_path ? Storage::url($material->invoice_path) : null,
            'receipt' => $material->receipt_path ? Storage::url($material->receipt_path) : null,
            'note'    => $material->note_path ? Storage::url($material->note_path) : null,
        ]);
    }

    public function downloadAttachments($id)
    {
        $material = GtsMaterial::findOrFail($id);

        $html = '
        <style>
            body { font-family: sans-serif; }
            h2 { text-align: center; margin-bottom: 0px; }
            .attachment-block {
                page-break-inside: avoid;
                margin-bottom: 30px;
            }
            .attachment-block img {
                max-width: 100%;
                max-height: 800px;
                display: block;
                margin: 0 auto;
                object-fit: contain;
            }
        </style>
        <h2>GTS Material Attachments</h2>
    ';

        function embedImageIfExists($path, $title)
        {
            if (!$path || !Storage::disk('public')->exists($path)) return '';

            $fullPath = Storage::disk('public')->path($path);
            $ext = pathinfo($fullPath, PATHINFO_EXTENSION);
            $data = file_get_contents($fullPath);
            $base64 = 'data:image/' . $ext . ';base64,' . base64_encode($data);

            return "
            <div class='attachment-block'>
                <h3>$title</h3>
                <img src='$base64' alt='$title Attachment'>
            </div>
        ";
        }

        $html .= embedImageIfExists($material->invoice_path, 'Invoice');
        $html .= embedImageIfExists($material->receipt_path, 'Receipt');
        $html .= embedImageIfExists($material->note_path, 'Delivery Note');

        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'portrait');

        return $pdf->download('attachments.pdf');
    }
}
