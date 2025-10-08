<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CycleMetric extends Model
{
    protected $fillable = ['cycle_id','cash_in','cash_out','profit','us_total','computed_at'];
}
