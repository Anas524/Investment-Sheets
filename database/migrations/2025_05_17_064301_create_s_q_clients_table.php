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
        if (!Schema::hasTable('s_q_clients')) {
            Schema::create('s_q_clients', function (Blueprint $table) {
                $table->id();
                $table->date('date');
                $table->decimal('amount', 15, 2);
                $table->string('remarks')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Only drop if it exists (safe)
        if (Schema::hasTable('s_q_clients')) {
            Schema::dropIfExists('s_q_clients');
        }
    }
};
