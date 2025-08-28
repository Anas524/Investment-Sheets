<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerSheetItem extends Model
{
    protected $fillable = [
        'entry_id',
        'description',
        'units',
        'unit_price',
        'vat',
        'ctns',
        'weight_per_ctn',
        'total_material',
        'total_weight',
    ];

    public function entry()
    {
        return $this->belongsTo(CustomerSheetEntry::class, 'entry_id');
    }
}
