<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GtsInvestment extends Model
{
    protected $fillable = [
        'date',
        'investor',
        'investment_amount',
        'investment_no',
        'mode_of_transaction',
        'murabaha',
        'repayment_terms',
        'loan_tenure',
        'repayment_date',
        'remarks',
        'status',
        'invoice', 
        'receipt', 
        'note',
        'payment_method',
    ];

    protected $casts = [
        'date' => 'date',
        'repayment_date' => 'date',
    ];
}
