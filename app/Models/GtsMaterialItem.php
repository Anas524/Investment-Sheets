<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GtsMaterialItem extends Model
{
    protected $table = 'gts_materials_items';

    protected $fillable = [
        'material_id',
        'description',
        'units',
        'unit_price',
        'vat',
        'weight_per_ctn',
        'ctns',
    ];

    public function material()
    {
        return $this->belongsTo(GtsMaterial::class, 'material_id');
    }
}
