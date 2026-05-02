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
        Schema::table('pl_months', function (Blueprint $table) {
            $table->boolean('is_closed')->default(false)->after('label');
            $table->timestamp('closed_at')->nullable()->after('is_closed');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pl_months', function (Blueprint $table) {
            $table->dropColumn(['is_closed','closed_at']);
        });
    }
};
