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
        if (!Schema::hasColumn('beneficiary_entries', 'charity')) {
            Schema::table('beneficiary_entries', function (Blueprint $table) {
                $table->decimal('charity', 15, 2)->nullable()->after('amount');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('beneficiary_entries', 'charity')) {
            Schema::table('beneficiary_entries', function (Blueprint $table) {
                $table->dropColumn('charity');
            });
        }
    }
};
