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
        Schema::table('sheet_sets', function (Blueprint $table) {
            if (!Schema::hasColumn('sheet_sets', 'opened_at')) {
                $table->timestamp('opened_at')->nullable()->after('status');
            }
        });

        // backfill so sorting works immediately
        DB::statement("
            UPDATE sheet_sets
            SET opened_at = COALESCE(opened_at, created_at)
        ");
        DB::statement("
            UPDATE sheet_sets
            SET closed_at = COALESCE(closed_at, updated_at)
            WHERE status = 'closed'
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sheet_sets', function (Blueprint $table) {
            if (Schema::hasColumn('sheet_sets', 'opened_at')) {
                $table->dropColumn('opened_at');
            }
        });
    }
};
