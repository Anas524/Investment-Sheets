<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use App\Models\CustomerSheet;
use App\Models\CustomerSheetEntry;
use App\Models\Local;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

use Illuminate\Http\Request;

class SummaryController extends Controller
{
    public function summary()
    {
        return view('sheets.summary_sheet');
    }

    public function getSummaryData(Request $request)
    {
        // If you want to mirror "posted only", turn this on via ?only_posted=1
        $onlyPosted = $request->boolean('only_posted', false);

        // Base filter that matches your Materials table
        $base = DB::table('gts_materials as m');
        if ($onlyPosted && Schema::hasColumn('gts_materials', 'status')) {
            $base->where('m.status', true);
        }
        if (Schema::hasColumn('gts_materials', 'deleted_at')) {
            $base->whereNull('m.deleted_at');
        }
        if ($request->filled('from')) {
            $base->whereDate('m.invoice_date', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $base->whereDate('m.invoice_date', '<=', $request->input('to'));
        }

        // Resolve IDs once so we can safely aggregate without join blow-ups
        $ids = (clone $base)->pluck('m.id');
        if ($ids->isEmpty()) {
            return response()->json([
                'total_purchase_of_material' => 0.00,
                'total_shipping_cost'        => 0.00,
                'cash_out'                   => 0.00,
                'cash_in'                    => 0.00,
                'profit'                     => 0.00,
            ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        }

        // MATERIAL — exactly like the "Total Material" column in the grid:
        // sum of (units * unit_price + vat) over gts_materials_items
        $material = (float) DB::table('gts_materials_items as i')
            ->whereIn('i.material_id', $ids)
            ->selectRaw('ROUND(SUM(COALESCE(i.units,0)*COALESCE(i.unit_price,0) + COALESCE(i.vat,0)), 2) as s')
            ->value('s');

        // SHIPPING — prefer persisted total_shipping_cost if the column exists
        $shippingSql = Schema::hasColumn('gts_materials', 'total_shipping_cost')
            ? 'ROUND(SUM(COALESCE(m.total_shipping_cost, COALESCE(m.shipping_cost,0)+COALESCE(m.dgd,0)+COALESCE(m.labour,0))), 2) as s'
            : 'ROUND(SUM(COALESCE(m.shipping_cost,0)+COALESCE(m.dgd,0)+COALESCE(m.labour,0)), 2) as s';

        $shipping = (float) DB::table('gts_materials as m')
            ->whereIn('m.id', $ids)
            ->selectRaw($shippingSql)
            ->value('s');

        $cashOut = round($material + $shipping, 2);

        return response()->json([
            'total_purchase_of_material' => $material,
            'total_shipping_cost'        => $shipping,
            'cash_out'                   => $cashOut,
            'cash_in'                    => 0,
            'profit'                     => 0 - $cashOut,
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }

    public function getCashInBreakdown()
    {
        $sheets = [
            ['name' => 'RH Sheet', 'table' => 'r_h_clients'],
            ['name' => 'FF Sheet', 'table' => 'f_f_clients'],
            ['name' => 'BL Sheet', 'table' => 'b_l_clients'],
            ['name' => 'WS Sheet', 'table' => 'w_s_clients'],
        ];

        $data = [];

        foreach ($sheets as $sheet) {
            try {
                $totals = DB::table($sheet['table'])
                    ->selectRaw(
                        'COALESCE(SUM(total_material),0) AS material, '
                        . 'COALESCE(SUM(shipping_cost),0) AS shipping'
                    )
                    ->first();

                $material = (float) ($totals->material ?? 0);
                $shipping = (float) ($totals->shipping ?? 0);

                $data[] = [
                    'sheet' => $sheet['name'],
                    'material' => $material,
                    'shipping' => $shipping,
                    'total'    => $material + $shipping,
                ];
            } catch (\Throwable $e) {
                $data[] = [
                    'sheet' => $sheet['name'],
                    'material' => 0,
                    'shipping' => 0,
                    'total' => 0,
                    'error' => $e->getMessage(),
                ];
            }
        }

        // Add 3 direct total-based sheets
        $usClientAmount = DB::table('us_clients')->sum('amount');
        $sqClientAmount = DB::table('s_q_clients')->sum('amount');
        $localSalesAmount = $this->computeLocalSalesTotal();

        $data[] = ['sheet' => 'US Client Payment', 'material' => $usClientAmount, 'shipping' => 0, 'total' => $usClientAmount];
        $data[] = ['sheet' => 'SQ Sheet', 'material' => $sqClientAmount, 'shipping' => 0, 'total' => $sqClientAmount];
        $data[] = ['sheet' => 'Local Sales', 'material' => $localSalesAmount, 'shipping' => 0, 'total' => $localSalesAmount];

        return response()->json($data);
    }

    public function customerSheetTotals(): JsonResponse
    {
        $tot = DB::table('customer_sheet_entries')
            ->selectRaw('
            COALESCE(SUM(COALESCE(total_material_buy,0)), 0) AS material,
            COALESCE(
                SUM(
                    COALESCE(total_shipping_cost,
                             COALESCE(shipping_cost,0) + COALESCE(dgd,0) + COALESCE(labour,0))
                ), 0
            ) AS shipping
        ')
            ->first();

        return response()->json([
            'material' => round((float)($tot->material ?? 0), 2),
            'shipping' => round((float)($tot->shipping ?? 0), 2),
        ]);
    }

    public function customerSheetRows(): JsonResponse
    {
        // Decide FK once
        $fk = Schema::hasColumn('customer_sheet_entries', 'customer_sheet_id')
            ? 'customer_sheet_id'
            : (Schema::hasColumn('customer_sheet_entries', 'sheet_id') ? 'sheet_id' : null);

        // If entries table missing (or no FK), return all sheets with zeros
        if (!Schema::hasTable('customer_sheet_entries') || !$fk) {
            $rows = CustomerSheet::query()
                ->orderBy('sheet_name')
                ->get(['sheet_name'])
                ->map(fn($s) => [
                    'name'     => (string) $s->sheet_name,
                    'material' => 0.0,
                    'shipping' => 0.0,
                ])->values();

            return response()->json(['rows' => $rows], 200);
        }

        $rows = DB::table('customer_sheets as cs')
            ->leftJoin('customer_sheet_entries as e', "e.$fk", '=', 'cs.id')
            ->selectRaw('
            cs.sheet_name AS name,
            COALESCE(SUM(COALESCE(e.total_material_buy,0)), 0) AS material,
            COALESCE(
                SUM(
                    COALESCE(e.total_shipping_cost,
                             COALESCE(e.shipping_cost,0) + COALESCE(e.dgd,0) + COALESCE(e.labour,0))
                ), 0
            ) AS shipping
        ')
            ->groupBy('cs.id', 'cs.sheet_name')
            ->orderBy('cs.sheet_name')
            ->get()
            ->map(fn($r) => [
                'name'     => (string) $r->name,
                'material' => (float) $r->material,
                'shipping' => (float) $r->shipping,
            ])
            ->values();

        return response()->json(['rows' => $rows], 200);
    }

    public function customerSheetLoans(): JsonResponse
    {
        $rows = DB::table('customer_sheets as cs')
            ->leftJoin(DB::raw('
            (SELECT customer_sheet_id,
                    SUM(COALESCE(total_material_buy,0) + COALESCE(total_shipping_cost,0)) AS sheet_total
             FROM customer_sheet_entries
             GROUP BY customer_sheet_id) e
        '), 'e.customer_sheet_id', '=', 'cs.id')
            ->leftJoin(DB::raw('
            (SELECT customer_sheet_id,
                    SUM(COALESCE(amount,0)) AS loan_paid
             FROM customer_loan_ledger_entries
             GROUP BY customer_sheet_id) ll
        '), 'll.customer_sheet_id', '=', 'cs.id')
            ->selectRaw('
            cs.id,
            cs.sheet_name AS name,
            COALESCE(e.sheet_total,0)  AS sheet_total,
            COALESCE(ll.loan_paid,0)   AS loan_paid,
            -- 🔹 match Customer Sheet: remaining = loan_paid - sheet_total (signed)
            (COALESCE(ll.loan_paid,0) - COALESCE(e.sheet_total,0)) AS remaining_signed,
            -- 🔹 dues only (positive absolute of negatives) for grand total
            CASE
              WHEN (COALESCE(ll.loan_paid,0) - COALESCE(e.sheet_total,0)) < 0
              THEN ABS(COALESCE(ll.loan_paid,0) - COALESCE(e.sheet_total,0))
              ELSE 0
            END AS due_abs
        ')
            ->orderBy('name')
            ->get();

        // Grand total = sum of dues only (negatives on the signed metric)
        $grand = (float) $rows->sum('due_abs');

        // expose the signed value as "remaining" to the frontend
        $rows = $rows->map(fn($r) => [
            'id'          => $r->id,
            'name'        => $r->name,
            'sheet_total' => (float) $r->sheet_total,
            'loan_paid'   => (float) $r->loan_paid,
            'remaining'   => (float) $r->remaining_signed, // e.g. RH = -75809.50, BL = +1000.00
        ]);

        return response()->json(['rows' => $rows, 'grand' => $grand], 200);
    }

    public function localSalesTotal()
    {
        return response()->json(['total' => $this->computeLocalSalesTotal()]);
    }

    private function computeLocalSalesTotal(): float
    {
        $sub = DB::table('local_items')
            ->selectRaw('local_id, '
                . 'SUM(COALESCE(total_inc_vat, '
                . '(COALESCE(units,0)*COALESCE(unit_price,0)) + COALESCE(vat,0))) AS items_inc')
            ->groupBy('local_id');

        $grand = DB::table('locals as l')
            ->leftJoinSub($sub, 'it', 'it.local_id', '=', 'l.id')
            ->selectRaw('SUM(CASE '
                . 'WHEN l.total_inc_vat IS NOT NULL THEN l.total_inc_vat '
                . 'WHEN COALESCE(it.items_inc,0) > 0 THEN it.items_inc '
                . 'ELSE COALESCE(l.total_ex_vat,0) + COALESCE(l.vat_amount,0) '
                . 'END) AS grand')
            ->value('grand');

        return round((float) ($grand ?? 0), 2);
    }

    public function sqTotal(): \Illuminate\Http\JsonResponse
    {
        $sum = (float) DB::table('s_q_clients')->sum('amount');
        return response()->json(['total' => round($sum, 2)], 200);
    }
}
