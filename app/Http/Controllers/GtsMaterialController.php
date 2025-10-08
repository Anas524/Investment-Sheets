<?php

namespace App\Http\Controllers;

use App\Models\GtsMaterial;
use App\Models\Cycle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Support\ActiveCycle;

class GtsMaterialController extends Controller
{
    // Show all material entries (cycle-scoped)
    public function index(Request $request)
    {
        $c = ActiveCycle::id($request);
        $q = GtsMaterial::with('items')
            ->forCycle($c)                      // <- scope by active cycle
            ->orderBy('created_at', 'desc');

        return response()->json($q->get());
    }

    // Store a new entry (cycle-stamped)
    public function store(Request $request)
    {
        $c = ActiveCycle::id($request);

        // numeric inputs
        $shipping = (float) ($request->shipping_cost ?? 0);
        $dgd      = (float) ($request->dgd ?? 0);
        $labour   = (float) ($request->labour ?? 0);
        $totalShipping = $shipping + $dgd + $labour;

        $material = GtsMaterial::create([
            'cycle_id'            => $c,
            'invoice_date'        => $request->invoice_date,
            'invoice_no'          => $request->invoice_no,
            'supplier_name'       => $request->supplier_name,
            'brief_description'   => $request->brief_description,

            'shipping_cost'       => $shipping,
            'dgd'                 => $dgd,
            'labour'              => $labour,
            'total_shipping_cost' => $totalShipping,     // <-- persist the sum

            // placeholders; will be recomputed below from items
            'total_material'      => 0,
            'ui_total_material'   => 0,
            'total_vat'           => 0,
            'total_material_buy'  => 0,
            'total_weight'        => 0,

            'mode_of_transaction' => $request->mode_of_transaction,
            'receipt_no'          => $request->receipt_no,
            'remarks'             => $request->remarks,
            'status'              => true,
        ]);

        // Accept "items" or "materials"
        $itemsPayload = $request->items ?? $request->materials ?? [];
        foreach ($itemsPayload as $item) {
            $material->items()->create([
                'description'     => $item['description']    ?? '',
                'units'           => $item['units']          ?? 0,
                'unit_price'      => $item['unit_price']     ?? 0,
                'vat'             => $item['vat']            ?? 0,
                'weight_per_ctn'  => $item['weight_per_ctn'] ?? 0,
                'ctns'            => $item['ctns']           ?? 0,
            ]);
        }

        $material->load('items');

        // --- authoritative recompute (matches what the UI header shows) ---
        $totalNoVat   = 0.0;   // sum of units*unit_price
        $totalBuy     = 0.0;   // header / “Total material buy”
        $totalWeight  = 0.0;

        foreach ($material->items as $it) {
            $units     = (float) ($it->units ?? 0);
            $unit      = (float) ($it->unit_price ?? 0);
            $vatInput  = (float) ($it->vat ?? 0);
            $wctn      = (float) ($it->weight_per_ctn ?? 0);
            $ctns      = (float) ($it->ctns ?? 0);

            $base   = $units * $unit;                      // no VAT
            $rowBuy = ($vatInput > 1) ? ($base * $vatInput) : $base;  // old rule

            $totalNoVat  += $base;
            $totalBuy    += $rowBuy;
            $totalWeight += $wctn * $ctns;
        }

        $material->update([
            'total_material'      => $totalNoVat,
            'ui_total_material'   => $totalBuy,  // <- drives header & KPIs
            'total_vat'           => $totalNoVat * 0.05,
            'total_material_buy'  => $totalBuy,
            'total_weight'        => $totalWeight,
        ]);

        return response()->json([
            'id'                  => $material->id,
            'total_shipping_cost' => $material->total_shipping_cost,
            'ui_total_material'   => $material->ui_total_material,
            'total_material'      => $material->total_material,
            'total_material_buy'  => $material->total_material_buy,
        ]);
    }

    // Update an existing entry (cycle-guarded)
    public function update(Request $request, $id)
    {
        $c = ActiveCycle::id($request);
        $material = GtsMaterial::with('items')->forCycle($c)->findOrFail($id);

        // base fields (no totals here)
        $shipping = (float) ($request->shipping_cost ?? 0);
        $dgd      = (float) ($request->dgd ?? 0);
        $labour   = (float) ($request->labour ?? 0);

        $material->mode_of_transaction = $request->mode_of_transaction;
        $material->receipt_no          = $request->receipt_no;
        $material->remarks             = $request->remarks;
        $material->shipping_cost       = $shipping;
        $material->dgd                 = $dgd;
        $material->labour              = $labour;

        // If items are sent, replace them
        if ($request->has('materials') && is_array($request->materials)) {
            $material->items()->delete();
            foreach ($request->materials as $it) {
                $material->items()->create([
                    'description'     => $it['description']     ?? '',
                    'units'           => $it['units']           ?? 0,
                    'unit_price'      => $it['unit_price']      ?? 0,
                    'vat'             => $it['vat']             ?? 0,
                    'weight_per_ctn'  => $it['weight_per_ctn']  ?? 0,
                    'ctns'            => $it['ctns']            ?? 0,
                ]);
            }
        } elseif ($request->has('items') && is_array($request->items)) {
            $material->items()->delete();
            foreach ($request->items as $it) {
                $material->items()->create([
                    'description'     => $it['description']     ?? '',
                    'units'           => $it['units']           ?? 0,
                    'unit_price'      => $it['unit_price']      ?? 0,
                    'vat'             => $it['vat']             ?? 0,
                    'weight_per_ctn'  => $it['weight_per_ctn']  ?? 0,
                    'ctns'            => $it['ctns']            ?? 0,
                ]);
            }
        }

        $material->load('items');

        // Recompute from CURRENT items (authoritative)
        $totalNoVat  = 0.0; // sum of units*unit_price
        $totalBuy    = 0.0; // “Total material buy” (header 6th column)
        $totalWeight = 0.0;

        foreach ($material->items as $it) {
            $units    = (float) ($it->units ?? 0);
            $unit     = (float) ($it->unit_price ?? 0);
            $vatInput = (float) ($it->vat ?? 0);
            $wctn     = (float) ($it->weight_per_ctn ?? 0);
            $ctns     = (float) ($it->ctns ?? 0);

            $base   = $units * $unit;
            $rowBuy = ($vatInput > 1) ? ($base * $vatInput) : $base;

            $totalNoVat  += $base;
            $totalBuy    += $rowBuy;
            $totalWeight += ($wctn * $ctns);
        }

        $material->total_material      = $totalNoVat;
        $material->total_vat           = $totalNoVat * 0.05;  // your rule
        $material->total_material_buy  = $totalBuy;
        $material->ui_total_material   = $totalBuy;           // <== keep UI correct
        $material->total_weight        = $totalWeight;

        $material->total_shipping_cost = $shipping + $dgd + $labour;

        $material->save();

        return response()->json([
            'ok'                  => true,
            'total_shipping_cost' => $material->total_shipping_cost,
            'total_material_buy'  => $material->total_material_buy,
            'ui_total_material'   => $material->ui_total_material,
            'total_material'      => $material->total_material,
            'total_vat'           => $material->total_vat,
        ]);
    }

    // Finalize the entry so it becomes read-only (cycle-guarded)
    public function finalize(Request $request, $id)
    {
        $c = ActiveCycle::id($request);
        $material = GtsMaterial::forCycle($c)->findOrFail($id);
        $material->is_finalized = true;
        $material->save();

        return response()->json(['message' => 'Material finalized successfully.']);
    }

    public function destroy(Request $request, $id)
    {
        $c = ActiveCycle::id($request);
        $material = GtsMaterial::forCycle($c)->findOrFail($id);
        $material->delete();

        return response()->json(['message' => 'Deleted successfully']);
    }

    public function deleteItem(Request $request, $id)
    {
        // 1) Find item + parent first (so we still have the parent after delete)
        $item = \App\Models\GtsMaterialItem::findOrFail($id);
        $material = $item->material;   // relation defined on the item model

        // 2) Delete the item
        $item->delete();

        // 3) Recompute authoritative totals from remaining items
        $material->load('items');

        $totalNoVat  = 0.0;  // sum(units*unit_price)
        $totalBuy    = 0.0;  // “Total material buy” (header 6th col, UI uses this)
        $totalWeight = 0.0;

        foreach ($material->items as $it) {
            $units    = (float) ($it->units ?? 0);
            $unit     = (float) ($it->unit_price ?? 0);
            $vatInput = (float) ($it->vat ?? 0);
            $wctn     = (float) ($it->weight_per_ctn ?? 0);
            $ctns     = (float) ($it->ctns ?? 0);

            $base   = $units * $unit;                       // no VAT
            $rowBuy = ($vatInput > 1) ? ($base * $vatInput) // multiplier rule
                : $base;

            $totalNoVat  += $base;
            $totalBuy    += $rowBuy;
            $totalWeight += ($wctn * $ctns);
        }

        // 4) Persist recomputed totals (VAT is 5% of no-VAT total per your rule)
        $material->total_material     = $totalNoVat;
        $material->total_vat          = $totalNoVat * 0.05;
        $material->total_material_buy = $totalBuy;
        $material->ui_total_material  = $totalBuy;  // keep UI & summaries correct
        $material->total_weight       = $totalWeight;
        $material->save();

        // 5) Return fresh numbers so the front-end can repaint instantly
        return response()->json([
            'ok'                 => true,
            'material_id'        => $material->id,
            'ui_total_material'  => $material->ui_total_material,
            'total_material'     => $material->total_material,
            'total_vat'          => $material->total_vat,
            'total_material_buy' => $material->total_material_buy,
        ]);
    }

    public function uploadAttachments(Request $request, $id)
    {
        $c = ActiveCycle::id($request);
        $material = GtsMaterial::forCycle($c)->findOrFail($id);

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

    public function getAttachments(Request $request, $id)
    {
        $c = ActiveCycle::id($request);
        $material = GtsMaterial::forCycle($c)->find($id);

        if (!$material) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json([
            'invoice' => $material->invoice_path ? Storage::url($material->invoice_path) : null,
            'receipt' => $material->receipt_path ? Storage::url($material->receipt_path) : null,
            'note'    => $material->note_path ? Storage::url($material->note_path) : null,
        ]);
    }

    public function downloadAttachments(Request $request, $id)
    {
        $c = ActiveCycle::id($request);
        $material = GtsMaterial::forCycle($c)->findOrFail($id);

        $html = '
        <style>
            body { font-family: sans-serif; }
            h2 { text-align: center; margin-bottom: 0px; }
            .attachment-block { page-break-inside: avoid; margin-bottom: 30px; }
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

        $embed = function ($path, $title) {
            if (!$path || !Storage::disk('public')->exists($path)) return '';
            $fullPath = Storage::disk('public')->path($path);
            $ext = pathinfo($fullPath, PATHINFO_EXTENSION);
            $data = file_get_contents($fullPath);
            $base64 = 'data:image/' . $ext . ';base64,' . base64_encode($data);
            return "
            <div class='attachment-block'>
                <h3>{$title}</h3>
                <img src='{$base64}' alt='{$title} Attachment'>
            </div>";
        };

        $html .= $embed($material->invoice_path, 'Invoice');
        $html .= $embed($material->receipt_path, 'Receipt');
        $html .= $embed($material->note_path, 'Delivery Note');

        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'portrait');

        return $pdf->download('attachments.pdf');
    }

    public function totals(Request $request)
    {
        $materialsTable = 'gts_materials';
        $investTable    = 'gts_investments';

        if (!Schema::hasTable($materialsTable)) {
            return response()->json([
                'material' => 0,
                'shipping' => 0,
                'investment' => 0,
                '_debug' => ['err' => "no table $materialsTable"]
            ]);
        }

        // ---- filter by cycle only ----
        $cid  = app('App\\Support\\ActiveCycle')::id($request);
        $cols = Schema::getColumnListing($materialsTable);

        $base = DB::table($materialsTable . ' as m')->where('m.cycle_id', $cid);

        // soft/flags
        if (in_array('deleted_at', $cols)) $base->whereNull('m.deleted_at');
        foreach (['deleted', 'is_deleted', 'archived'] as $f) {
            if (in_array($f, $cols)) $base->where("m.$f", 0);
        }

        // posted-only?
        if ($request->boolean('only_posted')) {
            if (in_array('posted', $cols))            $base->where('m.posted', 1);
            elseif (in_array('is_posted', $cols))     $base->where('m.is_posted', 1);
            elseif (in_array('status', $cols))        $base->whereIn('m.status', ['posted', 'approved', 'completed', 1, true]);
        }

        // ---- MATERIAL: prefer ui_total_material, else total_material ----
        $materialCol = in_array('ui_total_material', $cols)
            ? 'm.ui_total_material'
            : (in_array('total_material', $cols) ? 'm.total_material' : null);

        $material = $materialCol
            ? (float) (clone $base)->selectRaw("ROUND(SUM(COALESCE($materialCol,0)),2) as s")->value('s')
            : 0.0;

        // ---- SHIPPING: prefer total_shipping_cost; else sum of parts (or g_cost) ----
        if (in_array('total_shipping_cost', $cols)) {
            $shipExpr = 'COALESCE(m.total_shipping_cost,0)';
        } else {
            $parts = [];
            foreach (['shipping_cost', 'dgd', 'labour', 'labor_cost', 'g_cost'] as $c) {
                if (in_array($c, $cols)) $parts[] = "COALESCE(m.$c,0)";
            }
            $shipExpr = $parts ? implode(' + ', $parts) : '0';
        }

        $shipping = (float) (clone $base)->selectRaw("ROUND(SUM($shipExpr),2) as s")->value('s');

        // ---- INVESTMENT: unchanged; pick first existing amount column ----
        $investment = 0.0;
        if (Schema::hasTable($investTable)) {
            $icols = Schema::getColumnListing($investTable);
            $iq = DB::table($investTable . ' as i')->where('i.cycle_id', $cid);
            if (in_array('deleted_at', $icols)) $iq->whereNull('i.deleted_at');
            foreach (['deleted', 'is_deleted', 'archived'] as $f) {
                if (in_array($f, $icols)) $iq->where("i.$f", 0);
            }
            $invCol = collect(['investment_amount', 'total_investment', 'investment'])
                ->first(fn($c) => in_array($c, $icols));
            if ($invCol) {
                $investment = (float) (clone $iq)->selectRaw("ROUND(SUM(COALESCE(i.$invCol,0)),2) as s")->value('s');
            }
        }

        return response()->json([
            'material'   => round($material, 2),
            'shipping'   => round($shipping, 2),
            'investment' => round($investment, 2),
            '_debug' => [
                'materialCol' => $materialCol,
                'shipExpr'    => $shipExpr,
                'cycle'       => $cid,
            ],
        ]);
    }
}
