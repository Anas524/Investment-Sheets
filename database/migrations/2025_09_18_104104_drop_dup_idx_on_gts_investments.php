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
        Schema::table('gts_investments', function (Blueprint $table) {
            // drop whichever duplicate you don't want
            DB::statement('ALTER TABLE gts_investments DROP INDEX gts_investments_cycle_id_index');
            // keep: gts_investments_cycle_id_idx
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gts_investments', function (Blueprint $table) {
            $table->index('cycle_id', 'gts_investments_cycle_id_index');
        });
    }
};
