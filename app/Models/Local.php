<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Local extends Model
{
    protected $fillable = [
        'date','client','description','payment_status','remarks',
        'total_units','total_ex_vat','vat_amount','total_inc_vat',
    ];

    protected $casts = [
        'date'          => 'date',
        'total_units'   => 'integer',
        'total_ex_vat'  => 'decimal:2',
        'vat_amount'    => 'decimal:2',
        'total_inc_vat' => 'decimal:2',
    ];

    public function items()
    {
        return $this->hasMany(LocalItem::class); // FK: local_id
    }

    public function attachments()
    { 
        return $this->hasOne(LocalAttachment::class, 'local_id'); 
    }
}
