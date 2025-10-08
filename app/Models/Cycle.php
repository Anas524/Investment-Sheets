<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Cycle extends Model
{
    protected $fillable = ['name', 'date_from', 'date_to', 'status', 'cash_in', 'cash_out', 'profit', 'us_client_payment', 'created_by'];

    protected $casts = [
        'date_from' => 'date',
        'date_to'   => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
