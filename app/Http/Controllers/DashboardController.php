<?php

namespace App\Http\Controllers;

use App\Models\CustomerSheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    public function showMainPage(Request $request)
    {
        $sheets = CustomerSheet::all();
        return view('index', compact('sheets'));
    }
}
