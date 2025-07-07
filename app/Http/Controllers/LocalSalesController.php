<?php

namespace App\Http\Controllers;

use App\Models\Local;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\log;

class LocalSalesController extends Controller
{
    public function storeMultiple(Request $request)
    {
        $entries = $request->input('entries', []);

        if (!is_array($entries)) {
            return response()->json(['success' => false, 'message' => 'No entries received.']);
        }

        // ✅ Get the latest sr_no from DB and increment
        $lastSrNo = Local::max('sr_no') ?? 0;
        $newSrNo = $lastSrNo + 1;

        foreach ($entries as $index => $entry) {
            $local = new Local();
            $local->sr_no = $newSrNo;
            $local->sub_serial = $index + 1;

            $local->client = $entry['client'] ?? null;
            $local->date = $entry['date'] ?? null;
            $local->description = $entry['description'] ?? null;
            $local->unit_price = $entry['unit_price'] ?? 0;
            $local->no_of_ctns = $entry['no_of_ctns'] ?? 0;
            $local->units_per_ctn = $entry['units_per_ctn'] ?? 0;
            $local->total_no_of_units = $entry['total_no_of_units'] ?? 0;
            $local->vat_percentage = $entry['vat_percentage'] ?? 0;
            $local->vat_amount = $entry['vat_amount'] ?? 0;
            $local->total_amount_without_vat = $entry['total_amount_without_vat'] ?? 0;
            $local->total_amount_including_vat = $entry['total_amount_including_vat'] ?? 0;
            $local->payment_status = $entry['payment_status'] ?? null;
            $local->remarks = $entry['remarks'] ?? null;
            $local->save();

            Log::info('Saved Local Entry:', $local->toArray());
        }

        return response()->json(['success' => true]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'client' => 'nullable|string',
            'date' => 'nullable|date',
            'description' => 'nullable|string',
            'unit_price' => 'nullable|numeric',
            'no_of_ctns' => 'nullable|numeric',
            'units_per_ctn' => 'nullable|numeric',
            'vat_percentage' => 'nullable|numeric',
            'payment_status' => 'nullable|string',
            'remarks' => 'nullable|string',
            'total_no_of_units' => 'nullable|numeric',
        ]);

        // Use manually entered total units if CTNS * Units/CTN is 0
        $total_units = ($request->no_of_ctns ?? 0) * ($request->units_per_ctn ?? 0);

        if ($total_units <= 0 && $request->has('total_no_of_units')) {
            $total_units = $request->total_no_of_units;
        }
        $amount_no_vat = ($request->unit_price ?? 0) * $total_units;
        $vat_amount = $amount_no_vat * (($request->vat_percentage ?? 0) / 100);
        $total_with_vat = $amount_no_vat + $vat_amount;

        // Assign next sr_no
        $nextSrNo = Local::max('sr_no');
        $nextSrNo = $nextSrNo ? $nextSrNo + 1 : 1;

        Local::create([
            'sr_no' => $nextSrNo,
            'sub_serial' => null,
            'client' => $request->client,
            'date' => $request->date,
            'description' => $request->description,
            'unit_price' => $request->unit_price,
            'no_of_ctns' => $request->no_of_ctns,
            'units_per_ctn' => $request->units_per_ctn,
            'total_no_of_units' => $total_units,
            'total_amount_without_vat' => $amount_no_vat,
            'vat_percentage' => $request->vat_percentage,
            'vat_amount' => $vat_amount,
            'total_amount_including_vat' => $total_with_vat,
            'payment_status' => $request->payment_status,
            'remarks' => $request->remarks,
        ]);

        return response()->json(['success' => true]);
    }

    public function index()
    {
        $entries = Local::orderBy('sr_no')->orderBy('sub_serial')->get();

        // Group entries by sr_no
        $grouped = $entries->groupBy('sr_no')->map(function ($group, $srNo) {
            return [
                'sr_no' => $srNo,
                'entries' => $group->values(),
            ];
        })->values();

        return response()->json(['entries' => $grouped]);
    }

    // Normal delete
    public function delete(Request $request)
    {
        $srNo = $request->input('sr_no');
        $subSerial = $request->input('sub_serial');

        if (!$srNo) {
            return response()->json(['success' => false, 'message' => 'Missing SR.NO']);
        }

        if ($subSerial === 'all') {
            // Delete all entries with that SR.NO
            Local::where('sr_no', $srNo)->delete();
        } elseif (is_numeric($subSerial)) {
            // Delete specific sub_serial under SR.NO
            Local::where('sr_no', $srNo)->where('sub_serial', $subSerial)->delete();

            // If only one entry left, convert it to normal (remove sub_serial)
            $remaining = Local::where('sr_no', $srNo)->get();
            if ($remaining->count() === 1) {
                $remaining[0]->update(['sub_serial' => null]);
            }
        } else {
            // It's a normal entry (not multiple)
            Local::where('sr_no', $srNo)->delete();
        }

        return response()->json(['success' => true]);
    }

    // Multiple delete
    public function destroyMultiple($sr_no, $sub_serial)
    {
        if ($sub_serial === 'all') {
            Local::where('sr_no', $sr_no)->delete();
        } else {
            Local::where('sr_no', $sr_no)
                ->where('sub_serial', $sub_serial)
                ->delete();

            // Reindex sub_serials
            $remaining = Local::where('sr_no', $sr_no)->orderBy('sub_serial')->get();
            foreach ($remaining as $i => $entry) {
                $entry->sub_serial = $i + 1;
                $entry->save();
            }
        }

        return response()->json(['success' => true]);
    }

    public function update(Request $request, $id)
    {
        $local = Local::findOrFail($id);

        $totalUnits = ($request->no_of_ctns ?? 0) * ($request->units_per_ctn ?? 0);
        if ($totalUnits <= 0 && $request->has('total_no_of_units')) {
            $totalUnits = $request->total_no_of_units;
        }

        $amountNoVat = ($request->unit_price ?? 0) * $totalUnits;
        $vatAmount = $amountNoVat * (($request->vat_percentage ?? 0) / 100);
        $totalWithVat = $amountNoVat + $vatAmount;

        $local->update([
            'client' => $request->client,
            'date' => $request->date,
            'description' => $request->description,
            'unit_price' => $request->unit_price,
            'no_of_ctns' => $request->no_of_ctns,
            'units_per_ctn' => $request->units_per_ctn,
            'total_no_of_units' => $totalUnits,
            'total_amount_without_vat' => $amountNoVat,
            'vat_percentage' => $request->vat_percentage,
            'vat_amount' => $vatAmount,
            'total_amount_including_vat' => $totalWithVat,
            'payment_status' => $request->payment_status,
            'remarks' => $request->remarks,
        ]);

        return response()->json(['success' => true]);
    }
}
