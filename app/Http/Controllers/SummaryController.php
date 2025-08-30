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

    public function getSummaryData()
    {
        // Match what the GTS table shows: prefer total_material; fallback to total_material_buy
        $totalPurchase = (float) DB::table('gts_materials')
            ->sum(DB::raw('COALESCE(total_material, total_material_buy, 0)'));

        // Shipping: if you already calculate a combined total in the table, keep your current logic.
        // Otherwise (recommended) use the same formula you use on the GTS page:
        $totalShipping = (float) DB::table('gts_materials')
            ->sum(DB::raw('COALESCE(shipping_cost,0) + COALESCE(dgd,0) + COALESCE(labour,0)'));

        $cashOut = $totalPurchase + $totalShipping;

        return response()->json([
            'total_purchase_of_material' => $totalPurchase,
            'total_shipping_cost'        => $totalShipping,
            'cash_out'                   => $cashOut,
            'cash_in'                    => 0,
            'profit'                     => 0 - $cashOut,
        ]);
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
                $material = DB::table($sheet['table'])->sum('total_material');
                $shipping = DB::table($sheet['table'])->sum('shipping_cost');
                $total = $material + $shipping;

                $data[] = [
                    'sheet' => $sheet['name'],
                    'material' => $material,
                    'shipping' => $shipping,
                    'total' => $total,
                ];
            } catch (\Exception $e) {
                $data[] = [
                    'sheet' => $sheet['name'],
                    'material' => 0,
                    'shipping' => 0,
                    'total' => 0,
                    'error' => $e->getMessage()
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
        $rows = DB::table('locals as l')
            ->leftJoin('local_items as it', 'it.local_id', '=', 'l.id')
            ->groupBy('l.id', 'l.total_inc_vat', 'l.total_ex_vat', 'l.vat_amount')
            ->select(
                'l.id',
                'l.total_inc_vat',
                'l.total_ex_vat',
                'l.vat_amount',
                DB::raw('COALESCE(SUM(COALESCE(it.total_inc_vat, (COALESCE(it.units,0)*COALESCE(it.unit_price,0)) + COALESCE(it.vat,0))),0) as items_inc')
            )
            ->get();

        $grand = 0.0;
        foreach ($rows as $r) {
            if ($r->total_inc_vat !== null) {
                $grand += (float) $r->total_inc_vat;
            } elseif ($r->items_inc > 0) {
                $grand += (float) $r->items_inc;
            } else {
                $grand += (float) ($r->total_ex_vat ?? 0) + (float) ($r->vat_amount ?? 0);
            }
        }
        return round($grand, 2);
    }

    public function sqTotal(): \Illuminate\Http\JsonResponse
    {
        $sum = (float) DB::table('s_q_clients')->sum('amount');
        return response()->json(['total' => round($sum, 2)], 200);
    }
}
