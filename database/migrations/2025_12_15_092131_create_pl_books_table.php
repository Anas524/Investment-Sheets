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
        Schema::create('pl_books', function (Blueprint $table) {
            $table->id();
            $table->string('title')->nullable();
            $table->date('from_month'); // yyyy-mm-01
            $table->date('to_month');   // yyyy-mm-01
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pl_books');
    }
};
