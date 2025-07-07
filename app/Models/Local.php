<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Local extends Model
{
    protected $table = 'local_sales';

    protected $fillable = [
        'sr_no',
        'sub_serial',
        'client',
        'date',
        'description',
        'unit_price',
        'no_of_ctns',
        'units_per_ctn',
        'total_no_of_units',
        'total_amount_without_vat',
        'vat_percentage',
        'vat_amount',
        'total_amount_including_vat',
        'payment_status',
        'remarks'
    ];
}
