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
            $table->string('payment_method', 50)->nullable()->after('repayment_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gts_investments', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};
