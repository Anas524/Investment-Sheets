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
        Schema::table('customer_sheet_entries', function (Blueprint $table) {
            $table->unsignedBigInteger('sheet_set_id')->nullable()->after('id')->index();
            $table->foreign('sheet_set_id')->references('id')->on('sheet_sets')->cascadeOnDelete();
        });

        // If customer_sheets already has sheet_set_id, copy it down; else put into current set
        if (Schema::hasColumn('customer_sheets', 'sheet_set_id') &&
            Schema::hasColumn('customer_sheet_entries', 'customer_sheet_id')) {
            DB::statement("
                UPDATE customer_sheet_entries e
                JOIN customer_sheets s ON s.id = e.customer_sheet_id
                SET e.sheet_set_id = s.sheet_set_id
                WHERE e.sheet_set_id IS NULL
            ");
        } else {
            $setId = DB::table('sheet_sets')->where('is_current', 1)->value('id');
            if ($setId) {
                DB::table('customer_sheet_entries')->whereNull('sheet_set_id')->update(['sheet_set_id' => $setId]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customer_sheet_entries', function (Blueprint $table) {
            $table->dropForeign(['sheet_set_id']);
            $table->dropColumn('sheet_set_id');
        });
    }
};
