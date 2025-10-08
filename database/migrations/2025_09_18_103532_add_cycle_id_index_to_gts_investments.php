<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('gts_investments', function (Blueprint $table) {
            // if cycle_id column might not exist in some envs, add it:
            // if (!Schema::hasColumn('gts_investments','cycle_id')) $t->unsignedBigInteger('cycle_id')->nullable()->after('id');
            $table->index('cycle_id', 'gts_investments_cycle_id_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gts_investments', function (Blueprint $table) {
            $table->dropIndex('gts_investments_cycle_id_idx');
        });
    }
};
