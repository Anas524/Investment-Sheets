<?php

namespace App\Http\Controllers;

use App\Models\CustomerLoanLedgerEntry;
use Illuminate\Http\Request;

class CustomerLoanLedgerController extends Controller
{
    public function index($sheetId)
    {
        $rows = CustomerLoanLedgerEntry::where('customer_sheet_id', $sheetId)
            ->orderBy('created_at', 'asc')   // if same date, older insert first
            ->orderBy('id', 'asc')           // final tie-breaker
            ->get()
            ->map(function ($r) {
                return [
                    'id'                => $r->id,
                    'customer_sheet_id' => $r->customer_sheet_id,
                    'date'              => $r->date->toDateString(),
                    'description'       => $r->description,
                    'amount'            => (float) $r->amount,
                ];
            });

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request, $sheetId)
    {
        $data = $request->validate([
            'date' => 'required|date',
            'description' => 'nullable|string',
            'amount' => 'required|numeric',
        ]);

        $row = CustomerLoanLedgerEntry::create([
            'customer_sheet_id' => $sheetId,
            'date' => $data['date'],
            'description' => $data['description'] ?? null,
            'amount' => $data['amount'],
        ]);

        return response()->json(['message' => 'Saved', 'id' => $row->id]);
    }

    public function update(Request $request, $id)
    {
        $data = $request->validate([
            'date' => 'required|date',
            'description' => 'nullable|string',
            'amount' => 'required|numeric',
        ]);

        $row = CustomerLoanLedgerEntry::findOrFail($id);
        $row->update($data);

        return response()->json(['message' => 'Updated']);
    }

    public function destroy($id)
    {
        $row = CustomerLoanLedgerEntry::findOrFail($id);
        $row->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
