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
        Schema::create('cycles', function (Blueprint $table) {
            $table->id();
            $table->string('name');                 // user-given title
            $table->date('date_from')->nullable();
            $table->date('date_to')->nullable();
            $table->enum('status', ['open','closed'])->default('open');
            // cached rollups for fast Summary (optional; updated by jobs/hooks)
            $table->decimal('cash_in', 14, 2)->default(0);
            $table->decimal('cash_out',14, 2)->default(0);
            $table->decimal('profit',  14, 2)->default(0);
            $table->decimal('us_client_payment',14,2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cycles');
    }
};
