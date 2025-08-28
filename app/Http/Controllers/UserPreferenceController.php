<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class UserPreferenceController extends Controller
{
    public function updateCustomerSheet(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $user->last_customer_sheet = $request->sheet_name;
        $user->save();

        return response()->json(['status' => 'success']);
    }
}
