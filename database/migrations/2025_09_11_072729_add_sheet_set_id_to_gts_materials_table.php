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
        Schema::table('gts_materials', function (Blueprint $table) {
            $table->unsignedBigInteger('sheet_set_id')->nullable()->after('id')->index();
            $table->foreign('sheet_set_id')->references('id')->on('sheet_sets')->cascadeOnDelete();
        });

        // Backfill: put all existing rows into the current set
        $setId = DB::table('sheet_sets')->where('is_current', 1)->value('id');
        if ($setId) {
            DB::table('gts_materials')->whereNull('sheet_set_id')->update(['sheet_set_id' => $setId]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gts_materials', function (Blueprint $table) {
            $table->dropForeign(['sheet_set_id']);
            $table->dropColumn('sheet_set_id');
        });
    }
};
