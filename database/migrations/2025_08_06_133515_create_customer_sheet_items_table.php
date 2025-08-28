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
        Schema::create('customer_sheet_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('entry_id')->constrained('customer_sheet_entries')->onDelete('cascade');
            $table->integer('units');
            $table->decimal('unit_price', 10, 2);
            $table->decimal('vat', 5, 2)->nullable();
            $table->integer('ctns')->nullable();
            $table->decimal('weight_per_ctn', 8, 2)->nullable();
            $table->decimal('total_material', 12, 2)->nullable();
            $table->decimal('total_weight', 12, 2)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_sheet_items');
    }
};
