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
        Schema::create('pl_months', function (Blueprint $table) {
            $table->id();
            $table->foreignId('book_id')->constrained('pl_books')->cascadeOnDelete();
            $table->date('month_date'); // yyyy-mm-01
            $table->string('label');    // "Dec 2024"
            $table->timestamps();

            $table->unique(['book_id', 'month_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pl_months');
    }
};
