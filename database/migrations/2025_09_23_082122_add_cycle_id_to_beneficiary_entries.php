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
        // Add column + index (idempotent)
        Schema::table('beneficiary_entries', function (Blueprint $t) {
            if (!Schema::hasColumn('beneficiary_entries', 'cycle_id')) {
                $t->unsignedBigInteger('cycle_id')->nullable()->after('id');
                $t->index('cycle_id', 'beneficiary_entries_cycle_id_idx');
            }
        });

        // -------- Backfill --------
        // If the old schema had sheet_set_id, copy it across.
        if (Schema::hasColumn('beneficiary_entries', 'sheet_set_id')) {
            DB::statement("
                UPDATE beneficiary_entries
                SET cycle_id = sheet_set_id
                WHERE cycle_id IS NULL AND sheet_set_id IS NOT NULL
            ");
        }

        // If your data for “legacy” must live in set #5, force-move any NULL/1 to 5.
        // (Safe to keep; it’s a no-op if you’ve already done it.)
        DB::statement("
            UPDATE beneficiary_entries
            SET cycle_id = 5
            WHERE cycle_id IS NULL OR cycle_id = 1
        ");
    }

    public function down(): void
    {
        Schema::table('beneficiary_entries', function (Blueprint $t) {
            if (Schema::hasColumn('beneficiary_entries', 'cycle_id')) {
                $t->dropIndex(['beneficiary_entries_cycle_id_idx']);
                $t->dropColumn('cycle_id');
            }
        });
    }
};
