<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class USClient extends Model
{
    protected $table = 'us_clients';
    
    protected $fillable = ['date', 'amount', 'remarks'];
}
