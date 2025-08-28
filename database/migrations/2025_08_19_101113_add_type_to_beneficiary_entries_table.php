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
        if (!Schema::hasColumn('beneficiary_entries', 'type')) {
            Schema::table('beneficiary_entries', function (Blueprint $table) {
                $table->string('type', 32)->default('cash')->after('date');
                $table->index('type'); // creates beneficiary_entries_type_index
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('beneficiary_entries', 'type')) {
            Schema::table('beneficiary_entries', function (Blueprint $table) {
                // index might or might not exist; drop safely
                try { $table->dropIndex('beneficiary_entries_type_index'); } catch (\Throwable $e) {}
                $table->dropColumn('type');
            });
        }
    }
};
