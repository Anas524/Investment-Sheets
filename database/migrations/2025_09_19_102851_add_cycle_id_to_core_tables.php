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
        // gts_investments
        Schema::table('gts_investments', function (Blueprint $table) {
            if (!Schema::hasColumn('gts_investments', 'cycle_id')) {
                $table->foreignId('cycle_id')->nullable()->after('id');
            }
        });
        Schema::table('gts_investments', function (Blueprint $table) {
            // unique, readable FK name
            if (Schema::hasColumn('gts_investments', 'cycle_id')) {
                $table->foreign('cycle_id', 'fk_gts_investments_cycle')
                    ->references('id')->on('cycles')->onDelete('set null');
            }
        });

        // gts_materials
        Schema::table('gts_materials', function (Blueprint $table) {
            if (!Schema::hasColumn('gts_materials', 'cycle_id')) {
                $table->foreignId('cycle_id')->nullable()->after('id');
            }
        });
        Schema::table('gts_materials', function (Blueprint $table) {
            if (Schema::hasColumn('gts_materials', 'cycle_id')) {
                $table->foreign('cycle_id', 'fk_gts_materials_cycle')
                    ->references('id')->on('cycles')->onDelete('set null');
            }
        });

        // locals
        Schema::table('locals', function (Blueprint $table) {
            if (!Schema::hasColumn('locals', 'cycle_id')) {
                $table->foreignId('cycle_id')->nullable()->after('id');
            }
        });
        Schema::table('locals', function (Blueprint $table) {
            if (Schema::hasColumn('locals', 'cycle_id')) {
                $table->foreign('cycle_id', 'fk_locals_cycle')
                    ->references('id')->on('cycles')->onDelete('set null');
            }
        });

        // us_clients
        Schema::table('us_clients', function (Blueprint $table) {
            if (!Schema::hasColumn('us_clients', 'cycle_id')) {
                $table->foreignId('cycle_id')->nullable()->after('id');
            }
        });
        Schema::table('us_clients', function (Blueprint $table) {
            if (Schema::hasColumn('us_clients', 'cycle_id')) {
                $table->foreign('cycle_id', 'fk_us_clients_cycle')
                    ->references('id')->on('cycles')->onDelete('set null');
            }
        });

        // s_q_clients
        Schema::table('s_q_clients', function (Blueprint $table) {
            if (!Schema::hasColumn('s_q_clients', 'cycle_id')) {
                $table->foreignId('cycle_id')->nullable()->after('id');
            }
        });
        Schema::table('s_q_clients', function (Blueprint $table) {
            if (Schema::hasColumn('s_q_clients', 'cycle_id')) {
                $table->foreign('cycle_id', 'fk_sq_clients_cycle')
                    ->references('id')->on('cycles')->onDelete('set null');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop FKs first, then columns — names must match the ones above
        Schema::table('gts_investments', function (Blueprint $table) {
            if (Schema::hasColumn('gts_investments', 'cycle_id')) {
                $table->dropForeign('fk_gts_investments_cycle');
                $table->dropColumn('cycle_id');
            }
        });
        Schema::table('gts_materials', function (Blueprint $table) {
            if (Schema::hasColumn('gts_materials', 'cycle_id')) {
                $table->dropForeign('fk_gts_materials_cycle');
                $table->dropColumn('cycle_id');
            }
        });
        Schema::table('locals', function (Blueprint $table) {
            if (Schema::hasColumn('locals', 'cycle_id')) {
                $table->dropForeign('fk_locals_cycle');
                $table->dropColumn('cycle_id');
            }
        });
        Schema::table('us_clients', function (Blueprint $table) {
            if (Schema::hasColumn('us_clients', 'cycle_id')) {
                $table->dropForeign('fk_us_clients_cycle');
                $table->dropColumn('cycle_id');
            }
        });
        Schema::table('s_q_clients', function (Blueprint $table) {
            if (Schema::hasColumn('s_q_clients', 'cycle_id')) {
                $table->dropForeign('fk_sq_clients_cycle');
                $table->dropColumn('cycle_id');
            }
        });
    }
};
