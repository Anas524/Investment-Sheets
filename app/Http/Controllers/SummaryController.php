<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;

use Illuminate\Http\Request;

class SummaryController extends Controller
{
    public function getSummaryData()
    {
        $totalPurchase = DB::table('investments')->sum('total_material_including_vat');
        $totalShipping = DB::table('investments')->sum('shipping_cost');

        $cashOut = $totalPurchase + $totalShipping;
        $cashIn = 0;
        $profit = $cashIn - $cashOut;

        return response()->json([
            'total_purchase_of_material' => $totalPurchase,
            'total_shipping_cost' => $totalShipping,
            'cash_out' => $cashOut,
            'cash_in' => $cashIn,
            'profit' => $profit,
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
        $localSalesAmount = DB::table('local_sales')->sum('total_amount_including_vat');

        $data[] = ['sheet' => 'US Client Payment', 'material' => $usClientAmount, 'shipping' => 0, 'total' => $usClientAmount];
        $data[] = ['sheet' => 'SQ Sheet', 'material' => $sqClientAmount, 'shipping' => 0, 'total' => $sqClientAmount];
        $data[] = ['sheet' => 'Local Sales', 'material' => $localSalesAmount, 'shipping' => 0, 'total' => $localSalesAmount];

        return response()->json($data);
    }
}
