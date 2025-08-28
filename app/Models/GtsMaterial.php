<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GtsMaterial extends Model
{
    protected $fillable = [
        'invoice_date',
        'invoice_no',
        'supplier_name',
        'brief_description',
        'shipping_cost',
        'dgd',
        'labour',
        'total_material',
        'total_vat',
        'total_material_buy',
        'total_weight',
        'mode_of_transaction',
        'receipt_no',
        'remarks',
        'items_data',
        'status',
        'invoice_path',
        'receipt_path',
        'note_path',
    ];

    protected $casts = [
        'items_data' => 'array',
        'invoice_date' => 'date',
    ];

    public function items()
    {
        return $this->hasMany(GtsMaterialItem::class, 'material_id', 'id');
    }
}
