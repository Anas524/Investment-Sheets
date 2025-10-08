<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // create one default open cycle
        $cycleId = DB::table('cycles')->insertGetId([
            'name'       => 'Legacy Set (Auto)',
            'date_from'  => now()->toDateString(),
            'status'     => 'open',
            'created_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // attach any rows that have NULL cycle_id
        DB::table('gts_investments')->whereNull('cycle_id')->update(['cycle_id' => $cycleId]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
