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
        Schema::table('cycles', function (Blueprint $table) {
            if (!Schema::hasColumn('cycles', 'deleted_at')) {
                $table->softDeletes(); // adds nullable timestamp 'deleted_at'
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cycles', function (Blueprint $table) {
            if (Schema::hasColumn('cycles', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
    }
};
