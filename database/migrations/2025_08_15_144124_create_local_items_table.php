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
        Schema::create('local_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('local_id')->constrained('locals')->cascadeOnDelete();

            $table->string('description')->nullable();
            $table->unsignedInteger('units')->default(0);
            $table->decimal('unit_price',   15, 2)->default(0); // “Unit Price”
            $table->decimal('total_ex_vat', 15, 2)->default(0); // units * unit_price (server re-computes)
            $table->decimal('vat',          15, 2)->default(0); // user-entered VAT amount
            $table->decimal('total_inc_vat',15, 2)->default(0); // ex + vat
            $table->enum('status', ['paid','pending','partial'])->default('pending');
            $table->string('remarks')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('local_items');
    }
};
