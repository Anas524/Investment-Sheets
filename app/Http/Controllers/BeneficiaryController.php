<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class BeneficiaryController extends Controller
{
    public function index()
    {
        return view('sheets.beneficiary_sheet');
    }

    public function data()
    {
        $rows = DB::table('beneficiary_entries')
            ->orderBy('id')
            ->get()
            ->groupBy('beneficiary');

        $map = fn($b) => ($rows[$b] ?? collect())->map(function ($r) {
            return [
                'id'      => $r->id,
                'date'    => $r->date,
                'type'    => $r->type,
                'amount'  => (float)($r->amount ?? 0),
                'charity' => $r->charity !== null ? (float)$r->charity : null,
                'remarks' => (string)($r->remarks ?? '')
            ];
        })->values();

        $sh1 = $map('shareholder1');
        $sh2 = $map('shareholder2');
        $ch  = $map('charity');

        $sum = fn($c) => round($c->sum('amount'), 2);
        $sumChar = fn($c) => round($c->sum('charity'), 2);

        return response()->json([
            'shareholder1' => ['rows' => $sh1, 'total' => $sum(collect($sh1)), 'charity_total' => $sumChar(collect($sh1))],
            'shareholder2' => ['rows' => $sh2, 'total' => $sum(collect($sh2)), 'charity_total' => $sumChar(collect($sh2))],
            'charity'      => ['rows' => $ch,  'total' => $sum(collect($ch)),  'charity_total' => $sumChar(collect($ch))],
        ]);
    }

    public function store(Request $req)
    {
        $v = Validator::make($req->all(), [
            'beneficiary' => 'required|in:shareholder1,shareholder2,charity',
            'date'        => 'nullable|date',
            'type'        => 'required|in:cash,bank_transfer,adjustment',
            'amount'      => 'nullable|numeric',
            'charity'     => 'nullable|numeric',
            'remarks'     => 'nullable|string|max:500',
        ]);
        if ($v->fails()) return response()->json(['success' => false, 'errors' => $v->errors()], 422);

        $id = DB::table('beneficiary_entries')->insertGetId([
            'beneficiary' => $req->input('beneficiary'),
            'date'        => $req->input('date') ?: null,
            'type'        => $req->input('type'),
            'amount'      => $req->input('amount') !== null ? (float)$req->input('amount') : 0,
            'charity'     => $req->input('charity') !== null ? (float)$req->input('charity') : null,
            'remarks'     => $req->input('remarks'),
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        // return fresh totals for quick UI update
        return $this->data()->setStatusCode(201);
    }

    public function destroy($id)
    {
        DB::table('beneficiary_entries')->where('id', $id)->delete();
        return $this->data();
    }

    // app/Http/Controllers/BeneficiaryController.php
    public function update(Request $req, $id)
    {
        $data = $req->validate([
            'date'    => 'nullable|date',
            'type'    => 'required|in:cash,bank_transfer,adjustment',
            'amount'  => 'nullable|numeric',
            'charity' => 'nullable|numeric',
            'remarks' => 'nullable|string|max:500',
        ]);

        DB::table('beneficiary_entries')->where('id', $id)->update([
            'date'       => $data['date'] ?? null,
            'type'       => $data['type'],
            'amount'     => array_key_exists('amount', $data) ? ((float)($data['amount'] ?? 0)) : 0,
            'charity'    => array_key_exists('charity', $data) ? ($data['charity'] !== null ? (float)$data['charity'] : null) : null,
            'remarks'    => $data['remarks'] ?? null,
            'updated_at' => now(),
        ]);

        return $this->data(); // return fresh payload like store/delete
    }
}
