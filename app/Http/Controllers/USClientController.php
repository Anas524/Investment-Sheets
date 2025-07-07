<?php

namespace App\Http\Controllers;

use App\Models\USClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class USClientController extends Controller
{
    public function index(Request $request)
    {
        $clients = USClient::orderBy('id')->get();
        $totalAmount = USClient::sum('amount');

        if ($request->ajax()) {
            return response()->json([
                'clients' => $clients,
                'totalAmount' => $totalAmount
            ]);
        }

        return view('sheets.us_client_payment', compact('clients', 'totalAmount'));
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

            $client = USClient::create([
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
        $payment = USClient::findOrFail($id);
        $payment->update($request->only(['date', 'amount', 'remarks']));
        return response()->json(['success' => true]);
    }

    public function destroy($id)
    {
        $client = USClient::find($id);

        if (!$client) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $client->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
