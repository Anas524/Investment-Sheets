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

        // money in (from UI)
        $uiTotal   = $this->dec7($request->input('ui_total_material', 0));
        $buyTotal  = $this->dec7($request->input('total_material_buy', $uiTotal));
        $noVat     = $this->dec7($request->input('total_material', 0));
        $vat       = $this->dec7($request->input('total_vat', ($request->input('total_material', 0) * 0.05)));
        $weight    = $this->dec7($request->input('total_weight', 0));

        // shipping
        $shipping  = $this->dec7($request->input('shipping_cost', 0));
        $dgd       = $this->dec7($request->input('dgd', 0));
        $labour    = $this->dec7($request->input('labour', 0));
        $totShip   = $this->dec7($request->input('total_shipping_cost', ($request->input('shipping_cost', 0) + $request->input('dgd', 0) + $request->input('labour', 0))));

        $material = GtsMaterial::create([
            'cycle_id'            => $c,
            'invoice_date'        => $request->invoice_date,
            'invoice_no'          => $request->invoice_no,
            'supplier_name'       => $request->supplier_name,
            'brief_description'   => $request->brief_description,

            'shipping_cost'       => $shipping,
            'dgd'                 => $dgd,
            'labour'              => $labour,
            'total_shipping_cost' => $totShip,

            // totals from UI
            'total_material'      => $noVat,
            'total_vat'           => $vat,
            'total_material_buy'  => $buyTotal,
            'ui_total_material'   => $uiTotal,
            'total_weight'        => $weight,

            'mode_of_transaction' => $request->mode_of_transaction,
            'receipt_no'          => $request->receipt_no,
            'remarks'             => $request->remarks,
            'status'              => true,
        ]);

        // items (unchanged)
        $items = $request->items ?? $request->materials ?? [];
        foreach ($items as $it) {
            $material->items()->create([
                'description'     => $it['description']     ?? '',
                'units'           => $it['units']           ?? 0,
                'unit_price'      => $it['unit_price']      ?? 0,
                'vat'             => $it['vat']             ?? 0,
                'weight_per_ctn'  => $it['weight_per_ctn']  ?? 0,
                'ctns'            => $it['ctns']            ?? 0,
            ]);
        }

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

        $isDraft = ($material->status ?? null) === 'draft';

        if ($isDraft) {
            $request->validate([
                'invoice_date'       => ['nullable', 'date'],
                'invoice_no'         => ['nullable', 'string', 'max:255'],
                'supplier_name'      => ['nullable', 'string', 'max:255'],
                'brief_description'  => ['nullable', 'string', 'max:500'],
            ]);
        }

        // basic fields
        $shipping = $this->dec7($request->input('shipping_cost', 0));
        $dgd      = $this->dec7($request->input('dgd', 0));
        $labour   = $this->dec7($request->input('labour', 0));

        // if client passed total_shipping_cost use it, else sum parts
        $material->total_shipping_cost = $this->dec7($request->input(
            'total_shipping_cost',
            ((float)$shipping + (float)$dgd + (float)$labour)
        ));

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

        // Prefer incoming UI totals if present
        $hasUi      = $request->filled('ui_total_material');
        $hasBuy     = $request->filled('total_material_buy');
        $hasNoVat   = $request->filled('total_material');
        $hasVat     = $request->filled('total_vat');
        $hasWeight  = $request->filled('total_weight');

        if ($hasUi || $hasBuy || $hasNoVat || $hasVat || $hasWeight) {
            if ($hasUi)     $material->ui_total_material  = $this->dec7($request->ui_total_material);
            if ($hasBuy)    $material->total_material_buy = $this->dec7($request->total_material_buy);
            if ($hasNoVat)  $material->total_material     = $this->dec7($request->total_material);
            if ($hasVat)    $material->total_vat          = $this->dec7($request->total_vat);
            if ($hasWeight) $material->total_weight       = $this->dec7($request->total_weight);
        } else {
            // Fallback: recompute from items (legacy callers)
            $material->load('items');
            $totalNoVat  = 0.0;
            $totalBuy    = 0.0;
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

            $material->total_material     = $this->dec7($totalNoVat);
            $material->total_vat          = $this->dec7($totalNoVat * 0.05);
            $material->total_material_buy = $this->dec7($totalBuy);
            $material->ui_total_material  = $this->dec7($totalBuy);
            $material->total_weight       = $this->dec7($totalWeight);
        }

        // allow updating header fields
        if ($request->has('invoice_date')) {
            $material->invoice_date = $request->input('invoice_date');
        }
        if ($request->has('invoice_no')) {
            $material->invoice_no = $request->input('invoice_no');
        }
        if ($request->has('supplier_name')) {
            $material->supplier_name = $request->input('supplier_name');
        }
        if ($request->has('brief_description')) {
            $material->brief_description = $request->input('brief_description');
        }

        $material->save();

        return response()->json([
            'ok'                  => true,

            'invoice_date'        => $material->invoice_date,
            'invoice_no'          => $material->invoice_no,
            'supplier_name'       => $material->supplier_name,
            'brief_description'   => $material->brief_description,

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
        $material->total_material     = $this->dec7($totalNoVat);
        $material->total_vat          = $this->dec7($totalNoVat * 0.05);
        $material->total_material_buy = $this->dec7($totalBuy);
        $material->ui_total_material  = $this->dec7($totalBuy);  // keep UI & summaries correct
        $material->total_weight       = $this->dec7($totalWeight);
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

            Log::info('MAT UPLOAD PATHS', [
                'invoice_path' => $material->invoice_path,
                'invoice_exists' => $material->invoice_path ? Storage::disk('public')->exists($material->invoice_path) : null,
                'invoice_full' => $material->invoice_path ? Storage::disk('public')->path($material->invoice_path) : null,

                'receipt_path' => $material->receipt_path,
                'receipt_exists' => $material->receipt_path ? Storage::disk('public')->exists($material->receipt_path) : null,

                'note_path' => $material->note_path,
                'note_exists' => $material->note_path ? Storage::disk('public')->exists($material->note_path) : null,
            ]);

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

        // auto-clean broken paths (prevents 404 in viewer)
        $fix = function ($col) use ($material) {
            $p = $material->{$col};

            if ($p && !Storage::disk('public')->exists($p)) {
                $material->{$col} = null;   // clear invalid path from DB
                return null;
            }

            return $p ? Storage::url($p) : null;
        };

        $invoice = $fix('invoice_path');
        $receipt = $fix('receipt_path');
        $note    = $fix('note_path');

        // save only if something was cleaned
        $material->save();

        // optional debug log (NOW it will run)
        Log::info('MAT ATT CHECK', [
            'id' => $material->id,
            'invoice_path' => $material->invoice_path,
            'receipt_path' => $material->receipt_path,
            'note_path' => $material->note_path,
        ]);

        return response()->json([
            'invoice' => $invoice,
            'receipt' => $receipt,
            'note'    => $note,
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

        // ---- MATERIAL: prefer total_material, else ui_total_material ----
        $materialCol = in_array('total_material', $cols)
            ? 'm.total_material'
            : (in_array('ui_total_material', $cols) ? 'm.ui_total_material' : null);

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

    protected function dec7($v): ?string
    {
        if ($v === null) return null;
        $s = trim((string)$v);
        // Keep optional sign, digits, optional dot + up to 7 decimals
        if (!preg_match('/^-?\d+(?:\.\d+)?$/', $s)) {
            // if it has commas or spaces etc, strip non-numeric except dot/sign
            $s = preg_replace('/[^0-9.\-]/', '', $s);
        }
        if ($s === '' || $s === '-' || $s === '.')
            return '0';

        // limit to 7 fractional digits without floating math
        if (strpos($s, '.') !== false) {
            [$int, $frac] = explode('.', $s, 2);
            $s = $int . '.' . substr($frac, 0, 7);
        }
        return $s;
    }

    public function deleteAttachment(Request $request, $id)
    {
        $c = ActiveCycle::id($request);
        $material = GtsMaterial::forCycle($c)->findOrFail($id);

        $type = $request->input('type'); // invoice|receipt|note
        if (!in_array($type, ['invoice', 'receipt', 'note'], true)) {
            return response()->json(['message' => 'Invalid type'], 422);
        }

        $col = $type . '_path'; // invoice_path / receipt_path / note_path
        $path = $material->{$col};

        // delete file if exists
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }

        // clear db column
        $material->{$col} = null;
        $material->save();

        // return updated urls (safe)
        $makeUrl = function ($p) {
            if (!$p) return null;
            if (!Storage::disk('public')->exists($p)) return null;
            return Storage::url($p);
        };

        $attachments = [
            'invoice' => $makeUrl($material->invoice_path),
            'receipt' => $makeUrl($material->receipt_path),
            'note'    => $makeUrl($material->note_path),
        ];

        return response()->json([
            'success' => true,
            'message' => ucfirst($type) . ' deleted.',
            'attachments' => $attachments,
            'count' => collect($attachments)->filter()->count(),
        ]);
    }

    public function debugAttachment(Request $request, $id)
    {
        $c = ActiveCycle::id($request);
        $m = GtsMaterial::forCycle($c)->findOrFail($id);

        $paths = [
            'invoice_path' => $m->invoice_path,
            'receipt_path' => $m->receipt_path,
            'note_path' => $m->note_path,
        ];

        $check = [];
        foreach ($paths as $k => $p) {
            $check[$k] = [
                'path' => $p,
                'exists' => $p ? Storage::disk('public')->exists($p) : false,
                'full' => $p ? Storage::disk('public')->path($p) : null,
                'url' => $p ? Storage::url($p) : null,
            ];
        }

        return response()->json($check);
    }
}
