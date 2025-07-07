<?php

namespace App\Http\Controllers;

use App\Models\SQClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SQClientController extends Controller
{
    public function index(Request $request)
    {
        $clients = SQClient::orderBy('id')->get();
        $totalAmount = SQClient::sum('amount');

        if ($request->ajax()) {
            return response()->json([
                'clients' => $clients,
                'totalAmount' => $totalAmount
            ]);
        }

        return view('sheets.sq_sheet', compact('clients', 'totalAmount'));
    }

    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'date' => 'required|date',
                'amount' => 'required|numeric',
                'remarks' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $client = SQClient::create([
                'date' => $request->date,
                'amount' => $request->amount,
                'remarks' => $request->remarks,
            ]);

           return response()->json(['success' => true, 'id' => $client->id]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $payment = SQClient::findOrFail($id);
        $payment->update($request->only(['date', 'amount', 'remarks']));
        return response()->json(['success' => true]);
    }

    public function destroy($id)
    {
        $client = SQClient::find($id);

        if (!$client) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $client->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
