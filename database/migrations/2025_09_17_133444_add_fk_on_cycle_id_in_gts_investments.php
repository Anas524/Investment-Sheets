<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('gts_investments', function (Blueprint $table) {
            // ensure index + FK (guard if already exists)
            $table->unsignedBigInteger('cycle_id')->nullable()->change();
        });

        // 1) Ensure we have at least one cycle to attach legacy rows
        $defaultCycleId = DB::table('cycles')->value('id');
        if (!$defaultCycleId) {
            $defaultCycleId = DB::table('cycles')->insertGetId([
                'name'       => 'Legacy Set (Auto)',
                'date_from'  => now()->toDateString(),
                'status'     => 'open',
                'cash_in'    => 0,
                'cash_out'   => 0,
                'profit'     => 0,
                'us_client_payment' => 0,
                'created_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // 2) Point NULL cycle_ids to the default cycle (or set to null if you prefer)
        DB::table('gts_investments')->whereNull('cycle_id')->update(['cycle_id' => $defaultCycleId]);

        // 3) Fix any invalid references (cycle_id that doesn't exist in cycles)
        //    This LEFT JOIN update sets them to the default cycle
        DB::statement("
            UPDATE gts_investments gi
            LEFT JOIN cycles c ON gi.cycle_id = c.id
            SET gi.cycle_id = {$defaultCycleId}
            WHERE c.id IS NULL
        ");

        // 4) Now add index + FK
        Schema::table('gts_investments', function (Blueprint $t) {
            $t->index('cycle_id');
            $t->foreign('cycle_id')->references('id')->on('cycles')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gts_investments', function (Blueprint $table) {
            $table->dropForeign(['cycle_id']);
            $table->dropIndex(['cycle_id']);
        });
    }
};
