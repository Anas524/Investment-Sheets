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
        if (!Schema::hasColumn('beneficiary_entries', 'sheet_set_id')) {
            Schema::table('beneficiary_entries', function (Blueprint $table) {
                $table->foreignId('sheet_set_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('sheet_sets')
                    ->cascadeOnUpdate();
            });

            $defaultId = DB::table('sheet_sets')->value('id');
            if (!$defaultId) {
                $defaultId = DB::table('sheet_sets')->insertGetId([
                    'name'       => 'Default Set',
                    'status'     => 'open',
                    'opened_at'  => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('beneficiary_entries')
                ->whereNull('sheet_set_id')
                ->update(['sheet_set_id' => $defaultId]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('beneficiary_entries', 'sheet_set_id')) {
            Schema::table('beneficiary_entries', function (Blueprint $table) {
                try { $table->dropForeign(['sheet_set_id']); } catch (\Throwable $e) {}
                $table->dropColumn('sheet_set_id');
            });
        }
    }
};
