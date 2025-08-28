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
        $material = (float) CustomerSheetEntry::sum('total_material_buy');
        $shipping = (float) CustomerSheetEntry::sum('shipping_cost');

        return response()->json([
            'material' => round($material, 2),
            'shipping' => round($shipping, 2),
        ]);
    }

    public function customerSheetRows(): JsonResponse
    {
        // Decide FK once
        $fk = Schema::hasColumn('customer_sheet_entries', 'customer_sheet_id')
            ? 'customer_sheet_id'
            : (Schema::hasColumn('customer_sheet_entries', 'sheet_id') ? 'sheet_id' : null);

        // If entries table missing (or no FK), still return all sheets with zeros
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

        $rows = CustomerSheet::query()
            ->leftJoin('customer_sheet_entries as e', "e.$fk", '=', 'customer_sheets.id')
            ->groupBy('customer_sheets.id', 'customer_sheets.sheet_name')
            ->select('customer_sheets.sheet_name as name')
            ->selectRaw('COALESCE(SUM(e.total_material_buy), 0) as material_sum')
            ->selectRaw('COALESCE(SUM(e.shipping_cost), 0) as shipping_sum')
            ->orderBy('customer_sheets.sheet_name')
            ->get()
            ->map(fn($r) => [
                'name'     => (string) $r->name,
                'material' => (float) $r->material_sum,
                'shipping' => (float) $r->shipping_sum,
            ])
            ->values();

        return response()->json(['rows' => $rows], 200);
    }

    public function customerSheetLoans(): JsonResponse
    {
        $resp = fn($rows) => response()->json(['rows' => $rows], 200);
        $db = DB::getDatabaseName();

        // 0) If balances live directly on customer_sheets, prefer that.
        if (Schema::hasTable('customer_sheets')) {
            foreach (['remaining_balance', 'loan_remaining', 'outstanding', 'balance', 'due_amount'] as $csBal) {
                if (Schema::hasColumn('customer_sheets', $csBal)) {
                    $rows = DB::table('customer_sheets as cs')
                        ->select('cs.sheet_name as name', DB::raw("COALESCE(SUM(cs.$csBal),0) as remaining"))
                        ->groupBy('cs.id', 'cs.sheet_name')
                        ->havingRaw('remaining > 0')
                        ->orderByDesc('remaining')
                        ->get()
                        ->map(fn($r) => ['name' => (string)$r->name, 'remaining' => (float)$r->remaining])
                        ->values();
                    if ($rows->count()) return $resp($rows);
                }
            }
        }

        // 0b) If per-entry remaining exists on customer_sheet_entries, use it.
        if (Schema::hasTable('customer_sheet_entries')) {
            $fk = collect(['customer_sheet_id', 'sheet_id', 'cs_id'])->first(fn($c) => Schema::hasColumn('customer_sheet_entries', $c));
            if ($fk) {
                foreach (['remaining', 'remaining_balance', 'loan_remaining', 'balance_due', 'outstanding'] as $remCol) {
                    if (Schema::hasColumn('customer_sheet_entries', $remCol)) {
                        $rows = DB::table('customer_sheet_entries as e')
                            ->join('customer_sheets as cs', 'cs.id', '=', "e.$fk")
                            ->select('cs.sheet_name as name', DB::raw("COALESCE(SUM(e.$remCol),0) as remaining"))
                            ->groupBy('cs.id', 'cs.sheet_name')
                            ->havingRaw('remaining > 0')
                            ->orderByDesc('remaining')
                            ->get()
                            ->map(fn($r) => ['name' => (string)$r->name, 'remaining' => (float)$r->remaining])
                            ->values();
                        if ($rows->count()) return $resp($rows);
                    }
                }
            }
        }

        // 1) Find a ledger-like table dynamically.
        $candidates = DB::select("
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ? AND (
            table_name LIKE '%loan%' OR table_name LIKE '%ledger%'
        )
        ORDER BY table_name
    ", [$db]);

        foreach ($candidates as $cand) {
            $tbl = $cand->table_name;

            // discover columns once
            $cols = DB::select("
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = ? AND table_name = ?
        ", [$db, $tbl]);
            $colset = collect($cols)->pluck('column_name')->map(fn($c) => strtolower($c))->all();
            $has = fn($c) => in_array(strtolower($c), $colset, true);

            // FK to customer_sheets
            $fk = collect(['customer_sheet_id', 'sheet_id', 'customer_id', 'cs_id'])->first($has);
            if (!$fk) continue;

            // Helper to execute a strategy
            $run = function (string $expr) use ($tbl, $fk) {
                return DB::table("$tbl as ll")
                    ->join('customer_sheets as cs', 'cs.id', '=', "ll.$fk")
                    ->select('cs.sheet_name as name', DB::raw("$expr as remaining"))
                    ->groupBy('cs.id', 'cs.sheet_name')
                    ->havingRaw("$expr > 0")
                    ->orderByDesc(DB::raw($expr))
                    ->get()
                    ->map(fn($r) => ['name' => (string)$r->name, 'remaining' => (float)$r->remaining])
                    ->values();
            };

            // A) Direct balance column
            foreach (['remaining_balance', 'balance', 'outstanding', 'due_amount', 'remaining'] as $balCol) {
                if ($has($balCol)) {
                    $rows = $run("COALESCE(SUM(ll.$balCol),0)");
                    if ($rows->count()) return $resp($rows);
                }
            }

            // plausible amount columns
            $amt = collect(['amount', 'amt', 'value', 'total', 'amount_aed', 'aed', 'loan_amount'])->first($has);

            // B) debit/credit
            if ($has('debit') && $has('credit')) {
                $rows = $run("COALESCE(SUM(COALESCE(ll.debit,0)) - SUM(COALESCE(ll.credit,0)),0)");
                if ($rows->count()) return $resp($rows);
            }
            if ($has('dr') && $has('cr')) {
                $rows = $run("COALESCE(SUM(COALESCE(ll.dr,0)) - SUM(COALESCE(ll.cr,0)),0)");
                if ($rows->count()) return $resp($rows);
            }

            // C) loan_amount - paid_amount
            if ($has('loan_amount') && ($has('paid_amount') || $has('repayment') || $has('received'))) {
                $paidCol = $has('paid_amount') ? 'paid_amount' : ($has('repayment') ? 'repayment' : 'received');
                $rows = $run("COALESCE(SUM(COALESCE(ll.loan_amount,0)) - SUM(COALESCE(ll.$paidCol,0)),0)");
                if ($rows->count()) return $resp($rows);
            }

            // D) type + amount labels
            if ($amt) {
                $typeCol = collect(['type', 'entry_type', 'txn_type', 'category', 'mode', 'description', 'remarks'])->first($has);
                if ($typeCol) {
                    $loanExpr = "
                    SUM(CASE
                        WHEN LOWER(ll.$typeCol) IN ('loan','loan given','credit','advance','given','borrow','lend')
                             OR LOWER(ll.$typeCol) LIKE '%loan%'
                             OR LOWER(ll.$typeCol) LIKE '%advance%'
                        THEN COALESCE(ll.$amt,0) ELSE 0 END)";
                    $payExpr  = "
                    SUM(CASE
                        WHEN LOWER(ll.$typeCol) IN ('paid','payment','repayment','settled','return','returned','refund','received')
                             OR LOWER(ll.$typeCol) LIKE '%pay%'
                             OR LOWER(ll.$typeCol) LIKE '%return%'
                             OR LOWER(ll.$typeCol) LIKE '%refund%'
                        THEN COALESCE(ll.$amt,0) ELSE 0 END)";
                    $rows = $run("COALESCE(($loanExpr) - ($payExpr),0)");
                    if ($rows->count()) return $resp($rows);
                }

                // E) sign-based fallback
                $rows = $run("
                COALESCE(
                    SUM(CASE WHEN COALESCE(ll.$amt,0) > 0 THEN ll.$amt ELSE 0 END)
                  - SUM(CASE WHEN COALESCE(ll.$amt,0) < 0 THEN -ll.$amt ELSE 0 END)
                ,0)");
                if ($rows->count()) return $resp($rows);
            }
        }

        // Nothing found
        return $resp([]);
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
