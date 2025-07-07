<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SQClient extends Model
{
    protected $table = 's_q_clients';
    
    protected $fillable = ['date', 'amount', 'remarks'];
}
